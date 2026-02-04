/**
 * Duration Validation Hook
 * 
 * Validates EEG mental states based on duration, stability, and context.
 * Prevents false positives and instant state switching.
 * 
 * TEMPORAL TIERS:
 * - Detected (≥5s): Pattern observed but unstable
 * - Candidate (≥15s): Sustained enough to suggest entry
 * - Confirmed (≥30s): Genuine experiential engagement
 * - Locked (≥60s + low variance): Stable state
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { DisplayModel, DisplayState } from './useDisplayStabilizer';
import { EmotionResult } from './useEmotionInference';

// Validation tier types
export type ValidationTier = 'detected' | 'candidate' | 'confirmed' | 'locked';
export type MicrostateLabel = 'microstate' | 'brief_access' | null;

// State category for duration thresholds
export type StateCategory =
    | 'alpha_relaxed'
    | 'theta_meditative'
    | 'lucid_like'
    | 'gamma_peak'
    | 'transcendent'
    | 'ordinary';

// Duration thresholds per state category (in milliseconds)
interface DurationThresholds {
    detected: number;
    candidate: number;
    confirmed: number;
    locked: number;
}

const STATE_DURATION_THRESHOLDS: Record<StateCategory, DurationThresholds> = {
    ordinary: {
        detected: 3000,      // 3s
        candidate: 8000,     // 8s
        confirmed: 15000,    // 15s
        locked: 30000,       // 30s
    },
    alpha_relaxed: {
        detected: 5000,      // 5s
        candidate: 15000,    // 15s
        confirmed: 30000,    // 30s - 60s
        locked: 120000,      // 2 min
    },
    theta_meditative: {
        detected: 5000,      // 5s
        candidate: 20000,    // 15-30s
        confirmed: 60000,    // 45-90s
        locked: 150000,      // 2-4 min
    },
    lucid_like: {
        detected: 10000,     // 10s
        candidate: 30000,    // 30s
        confirmed: 60000,    // 60s minimum
        locked: 180000,      // 3 min
    },
    gamma_peak: {
        detected: 3000,      // 3s (bursts)
        candidate: 15000,    // 10-20s repeated bursts
        confirmed: 45000,    // 30-90s sustained
        locked: 120000,      // 2 min
    },
    transcendent: {
        detected: 10000,     // 10s
        candidate: 30000,    // 30s
        confirmed: 120000,   // 2 min
        locked: 300000,      // 5 min
    },
};

// Map state IDs to categories
function getStateCategory(stateId: string): StateCategory {
    const categoryMap: Record<string, StateCategory> = {
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
    return categoryMap[stateId] || 'ordinary';
}

// Validated state output
export interface ValidatedState {
    // Core state info
    id: string;
    name: string;
    displayName: string; // May differ based on tier
    color: string;

    // Duration validation
    tier: ValidationTier;
    tierLabel: string;
    durationMs: number;
    durationFormatted: string;

    // Progress to next tier
    nextTier: ValidationTier | null;
    progressToNextTier: number; // 0-100
    timeToNextTier: number; // ms remaining

    // Microstate handling
    microstate: MicrostateLabel;

    // Stability metrics
    variance: number;
    isStable: boolean;
    isEmotionallyStable: boolean;

    // Original confidence
    rawConfidence: number;
    adjustedConfidence: number; // Modified by duration
}

export interface DurationValidationResult {
    currentState: ValidatedState;
    challenger: ValidatedState | null;
    transitionStatus: 'accessing' | 'entering' | 'sustaining' | 'unstable';
    transitionLabel: string;
    debug: {
        stateHistory: { id: string; duration: number }[];
        varianceWindow: number[];
    };
}

const UPDATE_INTERVAL = 250; // 4Hz validation checks
const VARIANCE_WINDOW_SIZE = 20; // ~5 seconds of samples
const MICROSTATE_THRESHOLD = 5000; // <5s = microstate

export function useDurationValidation(
    displayModel: DisplayModel,
    emotionResult: EmotionResult
): DurationValidationResult {
    // Track state durations
    const stateStartTimeRef = useRef<Record<string, number>>({});
    const confidenceHistoryRef = useRef<Record<string, number[]>>({});
    const currentStateIdRef = useRef<string>('');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const [result, setResult] = useState<DurationValidationResult>({
        currentState: createDefaultValidatedState(),
        challenger: null,
        transitionStatus: 'accessing',
        transitionLabel: 'Initializing',
        debug: { stateHistory: [], varianceWindow: [] },
    });

    // Calculate variance from history
    const calculateVariance = useCallback((values: number[]): number => {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }, []);

    // Get tier based on duration
    const getTierFromDuration = useCallback((
        durationMs: number,
        thresholds: DurationThresholds
    ): ValidationTier => {
        if (durationMs >= thresholds.locked) return 'locked';
        if (durationMs >= thresholds.confirmed) return 'confirmed';
        if (durationMs >= thresholds.candidate) return 'candidate';
        return 'detected';
    }, []);

    // Get tier label for display
    const getTierLabel = useCallback((tier: ValidationTier): string => {
        const labels: Record<ValidationTier, string> = {
            detected: 'Detected',
            candidate: 'Candidate',
            confirmed: 'Current State',
            locked: 'Locked',
        };
        return labels[tier];
    }, []);

    // Format duration for display
    const formatDuration = useCallback((ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }, []);

    // Create validated state from display state
    const createValidatedState = useCallback((
        state: DisplayState,
        now: number,
        emotionStable: boolean
    ): ValidatedState => {
        const stateId = state.id;
        const category = getStateCategory(stateId);
        const thresholds = STATE_DURATION_THRESHOLDS[category];

        // Get or set start time for this state
        if (!stateStartTimeRef.current[stateId]) {
            stateStartTimeRef.current[stateId] = now;
        }
        const startTime = stateStartTimeRef.current[stateId];
        const durationMs = now - startTime;

        // Track confidence history for variance
        if (!confidenceHistoryRef.current[stateId]) {
            confidenceHistoryRef.current[stateId] = [];
        }
        const history = confidenceHistoryRef.current[stateId];
        history.push(state.confidence);
        if (history.length > VARIANCE_WINDOW_SIZE) {
            history.shift();
        }

        // Calculate variance
        const variance = calculateVariance(history);
        const isStable = variance < 15; // Low variance threshold

        // Determine tier
        let tier = getTierFromDuration(durationMs, thresholds);

        // Downgrade tier if unstable
        if (!isStable && tier === 'locked') {
            tier = 'confirmed';
        }
        if (!emotionStable && (tier === 'locked' || tier === 'confirmed')) {
            // Keep tier but flag as unstable
        }

        // Calculate progress to next tier
        let nextTier: ValidationTier | null = null;
        let progressToNextTier = 100;
        let timeToNextTier = 0;

        if (tier === 'detected') {
            nextTier = 'candidate';
            progressToNextTier = Math.min(100, (durationMs / thresholds.candidate) * 100);
            timeToNextTier = Math.max(0, thresholds.candidate - durationMs);
        } else if (tier === 'candidate') {
            nextTier = 'confirmed';
            progressToNextTier = Math.min(100, (durationMs / thresholds.confirmed) * 100);
            timeToNextTier = Math.max(0, thresholds.confirmed - durationMs);
        } else if (tier === 'confirmed') {
            nextTier = 'locked';
            progressToNextTier = Math.min(100, (durationMs / thresholds.locked) * 100);
            timeToNextTier = Math.max(0, thresholds.locked - durationMs);
        }

        // Microstate handling
        let microstate: MicrostateLabel = null;
        if (durationMs < MICROSTATE_THRESHOLD && durationMs > 0) {
            microstate = durationMs < 2000 ? 'brief_access' : 'microstate';
        }

        // Adjust confidence based on duration
        const durationFactor = Math.min(1, durationMs / thresholds.confirmed);
        const adjustedConfidence = Math.round(state.confidence * (0.5 + 0.5 * durationFactor));

        // Display name may differ for unpromoted states
        let displayName = state.name;
        if (tier === 'detected' && durationMs < thresholds.candidate) {
            displayName = `${state.name} (Accessing)`;
        }

        return {
            id: state.id,
            name: state.name,
            displayName,
            color: state.color,
            tier,
            tierLabel: getTierLabel(tier),
            durationMs,
            durationFormatted: formatDuration(durationMs),
            nextTier,
            progressToNextTier,
            timeToNextTier,
            microstate,
            variance,
            isStable,
            isEmotionallyStable: emotionStable,
            rawConfidence: state.confidence,
            adjustedConfidence,
        };
    }, [calculateVariance, getTierFromDuration, getTierLabel, formatDuration]);

    // Main validation loop
    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const now = Date.now();
            const currentStateId = displayModel.currentState.id;

            // Check if state changed
            if (currentStateId !== currentStateIdRef.current) {
                // Reset timer for old state if it wasn't confirmed
                const oldId = currentStateIdRef.current;
                if (oldId && stateStartTimeRef.current[oldId]) {
                    const oldDuration = now - stateStartTimeRef.current[oldId];
                    const oldCategory = getStateCategory(oldId);
                    const oldThresholds = STATE_DURATION_THRESHOLDS[oldCategory];

                    // If old state wasn't confirmed, mark as microstate/brief access
                    if (oldDuration < oldThresholds.confirmed) {
                        // State was only accessed, not entered
                    }

                    // Reset old state tracking
                    delete stateStartTimeRef.current[oldId];
                    delete confidenceHistoryRef.current[oldId];
                }

                currentStateIdRef.current = currentStateId;
                stateStartTimeRef.current[currentStateId] = now;
                confidenceHistoryRef.current[currentStateId] = [];
            }

            // Check emotional stability
            const emotionStable = !emotionResult.isTranscendenceUnstable &&
                emotionResult.axes.valence > -0.3 &&
                emotionResult.axes.control > 0.3;

            // Validate current state
            const validatedCurrent = createValidatedState(
                displayModel.currentState,
                now,
                emotionStable
            );

            // Validate challenger if present
            let validatedChallenger: ValidatedState | null = null;
            if (displayModel.challenger) {
                validatedChallenger = createValidatedState(
                    {
                        id: displayModel.challenger.id,
                        name: displayModel.challenger.name,
                        confidence: displayModel.challenger.confidence,
                        color: displayModel.challenger.color,
                        lockedSince: displayModel.challenger.appearTime,
                        dominantBands: displayModel.challenger.dominantBands,
                    },
                    now,
                    emotionStable
                );
            }

            // Determine transition status
            let transitionStatus: DurationValidationResult['transitionStatus'];
            let transitionLabel: string;

            if (!emotionStable) {
                transitionStatus = 'unstable';
                transitionLabel = 'Unstable';
            } else if (validatedCurrent.tier === 'locked') {
                transitionStatus = 'sustaining';
                transitionLabel = `Sustaining (${validatedCurrent.durationFormatted})`;
            } else if (validatedCurrent.tier === 'confirmed') {
                transitionStatus = 'entering';
                transitionLabel = `Entering (${validatedCurrent.durationFormatted})`;
            } else {
                transitionStatus = 'accessing';
                transitionLabel = `Accessing (${validatedCurrent.durationFormatted})`;
            }

            setResult({
                currentState: validatedCurrent,
                challenger: validatedChallenger,
                transitionStatus,
                transitionLabel,
                debug: {
                    stateHistory: Object.entries(stateStartTimeRef.current).map(([id, start]) => ({
                        id,
                        duration: now - start,
                    })),
                    varianceWindow: confidenceHistoryRef.current[currentStateId] || [],
                },
            });
        }, UPDATE_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [displayModel, emotionResult, createValidatedState]);

    return result;
}

// Default state helper
function createDefaultValidatedState(): ValidatedState {
    return {
        id: 'ordinary_waking',
        name: 'Ordinary Waking',
        displayName: 'Ordinary Waking',
        color: '#64748b',
        tier: 'detected',
        tierLabel: 'Detected',
        durationMs: 0,
        durationFormatted: '0s',
        nextTier: 'candidate',
        progressToNextTier: 0,
        timeToNextTier: 15000,
        microstate: null,
        variance: 0,
        isStable: true,
        isEmotionallyStable: true,
        rawConfidence: 50,
        adjustedConfidence: 25,
    };
}
