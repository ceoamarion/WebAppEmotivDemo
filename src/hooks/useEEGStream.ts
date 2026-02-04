/**
 * EEG Stream Hook
 * 
 * Manages raw stream data with last-known-good preservation.
 * POW values are held for up to 1500ms if samples drop.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface POWData {
    theta: number;
    alpha: number;
    betaL: number;
    betaH: number;
    gamma: number;
    delta: number;
}

export interface EEGStreamData {
    pow: POWData | null;
    met: {
        engagement: number;
        stress: number;
        relaxation: number;
        focus: number;
    } | null;
    motion: number;
    timestamp: number;
}

interface UseEEGStreamReturn {
    latestPOW: POWData;
    latestMET: EEGStreamData['met'];
    lastSampleTs: number;
    isStale: boolean;
    sampleRate: number;
}

const DEFAULT_POW: POWData = {
    theta: 0,
    alpha: 0,
    betaL: 0,
    betaH: 0,
    gamma: 0,
    delta: 0,
};

const POW_HOLD_DURATION = 1500; // Hold last good POW for 1.5s

export function useEEGStream(
    streamData: { data: Record<string, unknown> | null; stream: string } | null
): UseEEGStreamReturn {
    // Last known good values - kept stable
    const [stablePOW, setStablePOW] = useState<POWData>(DEFAULT_POW);
    const [stableMET, setStableMET] = useState<EEGStreamData['met']>(null);
    const [lastSampleTs, setLastSampleTs] = useState(0);
    const [isStale, setIsStale] = useState(true);

    // Refs for tracking without re-renders
    const lastGoodPowTimeRef = useRef(0);
    const sampleCountRef = useRef(0);
    const sampleRateRef = useRef(0);
    const rateWindowStartRef = useRef(Date.now());

    // Parse POW data from stream
    const parsePOW = useCallback((data: unknown): POWData | null => {
        if (!data || !Array.isArray(data)) return null;

        const pow = data as number[];
        let bands: number[];

        if (Array.isArray(pow[0])) {
            // 2D array: average each band
            bands = (pow as unknown as number[][]).map(arr =>
                arr.reduce((a, b) => a + b, 0) / arr.length
            );
        } else {
            // Flat array: split into 5 bands
            const numBands = 5;
            const valuesPerBand = Math.floor(pow.length / numBands);
            bands = [
                average(pow.slice(0, valuesPerBand)),
                average(pow.slice(valuesPerBand, valuesPerBand * 2)),
                average(pow.slice(valuesPerBand * 2, valuesPerBand * 3)),
                average(pow.slice(valuesPerBand * 3, valuesPerBand * 4)),
                average(pow.slice(valuesPerBand * 4)),
            ];
        }

        // Normalize to 0-1 range
        const maxVal = Math.max(...bands, 0.001);
        const normalized = bands.map(b => Math.min(1, Math.max(0, b / maxVal)));

        return {
            theta: normalized[0] || 0,
            alpha: normalized[1] || 0,
            betaL: normalized[2] || 0,
            betaH: normalized[3] || 0,
            gamma: normalized[4] || 0,
            delta: 0.1, // POW typically doesn't include delta
        };
    }, []);

    // Parse MET data from stream
    const parseMET = useCallback((data: unknown): EEGStreamData['met'] | null => {
        if (!data || !Array.isArray(data)) return null;
        const met = data as number[];
        return {
            engagement: met[0] || 0,
            stress: met[3] || 0,
            relaxation: met[4] || 0,
            focus: met[6] || 0,
        };
    }, []);

    // Process incoming stream data
    useEffect(() => {
        if (!streamData?.data) return;

        const now = Date.now();

        // Track sample rate
        sampleCountRef.current++;
        const elapsed = now - rateWindowStartRef.current;
        if (elapsed >= 1000) {
            sampleRateRef.current = sampleCountRef.current / (elapsed / 1000);
            sampleCountRef.current = 0;
            rateWindowStartRef.current = now;
        }

        // Parse POW
        const powData = streamData.data.pow;
        if (powData) {
            const parsed = parsePOW(powData);
            if (parsed) {
                setStablePOW(parsed);
                lastGoodPowTimeRef.current = now;
                setLastSampleTs(now);
                setIsStale(false);
            }
        }

        // Parse MET
        const metData = streamData.data.met;
        if (metData) {
            const parsed = parseMET(metData);
            if (parsed) {
                setStableMET(parsed);
                setLastSampleTs(now);
                setIsStale(false);
            }
        }
    }, [streamData, parsePOW, parseMET]);

    // Check for stale data periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastPow = now - lastGoodPowTimeRef.current;

            // Mark as stale after hold duration, but DON'T clear the values
            if (timeSinceLastPow > POW_HOLD_DURATION && lastGoodPowTimeRef.current > 0) {
                setIsStale(true);
            }
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return {
        latestPOW: stablePOW,
        latestMET: stableMET,
        lastSampleTs,
        isStale,
        sampleRate: sampleRateRef.current,
    };
}

function average(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
