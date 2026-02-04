/**
 * Display Stabilizer Hook v2
 * 
 * Stricter locking rules for stable UI:
 * - Current state: 4s min hold, 2s to replace
 * - Challenger: appears on close race OR strong contender
 * - Transition labels based on gap analysis
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CandidateState } from './useInference';

export type TransitionStatus = 'STABILIZING' | 'TRANSITION' | 'HOLDING';

export interface DisplayState {
    id: string;
    name: string;
    confidence: number;
    color: string;
    lockedSince: number;
    dominantBands: string[];
}

export interface ChallengerState {
    id: string;
    name: string;
    confidence: number;
    color: string;
    dominantBands: string[];
    appearTime: number;
}

export interface DisplayModel {
    currentState: DisplayState;
    transitionStatus: TransitionStatus;
    challenger: ChallengerState | null;
    debug: {
        timeSinceLock: number;
        challengerPersistMs: number;
        confidenceGap: number;
        lastSampleAge: number;
    };
}

// Configuration - Stricter locking
const CONFIG = {
    UPDATE_INTERVAL: 300,           // ~3.3Hz display updates

    // Current state locking
    MIN_CURRENT_HOLD_MS: 4000,      // 4s minimum before current can change
    REPLACE_REQUIRES_MS: 2000,      // New winner must lead for 2s to replace

    // Challenger display rules
    CHALLENGER_CLOSE_RACE_CONF: 0.35,    // Min confidence for close race
    CHALLENGER_CLOSE_RACE_GAP: 0.12,     // Max gap for close race
    CHALLENGER_CLOSE_RACE_PERSIST: 600,  // Ms to persist for close race
    CHALLENGER_STRONG_CONF: 0.50,        // Min confidence for strong contender
    CHALLENGER_STRONG_PERSIST: 400,      // Ms to persist for strong contender
    MIN_CHALLENGER_HOLD_MS: 800,         // Once shown, hold for this long

    // EMA smoothing
    EMA_ALPHA: 0.25,

    // Sample freshness
    SAMPLE_STALE_MS: 1500,
};

const DEFAULT_STATE: DisplayState = {
    id: 'ordinary_waking',
    name: 'Ordinary Waking',
    confidence: 50,
    color: '#64748b',
    lockedSince: Date.now(),
    dominantBands: ['Beta-H', 'Beta-L'],
};

export function useDisplayStabilizer(
    candidates: CandidateState[],
    lastSampleTs: number
): DisplayModel {
    const [displayModel, setDisplayModel] = useState<DisplayModel>({
        currentState: DEFAULT_STATE,
        transitionStatus: 'STABILIZING',
        challenger: null,
        debug: { timeSinceLock: 0, challengerPersistMs: 0, confidenceGap: 0, lastSampleAge: 0 },
    });

    // Refs for tracking without re-renders
    const emaValuesRef = useRef<Record<string, number>>({});
    const currentStateIdRef = useRef('ordinary_waking');
    const currentLockedAtRef = useRef(Date.now());
    const winnerStreakRef = useRef<{ id: string; startTime: number } | null>(null);
    const challengerRef = useRef<{ id: string; startTime: number } | null>(null);
    const challengerVisibleSinceRef = useRef<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const candidatesRef = useRef<CandidateState[]>([]);
    const lastSampleTsRef = useRef(lastSampleTs);

    // Update refs
    useEffect(() => {
        candidatesRef.current = candidates;
    }, [candidates]);

    useEffect(() => {
        lastSampleTsRef.current = lastSampleTs;
    }, [lastSampleTs]);

    // EMA smoothing
    const applyEMA = useCallback((stateId: string, rawValue: number): number => {
        const current = emaValuesRef.current[stateId] ?? rawValue;
        const smoothed = current + CONFIG.EMA_ALPHA * (rawValue - current);
        emaValuesRef.current[stateId] = smoothed;
        return smoothed;
    }, []);

    // Main stabilizer loop
    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const currentCandidates = candidatesRef.current;
            const sampleTs = lastSampleTsRef.current;

            if (currentCandidates.length === 0) return;

            // Check sample freshness
            const sampleAge = now - sampleTs;
            const isStale = sampleAge > CONFIG.SAMPLE_STALE_MS;

            // Apply EMA to all candidates
            const smoothed = currentCandidates.map(c => ({
                ...c,
                confidence: applyEMA(c.id, c.confidence / 100), // Normalize to 0-1
            }));

            // Sort by smoothed confidence
            smoothed.sort((a, b) => b.confidence - a.confidence);
            const top1 = smoothed[0];
            const top2 = smoothed[1] || null;

            // ============================================
            // CURRENT STATE LOCKING LOGIC
            // ============================================

            const timeSinceLock = now - currentLockedAtRef.current;
            let newCurrentState = displayModel.currentState;

            // Track winner streak for replacement
            if (top1.id !== currentStateIdRef.current) {
                // Different winner emerged
                if (!winnerStreakRef.current || winnerStreakRef.current.id !== top1.id) {
                    winnerStreakRef.current = { id: top1.id, startTime: now };
                }

                const streakDuration = now - winnerStreakRef.current.startTime;

                // Can only replace if:
                // 1. Min hold time passed
                // 2. New winner has led for REPLACE_REQUIRES_MS
                if (
                    timeSinceLock >= CONFIG.MIN_CURRENT_HOLD_MS &&
                    streakDuration >= CONFIG.REPLACE_REQUIRES_MS
                ) {
                    newCurrentState = {
                        id: top1.id,
                        name: top1.name,
                        confidence: Math.round(top1.confidence * 100),
                        color: top1.color,
                        lockedSince: now,
                        dominantBands: top1.dominantBands,
                    };
                    currentStateIdRef.current = top1.id;
                    currentLockedAtRef.current = now;
                    winnerStreakRef.current = null;
                }
            } else {
                // Current state is still winning
                winnerStreakRef.current = null;

                // Update confidence without changing identity
                newCurrentState = {
                    ...displayModel.currentState,
                    confidence: Math.round(top1.confidence * 100),
                    dominantBands: top1.dominantBands,
                };
            }

            // ============================================
            // CHALLENGER DISPLAY LOGIC
            // ============================================

            let newChallenger: ChallengerState | null = null;
            let challengerPersistMs = 0;

            if (top2 && top2.id !== currentStateIdRef.current) {
                const gap = Math.abs(top1.confidence - top2.confidence);

                // Track challenger persistence
                if (!challengerRef.current || challengerRef.current.id !== top2.id) {
                    challengerRef.current = { id: top2.id, startTime: now };
                }
                const persistMs = now - challengerRef.current.startTime;
                challengerPersistMs = persistMs;

                // Check Condition A: Close race
                const isCloseRace =
                    top2.confidence >= CONFIG.CHALLENGER_CLOSE_RACE_CONF &&
                    gap <= CONFIG.CHALLENGER_CLOSE_RACE_GAP &&
                    persistMs >= CONFIG.CHALLENGER_CLOSE_RACE_PERSIST;

                // Check Condition B: Strong contender
                const isStrongContender =
                    top2.confidence >= CONFIG.CHALLENGER_STRONG_CONF &&
                    persistMs >= CONFIG.CHALLENGER_STRONG_PERSIST;

                if (isCloseRace || isStrongContender) {
                    newChallenger = {
                        id: top2.id,
                        name: top2.name,
                        confidence: Math.round(top2.confidence * 100),
                        color: top2.color,
                        dominantBands: top2.dominantBands,
                        appearTime: challengerVisibleSinceRef.current || now,
                    };

                    if (!challengerVisibleSinceRef.current) {
                        challengerVisibleSinceRef.current = now;
                    }
                }
            } else {
                challengerRef.current = null;
            }

            // Challenger hold: keep visible for MIN_CHALLENGER_HOLD_MS once shown
            if (!newChallenger && challengerVisibleSinceRef.current) {
                const visibleDuration = now - challengerVisibleSinceRef.current;
                if (visibleDuration < CONFIG.MIN_CHALLENGER_HOLD_MS && displayModel.challenger) {
                    // Keep showing the previous challenger
                    newChallenger = displayModel.challenger;
                } else {
                    // Clear
                    challengerVisibleSinceRef.current = null;
                }
            }

            // ============================================
            // TRANSITION STATUS
            // ============================================

            let transitionStatus: TransitionStatus = 'STABILIZING';

            if (isStale) {
                transitionStatus = 'HOLDING';
            } else if (newChallenger) {
                const gap = (newCurrentState.confidence - newChallenger.confidence) / 100;
                transitionStatus = gap > 0.15 ? 'STABILIZING' : 'TRANSITION';
            }

            // ============================================
            // UPDATE DISPLAY MODEL
            // ============================================

            setDisplayModel({
                currentState: newCurrentState,
                transitionStatus,
                challenger: newChallenger,
                debug: {
                    timeSinceLock: Math.round(timeSinceLock / 1000),
                    challengerPersistMs: Math.round(challengerPersistMs),
                    confidenceGap: top2 ? Math.round((top1.confidence - top2.confidence) * 100) : 0,
                    lastSampleAge: Math.round(sampleAge),
                },
            });
        }, CONFIG.UPDATE_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [applyEMA, displayModel.currentState, displayModel.challenger]);

    return displayModel;
}
