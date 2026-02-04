/**
 * STATE MACHINE v2 for Consciousness Explorer
 * 
 * FIXES:
 * 1. Per-state session timers (StateSession object)
 * 2. Proper hysteresis with rolling window smoothing
 * 3. Min hold time + cooldown to prevent rapid switching
 * 4. Emergency drop detection
 * 5. Separate timing for current vs challenger (never shared)
 * 
 * Architecture:
 * - StateSession stores timing PER state
 * - Rolling 2s window for confidence smoothing
 * - Strict conditions before allowing state switch
 * - Debug panel shows why switching is blocked
 */

import { useReducer, useRef, useEffect, useCallback, useMemo } from 'react';
import { CandidateState } from './useInference';
import { EmotionResult, EmotionAxes, TopEmotion } from './useEmotionInference';

// ================================
// CONFIGURATION
// ================================

const CONFIG = {
    // Tick rate
    TICK_INTERVAL_MS: 250,

    // Rolling window for smoothing (samples, not time)
    SMOOTHING_WINDOW_SIZE: 8, // ~2s at 250ms tick

    // Hysteresis - time-based
    MIN_HOLD_MS: 6000,        // Must hold current state for 6s before switch allowed
    COOLDOWN_MS: 8000,        // Must wait 8s after a switch before another switch

    // Hysteresis - confidence-based
    PROMOTION_THRESHOLD: 62,  // Challenger must exceed 62% confidence
    TAKEOVER_MARGIN: 12,      // Challenger must beat current by 12%

    // Emergency override
    EMERGENCY_DROP_THRESHOLD: 25, // If current drops below 25%
    EMERGENCY_DROP_DURATION: 1500, // For 1.5s, allow immediate switch

    // Display tier thresholds
    TIER_CANDIDATE_MS: 8000,
    TIER_CONFIRMED_MS: 15000,
    TIER_LOCKED_MS: 30000,
};

// ================================
// TYPES
// ================================

/** Per-state session tracking */
export interface StateSession {
    stateId: string;
    label: string;
    color: string;
    dominantBands: string[];
    enteredAt: number;      // When this became current
    lockedAt: number | null; // When this state became locked (null if not locked)
    lastSeenAt: number;     // Last time stream supported it
    status: 'candidate' | 'confirmed' | 'locked';
    confidenceHistory: number[]; // Rolling window for this state
}

export type TransitionStatus = 'stabilizing' | 'candidate' | 'locked' | 'transitioning';
export type ValidationTier = 'detected' | 'candidate' | 'confirmed' | 'locked';
export type StabilityStatus = 'stable' | 'unstable' | 'transitioning';

/** Why a switch is blocked */
export interface BlockReason {
    holdBlocked: boolean;     // MIN_HOLD hasn't passed
    cooldownBlocked: boolean; // COOLDOWN hasn't passed
    thresholdBlocked: boolean; // Challenger below PROMOTION_THRESHOLD
    marginBlocked: boolean;    // Challenger doesn't beat current by TAKEOVER_MARGIN
    emergencyActive: boolean;  // Emergency override is active
    message: string;
}

/** Internal state machine state */
interface StateMachineState {
    // Current state session
    current: StateSession;

    // Challenger tracking
    challenger: StateSession | null;
    challengerLeadStartMs: number | null; // When challenger started leading

    // Global timing
    lastSwitchAt: number;         // Last time we switched states
    emergencyDropStartMs: number | null; // When current started emergency drop

    // Status
    status: TransitionStatus;

    // Tick counter
    tickCount: number;

    // Last block reason for debug
    lastBlockReason: BlockReason | null;
}

/** Output for UI */
export interface DisplayState {
    id: string;
    name: string;
    color: string;
    dominantBands: string[];
    confidence: number;
    durationMs: number;          // Time since enteredAt
    durationFormatted: string;
    lockedDurationMs: number;    // Time since lockedAt (0 if not locked)
    lockedFormatted: string;
    tier: ValidationTier;
    tierLabel: string;
    stabilityStatus: StabilityStatus;
    isStable: boolean;
    variance: number;
}

export interface ChallengerDisplay {
    id: string;
    name: string;
    color: string;
    confidence: number;
    dominantBands: string[];
    leadDurationMs: number;      // How long challenger has been leading
    isCandidate: boolean;
}

export interface StateMachineOutput {
    currentState: DisplayState;
    challenger: ChallengerDisplay | null;
    status: TransitionStatus;
    transitionLabel: string;

    // Emotion data (passthrough)
    emotionAxes: EmotionAxes;
    topEmotions: TopEmotion[];
    isEmotionallyStable: boolean;
    emotionNote: string;
}

export interface DebugInfo {
    currentStateId: string;
    challengerStateId: string | null;
    currentConfidence: number;
    challengerConfidence: number | null;
    timeInStateMs: number;
    timeSinceLastSwitch: number;
    lastSwitchAt: number;
    tickCount: number;
    status: TransitionStatus;
    blockReason: BlockReason | null;
    rawTop3: { id: string; confidence: number }[];
    smoothedTop3: { id: string; confidence: number }[];
    emergencyActive: boolean;
}

// Action types
type Action =
    | { type: 'TICK'; now: number; candidates: CandidateState[]; emotion: EmotionResult }
    | { type: 'RESET' };

// ================================
// STATE SESSION FACTORY
// ================================

function createSession(
    stateId: string,
    label: string,
    color: string,
    dominantBands: string[],
    now: number
): StateSession {
    return {
        stateId,
        label,
        color,
        dominantBands,
        enteredAt: now,
        lockedAt: null,
        lastSeenAt: now,
        status: 'candidate',
        confidenceHistory: [],
    };
}

// ================================
// REDUCER
// ================================

function createInitialState(): StateMachineState {
    const now = Date.now();
    return {
        current: createSession('ordinary_waking', 'Ordinary Waking', '#64748b', ['Alpha', 'Beta'], now),
        challenger: null,
        challengerLeadStartMs: null,
        lastSwitchAt: now - CONFIG.COOLDOWN_MS, // Allow immediate first switch
        emergencyDropStartMs: null,
        status: 'stabilizing',
        tickCount: 0,
        lastBlockReason: null,
    };
}

function stateMachineReducer(state: StateMachineState, action: Action): StateMachineState {
    switch (action.type) {
        case 'RESET':
            return createInitialState();

        case 'TICK': {
            const { now, candidates } = action;

            if (candidates.length === 0) {
                return { ...state, tickCount: state.tickCount + 1 };
            }

            // === STEP 1: Update confidence history for all candidates ===
            const smoothedConfidences: Record<string, number> = {};

            for (const c of candidates) {
                // Get or create history for this candidate
                const existing = state.current.stateId === c.id
                    ? state.current.confidenceHistory
                    : state.challenger?.stateId === c.id
                        ? state.challenger.confidenceHistory
                        : [];

                const newHistory = [...existing, c.confidence];
                if (newHistory.length > CONFIG.SMOOTHING_WINDOW_SIZE) {
                    newHistory.shift();
                }

                // Calculate median for smoothing (more robust than mean)
                const sorted = [...newHistory].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                const smoothed = sorted.length % 2 === 0
                    ? (sorted[mid - 1] + sorted[mid]) / 2
                    : sorted[mid];

                smoothedConfidences[c.id] = smoothed;
            }

            // === STEP 2: Sort by smoothed confidence ===
            const sortedCandidates = [...candidates].sort((a, b) =>
                (smoothedConfidences[b.id] ?? 0) - (smoothedConfidences[a.id] ?? 0)
            );

            const topCandidate = sortedCandidates[0];
            const topConfidence = smoothedConfidences[topCandidate.id] ?? topCandidate.confidence;
            const currentConfidence = smoothedConfidences[state.current.stateId] ?? 0;

            // === STEP 3: Update current session ===
            let newCurrent = { ...state.current };
            const currentCandidateData = candidates.find(c => c.id === state.current.stateId);
            if (currentCandidateData) {
                // Update history
                const newHistory = [...state.current.confidenceHistory, currentCandidateData.confidence];
                if (newHistory.length > CONFIG.SMOOTHING_WINDOW_SIZE) {
                    newHistory.shift();
                }
                newCurrent.confidenceHistory = newHistory;
                newCurrent.lastSeenAt = now;
            }

            // Check for tier upgrade
            const timeInState = now - newCurrent.enteredAt;
            if (timeInState >= CONFIG.TIER_LOCKED_MS && newCurrent.status !== 'locked') {
                newCurrent.status = 'locked';
                newCurrent.lockedAt = now; // Set locked time NOW
            } else if (timeInState >= CONFIG.TIER_CONFIRMED_MS && newCurrent.status === 'candidate') {
                newCurrent.status = 'confirmed';
            }

            // === STEP 4: Emergency drop detection ===
            let emergencyDropStartMs = state.emergencyDropStartMs;
            let emergencyActive = false;

            if (currentConfidence < CONFIG.EMERGENCY_DROP_THRESHOLD) {
                if (!emergencyDropStartMs) {
                    emergencyDropStartMs = now;
                }
                const dropDuration = now - emergencyDropStartMs;
                if (dropDuration >= CONFIG.EMERGENCY_DROP_DURATION) {
                    emergencyActive = true;
                }
            } else {
                emergencyDropStartMs = null;
            }

            // === STEP 5: Check switch conditions ===
            const timeSinceLastSwitch = now - state.lastSwitchAt;
            const holdBlocked = timeInState < CONFIG.MIN_HOLD_MS && !emergencyActive;
            const cooldownBlocked = timeSinceLastSwitch < CONFIG.COOLDOWN_MS && !emergencyActive;
            const topIsDifferent = topCandidate.id !== state.current.stateId;
            const thresholdBlocked = topConfidence < CONFIG.PROMOTION_THRESHOLD;
            const marginBlocked = (topConfidence - currentConfidence) < CONFIG.TAKEOVER_MARGIN;

            // Build block reason
            const blockReason: BlockReason = {
                holdBlocked,
                cooldownBlocked,
                thresholdBlocked: topIsDifferent && thresholdBlocked,
                marginBlocked: topIsDifferent && marginBlocked,
                emergencyActive,
                message: buildBlockMessage(holdBlocked, cooldownBlocked, thresholdBlocked, marginBlocked, emergencyActive, timeInState, timeSinceLastSwitch),
            };

            // === STEP 6: Handle challenger ===
            let newChallenger = state.challenger;
            let challengerLeadStartMs = state.challengerLeadStartMs;
            let newStatus = state.status;
            let lastSwitchAt = state.lastSwitchAt;

            if (topIsDifferent) {
                // Check if this is the same challenger or a new one
                if (state.challenger?.stateId === topCandidate.id) {
                    // Same challenger - update it
                    newChallenger = {
                        ...state.challenger,
                        lastSeenAt: now,
                        confidenceHistory: (() => {
                            const hist = [...state.challenger!.confidenceHistory, topCandidate.confidence];
                            if (hist.length > CONFIG.SMOOTHING_WINDOW_SIZE) hist.shift();
                            return hist;
                        })(),
                    };
                } else {
                    // New challenger
                    newChallenger = createSession(
                        topCandidate.id,
                        topCandidate.name,
                        topCandidate.color,
                        topCandidate.dominantBands,
                        now
                    );
                    newChallenger.confidenceHistory = [topCandidate.confidence];
                    challengerLeadStartMs = now;
                }

                // Can we switch?
                const canSwitch = !holdBlocked && !cooldownBlocked && !thresholdBlocked && !marginBlocked;

                if (canSwitch || emergencyActive) {
                    // === STATE SWITCH ===
                    // Create new session for the new current state
                    const newCurrentSession = createSession(
                        topCandidate.id,
                        topCandidate.name,
                        topCandidate.color,
                        topCandidate.dominantBands,
                        now // enteredAt = NOW (timer resets)
                    );
                    newCurrentSession.confidenceHistory = [topCandidate.confidence];

                    return {
                        current: newCurrentSession,
                        challenger: null,
                        challengerLeadStartMs: null,
                        lastSwitchAt: now,
                        emergencyDropStartMs: null,
                        status: 'stabilizing',
                        tickCount: state.tickCount + 1,
                        lastBlockReason: null,
                    };
                } else {
                    // Not switching - update status
                    newStatus = 'transitioning';
                }
            } else {
                // Current is still winning - clear challenger
                newChallenger = null;
                challengerLeadStartMs = null;
                newStatus = newCurrent.status === 'locked' ? 'locked' : 'stabilizing';
            }

            return {
                current: newCurrent,
                challenger: newChallenger,
                challengerLeadStartMs,
                lastSwitchAt,
                emergencyDropStartMs,
                status: newStatus,
                tickCount: state.tickCount + 1,
                lastBlockReason: blockReason,
            };
        }

        default:
            return state;
    }
}

function buildBlockMessage(
    holdBlocked: boolean,
    cooldownBlocked: boolean,
    thresholdBlocked: boolean,
    marginBlocked: boolean,
    emergencyActive: boolean,
    timeInState: number,
    timeSinceSwitch: number
): string {
    if (emergencyActive) return '⚠️ Emergency override active';
    const reasons: string[] = [];
    if (holdBlocked) reasons.push(`Hold: ${Math.ceil((CONFIG.MIN_HOLD_MS - timeInState) / 1000)}s left`);
    if (cooldownBlocked) reasons.push(`Cooldown: ${Math.ceil((CONFIG.COOLDOWN_MS - timeSinceSwitch) / 1000)}s left`);
    if (thresholdBlocked) reasons.push(`Below ${CONFIG.PROMOTION_THRESHOLD}% threshold`);
    if (marginBlocked) reasons.push(`Needs +${CONFIG.TAKEOVER_MARGIN}% margin`);
    return reasons.length > 0 ? reasons.join(' | ') : '✓ Can switch';
}

// ================================
// HOOK
// ================================

export function useStateMachine(
    candidates: CandidateState[],
    emotionResult: EmotionResult
): { output: StateMachineOutput; debug: DebugInfo } {
    const [state, dispatch] = useReducer(stateMachineReducer, null, createInitialState);

    // Refs to hold latest values
    const candidatesRef = useRef<CandidateState[]>(candidates);
    const emotionRef = useRef<EmotionResult>(emotionResult);

    useEffect(() => { candidatesRef.current = candidates; }, [candidates]);
    useEffect(() => { emotionRef.current = emotionResult; }, [emotionResult]);

    // Single tick loop
    useEffect(() => {
        const interval = setInterval(() => {
            dispatch({
                type: 'TICK',
                now: Date.now(),
                candidates: candidatesRef.current,
                emotion: emotionRef.current,
            });
        }, CONFIG.TICK_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    // Build output
    const now = Date.now();
    const output = buildOutput(state, candidatesRef.current, emotionRef.current, now);
    const debug = buildDebug(state, candidatesRef.current, now);

    return { output, debug };
}

// ================================
// OUTPUT BUILDERS
// ================================

function buildOutput(
    state: StateMachineState,
    candidates: CandidateState[],
    emotion: EmotionResult,
    now: number
): StateMachineOutput {
    // Calculate smoothed confidence for current
    const currentConfidence = calculateSmoothedConfidence(state.current.confidenceHistory);

    // Durations from session (NOT global)
    const durationMs = now - state.current.enteredAt;
    const lockedDurationMs = state.current.lockedAt ? now - state.current.lockedAt : 0;

    // Variance
    const variance = calculateVariance(state.current.confidenceHistory);
    const isVarianceStable = variance < 15;
    const isEmotionallyStable = !emotion.isTranscendenceUnstable &&
        emotion.axes.valence > -0.3 &&
        emotion.axes.control > 0.3;
    const isStable = isVarianceStable && isEmotionallyStable;

    // Tier
    let tier: ValidationTier = 'detected';
    if (durationMs >= CONFIG.TIER_LOCKED_MS && isStable) {
        tier = 'locked';
    } else if (durationMs >= CONFIG.TIER_CONFIRMED_MS) {
        tier = 'confirmed';
    } else if (durationMs >= CONFIG.TIER_CANDIDATE_MS) {
        tier = 'candidate';
    }

    const tierLabels: Record<ValidationTier, string> = {
        detected: 'Detected',
        candidate: 'Candidate',
        confirmed: 'Confirmed',
        locked: 'Locked',
    };

    // Stability status
    let stabilityStatus: StabilityStatus = 'stable';
    if (!isStable) {
        stabilityStatus = 'unstable';
    } else if (tier === 'detected' || tier === 'candidate') {
        stabilityStatus = 'transitioning';
    }

    const currentState: DisplayState = {
        id: state.current.stateId,
        name: state.current.label,
        color: state.current.color,
        dominantBands: state.current.dominantBands,
        confidence: Math.round(currentConfidence),
        durationMs,
        durationFormatted: formatDuration(durationMs),
        lockedDurationMs,
        lockedFormatted: formatDuration(lockedDurationMs),
        tier,
        tierLabel: tierLabels[tier],
        stabilityStatus,
        isStable,
        variance,
    };

    // Challenger
    let challenger: ChallengerDisplay | null = null;
    if (state.challenger) {
        const challengerConfidence = calculateSmoothedConfidence(state.challenger.confidenceHistory);
        const leadDurationMs = state.challengerLeadStartMs ? now - state.challengerLeadStartMs : 0;

        challenger = {
            id: state.challenger.stateId,
            name: state.challenger.label,
            color: state.challenger.color,
            confidence: Math.round(challengerConfidence),
            dominantBands: state.challenger.dominantBands,
            leadDurationMs,
            isCandidate: leadDurationMs > 2000,
        };
    }

    // Transition label
    let transitionLabel = 'Stabilizing';
    switch (state.status) {
        case 'locked': transitionLabel = 'Locked'; break;
        case 'candidate': transitionLabel = 'Candidate Rising'; break;
        case 'transitioning': transitionLabel = 'Challenger Approaching'; break;
        case 'stabilizing': transitionLabel = tier === 'locked' ? 'Locked' : 'Stabilizing'; break;
    }

    return {
        currentState,
        challenger,
        status: state.status,
        transitionLabel,
        emotionAxes: emotion.axes,
        topEmotions: emotion.topEmotions,
        isEmotionallyStable,
        emotionNote: emotion.emotionNote,
    };
}

function buildDebug(
    state: StateMachineState,
    candidates: CandidateState[],
    now: number
): DebugInfo {
    const currentConfidence = calculateSmoothedConfidence(state.current.confidenceHistory);
    const challengerConfidence = state.challenger
        ? calculateSmoothedConfidence(state.challenger.confidenceHistory)
        : null;

    // Raw top 3
    const rawTop3 = [...candidates]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
        .map(c => ({ id: c.id, confidence: Math.round(c.confidence) }));

    // Smoothed top 3 (calculate from histories)
    const smoothedMap: Record<string, number> = {};
    smoothedMap[state.current.stateId] = currentConfidence;
    if (state.challenger) {
        smoothedMap[state.challenger.stateId] = challengerConfidence ?? 0;
    }
    for (const c of candidates) {
        if (!smoothedMap[c.id]) {
            smoothedMap[c.id] = c.confidence; // No history yet
        }
    }
    const smoothedTop3 = Object.entries(smoothedMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, conf]) => ({ id, confidence: Math.round(conf) }));

    return {
        currentStateId: state.current.stateId,
        challengerStateId: state.challenger?.stateId ?? null,
        currentConfidence: Math.round(currentConfidence),
        challengerConfidence: challengerConfidence ? Math.round(challengerConfidence) : null,
        timeInStateMs: now - state.current.enteredAt,
        timeSinceLastSwitch: now - state.lastSwitchAt,
        lastSwitchAt: state.lastSwitchAt,
        tickCount: state.tickCount,
        status: state.status,
        blockReason: state.lastBlockReason,
        rawTop3,
        smoothedTop3,
        emergencyActive: state.emergencyDropStartMs !== null &&
            (now - state.emergencyDropStartMs) >= CONFIG.EMERGENCY_DROP_DURATION,
    };
}

// ================================
// HELPERS
// ================================

function calculateSmoothedConfidence(history: number[]): number {
    if (history.length === 0) return 0;
    // Use median for robustness
    const sorted = [...history].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function formatDuration(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}
