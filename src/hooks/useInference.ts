/**
 * Inference Hook v2
 * 
 * Produces candidate states at 4-10Hz from POW data.
 * Handles sleep context for accurate Lucid Dreaming labeling.
 * 
 * CRITICAL: Lucid Dreaming requires confirmed sleep context.
 * Without sleep context, Theta+Gamma patterns are labeled as
 * "Dreamlike Awareness" or "Lucid-like Awareness (Awake)".
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { POWData } from './useEEGStream';

export interface CandidateState {
    id: string;
    name: string;
    confidence: number;
    timestamp: number;
    dominantBands: string[];
    color: string;
    requiresSleepContext?: boolean;
}

interface UseInferenceReturn {
    candidates: CandidateState[];
    topCandidate: CandidateState | null;
    inferenceRate: number;
}

interface StatePattern {
    dominant: string[];
    secondary?: string[];
    suppress?: string[];
}

interface StateDefinition {
    id: string;
    name: string;
    color: string;
    pattern: StatePattern;
    requiresSleepContext?: boolean;
    awakeId?: string;
    awakeName?: string;
    awakeColor?: string;
}

// State definitions with EEG patterns
const STATE_DEFINITIONS: StateDefinition[] = [
    {
        id: 'ordinary_waking',
        name: 'Ordinary Waking',
        color: '#64748b',
        pattern: { dominant: ['betaH', 'betaL'], suppress: ['theta', 'delta'] },
    },
    {
        id: 'relaxed_awareness',
        name: 'Relaxed Awareness',
        color: '#22c55e',
        pattern: { dominant: ['alpha'], suppress: ['betaH'] },
    },
    {
        id: 'deep_relaxation',
        name: 'Deep Relaxation',
        color: '#14b8a6',
        pattern: { dominant: ['alpha', 'theta'], suppress: ['betaH', 'betaL'] },
    },
    {
        id: 'inner_sound',
        name: 'Inner Sound',
        color: '#8b5cf6',
        pattern: { dominant: ['alpha', 'theta'], secondary: ['gamma'] },
    },
    {
        id: 'hypnagogic',
        name: 'Hypnagogic',
        color: '#6366f1',
        pattern: { dominant: ['theta'], suppress: ['betaH', 'alpha'] },
    },
    {
        id: 'obe',
        name: 'Out-of-Body',
        color: '#a855f7',
        pattern: { dominant: ['theta'], secondary: ['gamma'], suppress: ['betaL'] },
    },
    // LUCID DREAMING - Requires sleep context
    // When awake, this pattern becomes "Dreamlike Awareness"
    {
        id: 'lucid_dreaming',
        name: 'Lucid Dreaming',
        color: '#ec4899',
        pattern: { dominant: ['theta', 'gamma'], suppress: ['alpha'] },
        requiresSleepContext: true,
        awakeId: 'lucid_like_awake',
        awakeName: 'Dreamlike Awareness',
        awakeColor: '#f472b6',
    },
    {
        id: 'bliss_ecstatic',
        name: 'Bliss / Ecstatic',
        color: '#f59e0b',
        pattern: { dominant: ['alpha', 'gamma'], suppress: ['betaH'] },
    },
    {
        id: 'samadhi',
        name: 'Samadhi',
        color: '#fbbf24',
        pattern: { dominant: ['gamma'], suppress: ['betaH', 'betaL'] },
    },
    {
        id: 'transcendent_meta',
        name: 'Transcendent',
        color: '#ffffff',
        pattern: { dominant: ['gamma'], secondary: ['alpha', 'theta'], suppress: ['betaH', 'betaL'] },
    },
];

const INFERENCE_INTERVAL = 150; // ~6.7 Hz

export function useInference(
    pow: POWData | null,
    _met: { engagement?: number; stress?: number; relaxation?: number; focus?: number } | null,
    isSleepMode: boolean = false // Default: user is awake
): UseInferenceReturn {
    const [candidates, setCandidates] = useState<CandidateState[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastPowRef = useRef<POWData | null>(null);
    const isSleepModeRef = useRef(isSleepMode);
    const inferenceCountRef = useRef(0);
    const rateWindowStartRef = useRef(Date.now());
    const inferenceRateRef = useRef(0);

    // Update refs
    useEffect(() => {
        lastPowRef.current = pow;
    }, [pow]);

    useEffect(() => {
        isSleepModeRef.current = isSleepMode;
    }, [isSleepMode]);

    // Score a state based on POW data
    const scoreState = useCallback((
        state: StateDefinition,
        powData: POWData
    ): number => {
        let score = 0;

        const bands: Record<string, number> = {
            delta: powData.delta,
            theta: powData.theta,
            alpha: powData.alpha,
            betaL: powData.betaL,
            betaH: powData.betaH,
            gamma: powData.gamma,
        };

        const sortedBands = Object.entries(bands).sort((a, b) => b[1] - a[1]);
        const topBandNames = sortedBands.slice(0, 2).map(b => b[0]);

        // Dominant band scoring (50 points max)
        for (const dominant of state.pattern.dominant) {
            if (topBandNames.includes(dominant)) {
                score += 25 * bands[dominant];
            } else {
                score += 10 * bands[dominant];
            }
        }

        // Secondary band scoring (20 points max)
        if (state.pattern.secondary) {
            for (const secondary of state.pattern.secondary) {
                if (bands[secondary] > 0.2) {
                    score += 10 * bands[secondary];
                }
            }
        }

        // Suppressed band scoring (30 points max - bonus for low values)
        if (state.pattern.suppress) {
            for (const suppressed of state.pattern.suppress) {
                if (bands[suppressed] < 0.3) {
                    score += 15 * (1 - bands[suppressed]);
                }
            }
        }

        return Math.min(100, Math.max(0, score));
    }, []);

    // Check if "lucid" pattern but user is awake (Beta not fully suppressed)
    const checkAwakeLucidPattern = useCallback((powData: POWData): boolean => {
        // If Beta is still present (not fully suppressed), user is likely awake
        const betaPresent = powData.betaL > 0.15 || powData.betaH > 0.12;
        return betaPresent;
    }, []);

    // Get dominant bands from POW
    const getDominantBands = useCallback((powData: POWData): string[] => {
        const bands = [
            { name: 'Theta', value: powData.theta },
            { name: 'Alpha', value: powData.alpha },
            { name: 'Beta-L', value: powData.betaL },
            { name: 'Beta-H', value: powData.betaH },
            { name: 'Gamma', value: powData.gamma },
        ];
        bands.sort((a, b) => b.value - a.value);
        return bands.slice(0, 2).map(b => b.name);
    }, []);

    // Run inference at fixed interval
    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const powData = lastPowRef.current;
            if (!powData) return;

            const now = Date.now();
            const sleepMode = isSleepModeRef.current;
            const awakeLucidPattern = checkAwakeLucidPattern(powData);

            // Track inference rate
            inferenceCountRef.current++;
            const elapsed = now - rateWindowStartRef.current;
            if (elapsed >= 1000) {
                inferenceRateRef.current = inferenceCountRef.current / (elapsed / 1000);
                inferenceCountRef.current = 0;
                rateWindowStartRef.current = now;
            }

            // Score all states
            const scored = STATE_DEFINITIONS.map(state => {
                const baseScore = scoreState(state, powData);

                // Handle sleep-context states
                let id = state.id;
                let name = state.name;
                let color = state.color;
                let requiresSleepContext = state.requiresSleepContext;

                // If this state requires sleep context but user is awake
                if (state.requiresSleepContext && !sleepMode) {
                    // Check if the pattern is detected (high score)
                    if (baseScore > 40) {
                        // Relabel to awake variant
                        if (state.awakeId && state.awakeName) {
                            id = state.awakeId;
                            name = state.awakeName;
                            color = state.awakeColor || state.color;
                            requiresSleepContext = false;

                            // Additional check: if Beta is present, it's definitely awake
                            if (awakeLucidPattern) {
                                name = 'Dreamlike Awareness';
                            }
                        }
                    }
                }

                return {
                    id,
                    name,
                    color,
                    confidence: baseScore,
                    timestamp: now,
                    dominantBands: getDominantBands(powData),
                    requiresSleepContext,
                };
            });

            // Sort by confidence descending
            scored.sort((a, b) => b.confidence - a.confidence);

            setCandidates(scored);
        }, INFERENCE_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [scoreState, getDominantBands, checkAwakeLucidPattern]);

    return {
        candidates,
        topCandidate: candidates[0] || null,
        inferenceRate: inferenceRateRef.current,
    };
}
