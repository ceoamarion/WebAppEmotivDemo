/**
 * Stable Data Store Hook
 * 
 * Maintains last-known values for band power and metrics.
 * Applies EMA smoothing to reduce jitter.
 * Never loses data on temporary connection drops.
 * 
 * Features:
 * - Caches last-known values for all data types
 * - EMA smoothing (alpha configurable)
 * - Stale detection with timestamps
 * - Dominant band anti-flip (1.5s debounce)
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { POWData } from './useEEGStream';

// ================================
// TYPES
// ================================

export interface SmoothedPOWData extends POWData {
    isStale: boolean;
    lastUpdatedAt: number;
    dominantBand: string;
    dominantBandStable: string;  // Debounced dominant band
}

export interface StableDataStore {
    // Band power (smoothed)
    bandPower: SmoothedPOWData;

    // Raw vs smoothed
    rawBandPower: POWData | null;

    // Performance metrics (smoothed)
    metrics: {
        stress: number;
        relaxation: number;
        engagement: number;
        focus: number;
        interest: number;
        excitement: number;
        isStale: boolean;
        lastUpdatedAt: number;
    };

    // Quality
    quality: {
        eegQualityPercent: number | null;
        badSensorsCount: number | null;
        goodSensorsCount: number | null;
        totalSensors: number;
        isStale: boolean;
        lastUpdatedAt: number;
        source: 'stream' | 'unavailable';
    };

    // Status
    isDataStale: boolean;
    lastAnyUpdateAt: number;
}

// ================================
// CONSTANTS
// ================================

const EMA_ALPHA = 0.2;  // Smoothing factor (lower = smoother, higher = more responsive)
const STALE_THRESHOLD_MS = 3000;  // Data considered stale after 3 seconds
const DOMINANT_BAND_DEBOUNCE_MS = 1500;  // Require 1.5s before switching dominant band

const DEFAULT_POW: SmoothedPOWData = {
    theta: 0,
    alpha: 0,
    betaL: 0,
    betaH: 0,
    gamma: 0,
    delta: 0,
    isStale: true,
    lastUpdatedAt: 0,
    dominantBand: 'none',
    dominantBandStable: 'none',
};

const DEFAULT_METRICS = {
    stress: 0,
    relaxation: 0,
    engagement: 0,
    focus: 0,
    interest: 0,
    excitement: 0,
    isStale: true,
    lastUpdatedAt: 0,
};

const DEFAULT_QUALITY = {
    eegQualityPercent: null,
    badSensorsCount: null,
    goodSensorsCount: null,
    totalSensors: 14,
    isStale: true,
    lastUpdatedAt: 0,
    source: 'unavailable' as const,
};

// ================================
// HELPERS
// ================================

function ema(newValue: number, oldValue: number, alpha: number = EMA_ALPHA): number {
    if (oldValue === 0) return newValue;  // First value
    return alpha * newValue + (1 - alpha) * oldValue;
}

function getDominantBand(pow: POWData): string {
    const bands = [
        { name: 'theta', value: pow.theta },
        { name: 'alpha', value: pow.alpha },
        { name: 'betaL', value: pow.betaL },
        { name: 'betaH', value: pow.betaH },
        { name: 'gamma', value: pow.gamma },
    ];

    const sorted = bands.sort((a, b) => b.value - a.value);
    return sorted[0]?.value > 0 ? sorted[0].name : 'none';
}

// ================================
// HOOK
// ================================

export function useStableDataStore(
    latestPOW: POWData | null,
    latestMET: Record<string, number> | null,
    eegQuality: {
        eegQualityPercent: number | null;
        badSensorsCount: number | null;
        goodSensorsCount: number | null;
        totalSensors: number;
        available: boolean;
    } | null
): StableDataStore {
    // Smoothed band power state
    const [bandPower, setBandPower] = useState<SmoothedPOWData>(DEFAULT_POW);
    const [rawBandPower, setRawBandPower] = useState<POWData | null>(null);

    // Metrics state
    const [metrics, setMetrics] = useState(DEFAULT_METRICS);

    // Quality state
    const [quality, setQuality] = useState<StableDataStore['quality']>(DEFAULT_QUALITY);

    // Dominant band debounce
    const dominantBandCandidateRef = useRef<{ band: string; since: number }>({ band: 'none', since: 0 });

    // Track when we last got any update
    const lastAnyUpdateRef = useRef<number>(0);

    // Update band power with EMA smoothing
    useEffect(() => {
        if (!latestPOW) return;

        const now = Date.now();
        lastAnyUpdateRef.current = now;
        setRawBandPower(latestPOW);

        setBandPower(prev => {
            // Apply EMA smoothing
            const smoothed: SmoothedPOWData = {
                theta: ema(latestPOW.theta, prev.theta),
                alpha: ema(latestPOW.alpha, prev.alpha),
                betaL: ema(latestPOW.betaL, prev.betaL),
                betaH: ema(latestPOW.betaH, prev.betaH),
                gamma: ema(latestPOW.gamma, prev.gamma),
                delta: ema(latestPOW.delta, prev.delta),
                isStale: false,
                lastUpdatedAt: now,
                dominantBand: getDominantBand(latestPOW),
                dominantBandStable: prev.dominantBandStable,
            };

            // Debounce dominant band changes
            const newDominant = smoothed.dominantBand;
            if (newDominant !== dominantBandCandidateRef.current.band) {
                dominantBandCandidateRef.current = { band: newDominant, since: now };
            } else if (now - dominantBandCandidateRef.current.since >= DOMINANT_BAND_DEBOUNCE_MS) {
                smoothed.dominantBandStable = newDominant;
            }

            return smoothed;
        });
    }, [latestPOW]);

    // Update metrics with EMA smoothing
    useEffect(() => {
        if (!latestMET) return;

        const now = Date.now();
        lastAnyUpdateRef.current = now;

        setMetrics(prev => ({
            stress: ema(latestMET.str ?? latestMET.stress ?? 0, prev.stress),
            relaxation: ema(latestMET.rel ?? latestMET.relaxation ?? 0, prev.relaxation),
            engagement: ema(latestMET.eng ?? latestMET.engagement ?? 0, prev.engagement),
            focus: ema(latestMET.foc ?? latestMET.focus ?? 0, prev.focus),
            interest: ema(latestMET.int ?? latestMET.interest ?? 0, prev.interest),
            excitement: ema(latestMET.exc ?? latestMET.excitement ?? 0, prev.excitement),
            isStale: false,
            lastUpdatedAt: now,
        }));
    }, [latestMET]);

    // Update quality
    useEffect(() => {
        if (!eegQuality) return;

        const now = Date.now();
        lastAnyUpdateRef.current = now;

        setQuality({
            eegQualityPercent: eegQuality.eegQualityPercent,
            badSensorsCount: eegQuality.badSensorsCount,
            goodSensorsCount: eegQuality.goodSensorsCount,
            totalSensors: eegQuality.totalSensors,
            isStale: false,
            lastUpdatedAt: now,
            source: eegQuality.available ? 'stream' : 'unavailable',
        });
    }, [eegQuality]);

    // Periodic stale check
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();

            setBandPower(prev => {
                if (!prev.isStale && now - prev.lastUpdatedAt > STALE_THRESHOLD_MS) {
                    return { ...prev, isStale: true };
                }
                return prev;
            });

            setMetrics(prev => {
                if (!prev.isStale && now - prev.lastUpdatedAt > STALE_THRESHOLD_MS) {
                    return { ...prev, isStale: true };
                }
                return prev;
            });

            setQuality(prev => {
                if (!prev.isStale && now - prev.lastUpdatedAt > STALE_THRESHOLD_MS) {
                    return { ...prev, isStale: true };
                }
                return prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Compute overall stale status
    const isDataStale = useMemo(() => {
        return bandPower.isStale && metrics.isStale;
    }, [bandPower.isStale, metrics.isStale]);

    return {
        bandPower,
        rawBandPower,
        metrics,
        quality,
        isDataStale,
        lastAnyUpdateAt: lastAnyUpdateRef.current,
    };
}

export default useStableDataStore;
