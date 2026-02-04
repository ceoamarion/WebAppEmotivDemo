/**
 * EEG Quality Hook - Refactored
 * 
 * Two separate metrics tracked:
 * A) eegQualityPercent (0-100%) - Mirrors Emotiv's "EEG Quality" from the stream
 * B) contactQuality per sensor + derived counts (badSensorsCount, goodSensorsCount)
 * 
 * Data sources (from Cortex API 'dev' stream):
 * - Battery level (index 0)
 * - Signal strength (index 1) 
 * - Per-sensor contact quality (indices 2 to N-1): 0=black, 1=red, 2=orange, 4=green
 * - Overall quality % (last index) - THIS is the eegQualityPercent we mirror
 * 
 * IMPORTANT: We do NOT use the Emotiv Launcher's red badge number.
 * All sensor counts are derived from per-sensor contact quality data.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// ================================
// TYPES
// ================================

export type SensorQualityLevel = 'very_bad' | 'bad' | 'ok' | 'good';

export interface SensorQualityInfo {
    name: string;
    rawValue: number;           // 0, 1, 2, or 4
    level: SensorQualityLevel;  // Derived from rawValue
}

export interface EEGQualityPayload {
    connected: boolean;

    // A) EEG Quality Percent - directly from Emotiv stream
    eegQualityPercent: number | null;  // null = not provided by stream
    eegQualityPercentSmoothed: number | null;  // Smoothed for display only

    // B) Contact Quality - derived from per-sensor data
    totalSensors: number;              // Always set when connected (EPOC X = 14)
    badSensorsCount: number | null;    // null = per-sensor data not available
    goodSensorsCount: number | null;   // null = per-sensor data not available
    perSensor: Record<string, SensorQualityInfo> | null;  // null = not available

    // Device info
    battery: number;           // 0-100
    wirelessSignal: number;    // 0-4

    // Status
    available: boolean;        // true if we have any quality data
    lastUpdateTs: number;
}

export interface EEGQualitySession {
    avgEEGQualityPercent: number | null;
    minEEGQualityPercent: number | null;
    maxEEGQualityPercent: number | null;
    avgBadSensors: number | null;
    worstBadSensors: number | null;
    timeBadSensorsPct: number | null;  // % of time badSensorsCount > 0
    frequentlyBadSensors: Array<{ name: string; badPct: number }>;
    samples: number;
}

// Standard Emotiv EPOC/EPOC X sensor names (14 EEG channels, excludes CMS/DRL)
const EPOC_SENSOR_NAMES = [
    'AF3', 'F7', 'F3', 'FC5', 'T7',
    'P7', 'O1', 'O2', 'P8', 'T8',
    'FC6', 'F4', 'F8', 'AF4'
];

const EPOC_TOTAL_SENSORS = 14;

// Contact quality thresholds
// 0 = very bad (black), 1 = bad (red), 2 = ok (orange), 4 = good (green)
const QUALITY_MAP: Record<number, SensorQualityLevel> = {
    0: 'very_bad',
    1: 'bad',
    2: 'ok',
    4: 'good',
};

// Sensors with quality <= this are considered "bad"
const BAD_SENSOR_THRESHOLD = 1;

const DEFAULT_QUALITY: EEGQualityPayload = {
    connected: false,
    eegQualityPercent: null,
    eegQualityPercentSmoothed: null,
    totalSensors: EPOC_TOTAL_SENSORS,
    badSensorsCount: null,
    goodSensorsCount: null,
    perSensor: null,
    battery: 0,
    wirelessSignal: 0,
    available: false,
    lastUpdateTs: 0,
};

// EMA alpha for display smoothing only
const DISPLAY_SMOOTHING_ALPHA = 0.25;

// ================================
// HOOK
// ================================

export function useEEGQuality(
    streamData: { data: Record<string, unknown> | null; stream: string } | null,
    isConnected: boolean
): {
    quality: EEGQualityPayload;
    sessionStats: EEGQualitySession;
    resetSessionStats: () => void;
} {
    const [quality, setQuality] = useState<EEGQualityPayload>(DEFAULT_QUALITY);

    // Session tracking - stores RAW values, not smoothed
    const sessionStatsRef = useRef<{
        eegQualitySum: number;
        eegQualitySamples: number;
        minEEGQuality: number | null;
        maxEEGQuality: number | null;
        badSensorsSum: number;
        badSensorsSamples: number;
        worstBadSensors: number;
        timeBadSensorsCount: number;
        sensorBadCounts: Record<string, number>;
        totalSamples: number;
    }>({
        eegQualitySum: 0,
        eegQualitySamples: 0,
        minEEGQuality: null,
        maxEEGQuality: null,
        badSensorsSum: 0,
        badSensorsSamples: 0,
        worstBadSensors: 0,
        timeBadSensorsCount: 0,
        sensorBadCounts: {},
        totalSamples: 0,
    });

    // EMA ref for smoothed display value
    const emaRef = useRef<number | null>(null);

    // Parse dev stream data
    const parseDevData = useCallback((data: unknown): Partial<EEGQualityPayload> | null => {
        if (!data || typeof data !== 'object') return null;

        // Dev stream can be an array or object
        // Array format: [battery, signal, ...sensorQualities, overallQuality]
        // Object format: { battery, signal, cq: [...], OVERALL: n }

        let battery = 0;
        let wirelessSignal = 0;
        let sensorValues: number[] = [];
        let eegQualityPercent: number | null = null;

        if (Array.isArray(data)) {
            const arr = data as number[];
            if (arr.length < 3) return null;

            battery = arr[0] ?? 0;
            wirelessSignal = arr[1] ?? 0;

            // Everything between index 2 and (length-1) are sensor qualities
            // The LAST value is the overall EEG quality percent
            if (arr.length > 2) {
                // Check if we have enough data for sensors + overall
                if (arr.length >= 2 + EPOC_TOTAL_SENSORS + 1) {
                    sensorValues = arr.slice(2, 2 + EPOC_TOTAL_SENSORS);
                    eegQualityPercent = arr[arr.length - 1] ?? null;

                    // Validate eegQualityPercent is in valid range
                    if (eegQualityPercent !== null && (eegQualityPercent < 0 || eegQualityPercent > 100)) {
                        console.warn('[EEGQuality] Invalid eegQualityPercent:', eegQualityPercent);
                        eegQualityPercent = null;
                    }
                } else {
                    // Shorter array - might be just overall quality
                    const lastVal = arr[arr.length - 1];
                    if (typeof lastVal === 'number' && lastVal >= 0 && lastVal <= 100) {
                        eegQualityPercent = lastVal;
                    }
                }
            }

            // Log raw payload for validation
            console.debug('[EEGQuality] Raw dev array:', {
                length: arr.length,
                battery,
                wirelessSignal,
                sensorValuesLength: sensorValues.length,
                eegQualityPercent,
                rawPayload: arr.slice(0, 20) // First 20 values for debugging
            });

        } else if (typeof data === 'object') {
            const devData = data as Record<string, unknown>;
            battery = (typeof devData.battery === 'number') ? devData.battery : 0;
            wirelessSignal = (typeof devData.signal === 'number') ? devData.signal : 0;

            // Try to get sensor contact quality array
            if (Array.isArray(devData.cq)) {
                sensorValues = devData.cq as number[];
            } else if (Array.isArray(devData.sensors)) {
                sensorValues = devData.sensors as number[];
            }

            // Get overall EEG quality percent
            if (typeof devData.OVERALL === 'number') {
                eegQualityPercent = devData.OVERALL;
            } else if (typeof devData.eegQuality === 'number') {
                eegQualityPercent = devData.eegQuality;
            } else if (typeof devData.overall === 'number') {
                eegQualityPercent = devData.overall;
            }

            console.debug('[EEGQuality] Raw dev object:', {
                battery,
                wirelessSignal,
                sensorValuesLength: sensorValues.length,
                eegQualityPercent,
                keys: Object.keys(devData)
            });
        }

        // Build per-sensor map ONLY if we have sensor values
        let perSensor: Record<string, SensorQualityInfo> | null = null;
        let badSensorsCount: number | null = null;
        let goodSensorsCount: number | null = null;

        if (sensorValues.length > 0) {
            perSensor = {};
            let badCount = 0;
            let goodCount = 0;

            for (let i = 0; i < Math.min(sensorValues.length, EPOC_SENSOR_NAMES.length); i++) {
                const rawValue = sensorValues[i];
                const normalizedValue = normalizeQualityValue(rawValue);
                const level = QUALITY_MAP[normalizedValue] ?? 'very_bad';
                const name = EPOC_SENSOR_NAMES[i];

                perSensor[name] = {
                    name,
                    rawValue: normalizedValue,
                    level,
                };

                if (normalizedValue <= BAD_SENSOR_THRESHOLD) {
                    badCount++;
                } else {
                    goodCount++;
                }
            }

            badSensorsCount = badCount;
            goodSensorsCount = goodCount;
        }

        return {
            connected: true,
            available: eegQualityPercent !== null || perSensor !== null,
            eegQualityPercent,
            totalSensors: EPOC_TOTAL_SENSORS,
            badSensorsCount,
            goodSensorsCount,
            perSensor,
            battery,
            wirelessSignal,
            lastUpdateTs: Date.now(),
        };
    }, []);

    // Process incoming stream data
    useEffect(() => {
        if (!streamData?.data) return;

        // Look for dev data in the stream
        const devData = streamData.data.dev ?? streamData.data;
        const parsed = parseDevData(devData);

        if (parsed) {
            // Get the values, defaulting undefined to null
            const eegQualityPercent = parsed.eegQualityPercent ?? null;
            const badSensorsCount = parsed.badSensorsCount ?? null;

            // Apply EMA smoothing ONLY for display
            let eegQualityPercentSmoothed: number | null = null;
            if (eegQualityPercent !== null) {
                if (emaRef.current === null) {
                    emaRef.current = eegQualityPercent;
                } else {
                    emaRef.current = DISPLAY_SMOOTHING_ALPHA * eegQualityPercent
                        + (1 - DISPLAY_SMOOTHING_ALPHA) * emaRef.current;
                }
                eegQualityPercentSmoothed = Math.round(emaRef.current);
            }

            setQuality(prev => ({
                ...prev,
                ...parsed,
                eegQualityPercent,
                badSensorsCount,
                eegQualityPercentSmoothed,
            }));

            // Update session stats with RAW values
            const stats = sessionStatsRef.current;
            stats.totalSamples++;

            // Track eegQualityPercent (RAW)
            if (eegQualityPercent !== null) {
                stats.eegQualitySum += eegQualityPercent;
                stats.eegQualitySamples++;

                if (stats.minEEGQuality === null || eegQualityPercent < stats.minEEGQuality) {
                    stats.minEEGQuality = eegQualityPercent;
                }
                if (stats.maxEEGQuality === null || eegQualityPercent > stats.maxEEGQuality) {
                    stats.maxEEGQuality = eegQualityPercent;
                }
            }

            // Track sensor counts (only if we have real data)
            if (badSensorsCount !== null) {
                stats.badSensorsSum += badSensorsCount;
                stats.badSensorsSamples++;
                stats.worstBadSensors = Math.max(stats.worstBadSensors, badSensorsCount);
                if (badSensorsCount > 0) {
                    stats.timeBadSensorsCount++;
                }
            }

            // Track per-sensor bad occurrences
            if (parsed.perSensor) {
                for (const [name, info] of Object.entries(parsed.perSensor)) {
                    if (info.rawValue <= BAD_SENSOR_THRESHOLD) {
                        stats.sensorBadCounts[name] = (stats.sensorBadCounts[name] || 0) + 1;
                    }
                }
            }
        }
    }, [streamData, parseDevData]);

    // Handle connection state
    useEffect(() => {
        if (!isConnected) {
            setQuality({
                ...DEFAULT_QUALITY,
                connected: false,
            });
            emaRef.current = null;
        }
    }, [isConnected]);

    // Build session stats
    const sessionStats: EEGQualitySession = {
        avgEEGQualityPercent: sessionStatsRef.current.eegQualitySamples > 0
            ? Math.round(sessionStatsRef.current.eegQualitySum / sessionStatsRef.current.eegQualitySamples)
            : null,
        minEEGQualityPercent: sessionStatsRef.current.minEEGQuality,
        maxEEGQualityPercent: sessionStatsRef.current.maxEEGQuality,
        avgBadSensors: sessionStatsRef.current.badSensorsSamples > 0
            ? Math.round((sessionStatsRef.current.badSensorsSum / sessionStatsRef.current.badSensorsSamples) * 10) / 10
            : null,
        worstBadSensors: sessionStatsRef.current.badSensorsSamples > 0
            ? sessionStatsRef.current.worstBadSensors
            : null,
        timeBadSensorsPct: sessionStatsRef.current.badSensorsSamples > 0
            ? Math.round((sessionStatsRef.current.timeBadSensorsCount / sessionStatsRef.current.badSensorsSamples) * 100)
            : null,
        frequentlyBadSensors: Object.entries(sessionStatsRef.current.sensorBadCounts)
            .map(([name, count]) => ({
                name,
                badPct: sessionStatsRef.current.badSensorsSamples > 0
                    ? Math.round((count / sessionStatsRef.current.badSensorsSamples) * 100)
                    : 0,
            }))
            .sort((a, b) => b.badPct - a.badPct)
            .slice(0, 3),
        samples: sessionStatsRef.current.totalSamples,
    };

    const resetSessionStats = useCallback(() => {
        sessionStatsRef.current = {
            eegQualitySum: 0,
            eegQualitySamples: 0,
            minEEGQuality: null,
            maxEEGQuality: null,
            badSensorsSum: 0,
            badSensorsSamples: 0,
            worstBadSensors: 0,
            timeBadSensorsCount: 0,
            sensorBadCounts: {},
            totalSamples: 0,
        };
        emaRef.current = null;
    }, []);

    return { quality, sessionStats, resetSessionStats };
}

// Normalize raw quality value to standard scale (0, 1, 2, 4)
function normalizeQualityValue(value: number): number {
    if (value >= 4) return 4;
    if (value >= 2) return 2;
    if (value >= 1) return 1;
    return 0;
}

export default useEEGQuality;
