/**
 * Unified State Model
 * 
 * SINGLE SOURCE OF TRUTH for all state data.
 * Duration, tier, stability, and emotion all belong to the state object.
 * No separate timers or HUDs allowed.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CandidateState } from './useInference';
import { EmotionResult, EmotionAxes, TopEmotion } from './useEmotionInference';

// Validation tier
export type ValidationTier = 'detected' | 'candidate' | 'confirmed' | 'locked';

// Stability status
export type StabilityStatus = 'stable' | 'unstable' | 'transitioning';

// State category for thresholds
type StateCategory = 'ordinary' | 'alpha_relaxed' | 'theta_meditative' | 'lucid_like' | 'gamma_peak' | 'transcendent';

// Duration thresholds per category (ms)
interface DurationThresholds {
    detected: number;
    candidate: number;
    confirmed: number;
    locked: number;
}

const STATE_THRESHOLDS: Record<StateCategory, DurationThresholds> = {
    ordinary: { detected: 3000, candidate: 8000, confirmed: 15000, locked: 30000 },
    alpha_relaxed: { detected: 5000, candidate: 15000, confirmed: 30000, locked: 120000 },
    theta_meditative: { detected: 5000, candidate: 20000, confirmed: 60000, locked: 150000 },
    lucid_like: { detected: 10000, candidate: 30000, confirmed: 60000, locked: 180000 },
    gamma_peak: { detected: 3000, candidate: 15000, confirmed: 45000, locked: 120000 },
    transcendent: { detected: 10000, candidate: 30000, confirmed: 120000, locked: 300000 },
};

// Map state IDs to categories
function getStateCategory(stateId: string): StateCategory {
    const map: Record<string, StateCategory> = {
        'ordinary_waking': 'ordinary',
        'relaxed_awareness': 'alpha_relaxed',
        'deep_relaxation': 'alpha_relaxed',
        'inner_sound': 'theta_meditative',
        'hypnagogic': 'theta_meditative',
        'obe': 'theta_meditative',
        'lucid_dreaming': 'lucid_like',
        'lucid_like_awake': 'lucid_like',
        'bliss_ecstatic': 'gamma_peak',
        'samadhi': 'transcendent',
        'transcendent_meta': 'transcendent',
    };
    return map[stateId] || 'ordinary';
}

/**
 * UNIFIED STATE OBJECT
 * The single source of truth for all state data.
 */
export interface UnifiedState {
    // Core identity
    id: string;
    name: string;
    color: string;
    dominantBands: string[];

    // Timing (SINGLE SOURCE OF TRUTH)
    startTime: number;        // Set ONCE when state enters Detected
    durationMs: number;       // now - startTime
    durationFormatted: string; // "mm:ss" format

    // Validation tier
    tier: ValidationTier;
    tierLabel: string;

    // Progress to next tier
    nextTier: ValidationTier | null;
    progressPercent: number;
    timeToNextMs: number;

    // Confidence
    rawConfidence: number;
    adjustedConfidence: number; // Modified by duration

    // Stability
    variance: number;
    stabilityStatus: StabilityStatus;
    isStable: boolean;

    // Emotion (belongs to THIS state)
    emotionAxes: EmotionAxes;
    topEmotions: TopEmotion[];
    isEmotionallyStable: boolean;
    emotionNote: string;
}

export interface ChallengerState {
    id: string;
    name: string;
    color: string;
    confidence: number;
    dominantBands: string[];
    // Challengers do NOT have duration until promoted
}

export interface UnifiedDisplayModel {
    currentState: UnifiedState;
    challenger: ChallengerState | null;
    transitionLabel: string;
}

// Config
const CONFIG = {
    UPDATE_INTERVAL: 250,
    MIN_CURRENT_HOLD_MS: 4000,
    REPLACE_REQUIRES_MS: 2000,
    VARIANCE_WINDOW: 20,
    VARIANCE_UNSTABLE_THRESHOLD: 15,
    EMA_ALPHA: 0.25,
};

export function useUnifiedState(
    candidates: CandidateState[],
    emotionResult: EmotionResult,
    lastSampleTs: number
): UnifiedDisplayModel {
    // Single state tracking
    const currentStateRef = useRef<{
        id: string;
        startTime: number;
        lockedAt: number;
        confidenceHistory: number[];
    }>({
        id: 'ordinary_waking',
        startTime: Date.now(),
        lockedAt: Date.now(),
        confidenceHistory: [],
    });

    const emaValuesRef = useRef<Record<string, number>>({});
    const winnerStreakRef = useRef<{ id: string; startTime: number } | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const candidatesRef = useRef<CandidateState[]>([]);
    const emotionRef = useRef<EmotionResult>(emotionResult);

    const [model, setModel] = useState<UnifiedDisplayModel>({
        currentState: createDefaultUnifiedState(),
        challenger: null,
        transitionLabel: 'Initializing',
    });

    // Update refs
    useEffect(() => { candidatesRef.current = candidates; }, [candidates]);
    useEffect(() => { emotionRef.current = emotionResult; }, [emotionResult]);

    // Format duration as mm:ss
    const formatDuration = useCallback((ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Calculate variance
    const calculateVariance = useCallback((values: number[]): number => {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }, []);

    // Apply EMA smoothing
    const applyEMA = useCallback((stateId: string, rawValue: number): number => {
        const current = emaValuesRef.current[stateId] ?? rawValue;
        const smoothed = current + CONFIG.EMA_ALPHA * (rawValue - current);
        emaValuesRef.current[stateId] = smoothed;
        return smoothed;
    }, []);

    // Get tier from duration
    const getTier = useCallback((durationMs: number, thresholds: DurationThresholds, isStable: boolean): ValidationTier => {
        // Check locked first (requires stability)
        if (durationMs >= thresholds.locked && isStable) return 'locked';
        if (durationMs >= thresholds.confirmed) return 'confirmed';
        if (durationMs >= thresholds.candidate) return 'candidate';
        return 'detected';
    }, []);

    // Main update loop
    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const currentCandidates = candidatesRef.current;
            const emotion = emotionRef.current;

            if (currentCandidates.length === 0) return;

            // Smooth candidates
            const smoothed = currentCandidates.map(c => ({
                ...c,
                confidence: applyEMA(c.id, c.confidence / 100) * 100,
            }));
            smoothed.sort((a, b) => b.confidence - a.confidence);

            const top1 = smoothed[0];
            const top2 = smoothed[1] || null;
            const stateTrack = currentStateRef.current;
            const timeSinceLock = now - stateTrack.lockedAt;

            // === STATE CHANGE LOGIC ===
            let stateChanged = false;

            if (top1.id !== stateTrack.id) {
                // Different winner
                if (!winnerStreakRef.current || winnerStreakRef.current.id !== top1.id) {
                    winnerStreakRef.current = { id: top1.id, startTime: now };
                }

                const streakDuration = now - winnerStreakRef.current.startTime;

                // Can replace if:
                // 1. Min hold time passed
                // 2. New winner led for REPLACE_REQUIRES_MS
                if (timeSinceLock >= CONFIG.MIN_CURRENT_HOLD_MS && streakDuration >= CONFIG.REPLACE_REQUIRES_MS) {
                    // STATE CHANGES - Reset startTime for NEW state
                    stateTrack.id = top1.id;
                    stateTrack.startTime = now; // SINGLE source: startTime set HERE
                    stateTrack.lockedAt = now;
                    stateTrack.confidenceHistory = [];
                    winnerStreakRef.current = null;
                    stateChanged = true;
                }
            } else {
                // Same state - track confidence history
                winnerStreakRef.current = null;
                stateTrack.confidenceHistory.push(top1.confidence);
                if (stateTrack.confidenceHistory.length > CONFIG.VARIANCE_WINDOW) {
                    stateTrack.confidenceHistory.shift();
                }
            }

            // === BUILD UNIFIED STATE ===
            const durationMs = now - stateTrack.startTime;
            const variance = calculateVariance(stateTrack.confidenceHistory);
            const isVarianceStable = variance < CONFIG.VARIANCE_UNSTABLE_THRESHOLD;

            // Emotional stability check
            const isEmotionallyStable = !emotion.isTranscendenceUnstable &&
                emotion.axes.valence > -0.3 &&
                emotion.axes.control > 0.3;

            const isStable = isVarianceStable && isEmotionallyStable;

            // Get thresholds and tier
            const category = getStateCategory(top1.id);
            const thresholds = STATE_THRESHOLDS[category];
            const tier = getTier(durationMs, thresholds, isStable);

            // Determine stability status
            let stabilityStatus: StabilityStatus = 'stable';
            if (!isStable) {
                stabilityStatus = 'unstable';
            } else if (tier === 'detected' || tier === 'candidate') {
                stabilityStatus = 'transitioning';
            }

            // Progress to next tier
            let nextTier: ValidationTier | null = null;
            let progressPercent = 100;
            let timeToNextMs = 0;

            if (tier === 'detected') {
                nextTier = 'candidate';
                progressPercent = Math.min(100, (durationMs / thresholds.candidate) * 100);
                timeToNextMs = Math.max(0, thresholds.candidate - durationMs);
            } else if (tier === 'candidate') {
                nextTier = 'confirmed';
                progressPercent = Math.min(100, (durationMs / thresholds.confirmed) * 100);
                timeToNextMs = Math.max(0, thresholds.confirmed - durationMs);
            } else if (tier === 'confirmed') {
                nextTier = 'locked';
                progressPercent = Math.min(100, (durationMs / thresholds.locked) * 100);
                timeToNextMs = Math.max(0, thresholds.locked - durationMs);
            }

            // Adjust confidence by duration
            const durationFactor = Math.min(1, durationMs / thresholds.confirmed);
            const adjustedConfidence = Math.round(top1.confidence * (0.5 + 0.5 * durationFactor));

            // Tier labels
            const tierLabels: Record<ValidationTier, string> = {
                detected: 'Detected',
                candidate: 'Candidate',
                confirmed: 'Confirmed',
                locked: 'Locked',
            };

            // Build unified state
            const unifiedState: UnifiedState = {
                id: top1.id,
                name: top1.name,
                color: top1.color,
                dominantBands: top1.dominantBands,
                startTime: stateTrack.startTime,
                durationMs,
                durationFormatted: formatDuration(durationMs),
                tier,
                tierLabel: tierLabels[tier],
                nextTier,
                progressPercent,
                timeToNextMs,
                rawConfidence: Math.round(top1.confidence),
                adjustedConfidence,
                variance,
                stabilityStatus,
                isStable,
                emotionAxes: emotion.axes,
                topEmotions: emotion.topEmotions,
                isEmotionallyStable,
                emotionNote: emotion.emotionNote,
            };

            // Build challenger (NO duration for challengers)
            let challenger: ChallengerState | null = null;
            if (top2 && top2.id !== top1.id && top2.confidence > 35) {
                challenger = {
                    id: top2.id,
                    name: top2.name,
                    color: top2.color,
                    confidence: Math.round(top2.confidence),
                    dominantBands: top2.dominantBands,
                };
            }

            // Transition label
            let transitionLabel = 'Stabilizing';
            if (!isStable) {
                transitionLabel = 'Unstable';
            } else if (tier === 'locked') {
                transitionLabel = 'Locked';
            } else if (tier === 'confirmed') {
                transitionLabel = 'Confirmed';
            } else if (tier === 'candidate') {
                transitionLabel = 'Entering';
            } else {
                transitionLabel = 'Detecting';
            }

            setModel({
                currentState: unifiedState,
                challenger,
                transitionLabel,
            });
        }, CONFIG.UPDATE_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [applyEMA, calculateVariance, formatDuration, getTier]);

    return model;
}

// Default state helper
function createDefaultUnifiedState(): UnifiedState {
    return {
        id: 'ordinary_waking',
        name: 'Ordinary Waking',
        color: '#64748b',
        dominantBands: ['Beta-H', 'Beta-L'],
        startTime: Date.now(),
        durationMs: 0,
        durationFormatted: '0:00',
        tier: 'detected',
        tierLabel: 'Detected',
        nextTier: 'candidate',
        progressPercent: 0,
        timeToNextMs: 8000,
        rawConfidence: 50,
        adjustedConfidence: 25,
        variance: 0,
        stabilityStatus: 'stable',
        isStable: true,
        emotionAxes: { valence: 0, arousal: 0.5, control: 0.5 },
        topEmotions: [{ label: 'neutral', confidence: 50 }],
        isEmotionallyStable: true,
        emotionNote: 'Awaiting data',
    };
}
