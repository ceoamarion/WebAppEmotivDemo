/**
 * Session Store - Single Source of Truth for EEG Session Data
 * 
 * This Zustand store centralizes ALL live EEG session data.
 * All UI components read from this store; no duplicated local state.
 * 
 * Features:
 * - Hysteresis for connection state (N consecutive samples before switching)
 * - EMA smoothing for band power and emotion axes
 * - Cooldown for state machine transitions
 * - Last-known value caching for stale data handling
 * - Correct field mapping from Emotiv streams
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ================================
// TYPES
// ================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'stale';

export interface BandPower {
    theta: number;
    alpha: number;
    betaL: number;
    betaH: number;
    gamma: number;
    delta: number;
}

export interface EmotionAxes {
    valence: number;   // -1 to +1
    arousal: number;   // 0 to 1
    control: number;   // 0 to 1
}

export interface EmotionItem {
    name: string;
    score: number;
}

export interface MindState {
    id: string;
    confidence: number;
    tier: 'detected' | 'candidate' | 'confirmed' | 'locked';
    enteredAt: number;        // Timestamp when entered this state
    tierChangedAt: number;    // Timestamp when tier last changed
    dominantBands: string[];
}

export interface DeviceInfo {
    battery: number;          // 0-100 (from dev stream index 0)
    signal: number;           // 0-5 (from dev stream index 1)
    eegQuality: number | null; // 0-100 or null if unavailable (from dev stream last index)
}

export interface SessionData {
    // Connection
    connectionState: ConnectionState;
    connectionLabel: string;
    isSessionActive: boolean;
    lastPacketAt: number | null;
    packetRate: number;

    // Device info (from 'dev' stream)
    device: DeviceInfo;

    // Band power (from 'pow' stream) - smoothed
    bandPower: BandPower;
    rawBandPower: BandPower | null;
    bandPowerStale: boolean;
    bandPowerLastUpdate: number;
    dominantBand: string;

    // Emotions (from 'met' stream or inference) - smoothed
    emotionAxes: EmotionAxes;
    rawEmotionAxes: EmotionAxes | null;
    topEmotions: EmotionItem[];
    emotionsStale: boolean;
    emotionsLastUpdate: number;

    // Mind state (from state machine)
    currentState: MindState | null;
    challengerState: MindState | null;
    transitionLabel: string;
    stateChangeBlocked: boolean;
    stateChangeCooldownUntil: number;

    // Sensor quality (per electrode)
    sensorQuality: Record<string, number> | null;  // electrode name -> 0-4
    badSensorCount: number;
    goodSensorCount: number;

    // Timestamps
    sessionStartAt: number | null;
    lastStateChangeAt: number;
}

// ================================
// CONSTANTS
// ================================

// Toggle for debug logging (press 'L' in app to toggle, or set via console)
let DEBUG_SESSION_STORE = false;
if (typeof window !== 'undefined') {
    (window as unknown as { toggleSessionDebug: () => void }).toggleSessionDebug = () => {
        DEBUG_SESSION_STORE = !DEBUG_SESSION_STORE;
        console.log(`[SessionStore] Debug logging: ${DEBUG_SESSION_STORE ? 'ON' : 'OFF'}`);
    };
}

const EMA_ALPHA_BAND = 0.2;     // Smoothing for band power
const EMA_ALPHA_EMOTION = 0.15; // Smoothing for emotions
const CONNECTION_HYSTERESIS_COUNT = 5;  // 5 consecutive ticks (~2.5s) before state change
const STATE_CHANGE_COOLDOWN_MS = 4000;  // 4 seconds cooldown after state change
const STALE_THRESHOLD_MS = 3000;        // Data stale after 3 seconds

const CONNECTION_LABELS: Record<ConnectionState, string> = {
    disconnected: 'EEG Disconnected',
    connecting: 'Connecting...',
    connected: 'EEG Connected',
    degraded: 'EEG Weak',
    stale: 'EEG Stale',
};

const DEFAULT_BAND_POWER: BandPower = {
    theta: 0, alpha: 0, betaL: 0, betaH: 0, gamma: 0, delta: 0
};

const DEFAULT_EMOTION_AXES: EmotionAxes = {
    valence: 0, arousal: 0, control: 0
};

const DEFAULT_DEVICE: DeviceInfo = {
    battery: 0, signal: 0, eegQuality: null
};

// ================================
// STORE INTERFACE
// ================================

interface SessionStore extends SessionData {
    // Internal state
    _connectionCounter: number;     // For hysteresis
    _connectionTarget: ConnectionState;
    _lastConnectionChange: number;

    // Actions
    setSessionActive: (active: boolean) => void;
    receiveStreamPacket: (stream: string, data: unknown) => void;
    updateBandPower: (pow: Partial<BandPower>) => void;
    updateEmotions: (axes: Partial<EmotionAxes>, top3?: EmotionItem[]) => void;
    updateMindState: (current: MindState, challenger: MindState | null) => void;
    updateDeviceInfo: (info: Partial<DeviceInfo>) => void;
    resetSession: () => void;

    // Tick (called periodically to update stale/connection status)
    tick: () => void;
}

// ================================
// HELPERS
// ================================

function ema(newVal: number, oldVal: number, alpha: number): number {
    if (oldVal === 0) return newVal;
    return alpha * newVal + (1 - alpha) * oldVal;
}

function emaBandPower(newPow: BandPower, oldPow: BandPower): BandPower {
    return {
        theta: ema(newPow.theta, oldPow.theta, EMA_ALPHA_BAND),
        alpha: ema(newPow.alpha, oldPow.alpha, EMA_ALPHA_BAND),
        betaL: ema(newPow.betaL, oldPow.betaL, EMA_ALPHA_BAND),
        betaH: ema(newPow.betaH, oldPow.betaH, EMA_ALPHA_BAND),
        gamma: ema(newPow.gamma, oldPow.gamma, EMA_ALPHA_BAND),
        delta: ema(newPow.delta, oldPow.delta, EMA_ALPHA_BAND),
    };
}

function emaEmotionAxes(newAxes: EmotionAxes, oldAxes: EmotionAxes): EmotionAxes {
    return {
        valence: ema(newAxes.valence, oldAxes.valence, EMA_ALPHA_EMOTION),
        arousal: ema(newAxes.arousal, oldAxes.arousal, EMA_ALPHA_EMOTION),
        control: ema(newAxes.control, oldAxes.control, EMA_ALPHA_EMOTION),
    };
}

function getDominantBand(pow: BandPower): string {
    const bands = [
        { name: 'theta', value: pow.theta },
        { name: 'alpha', value: pow.alpha },
        { name: 'betaL', value: pow.betaL },
        { name: 'betaH', value: pow.betaH },
        { name: 'gamma', value: pow.gamma },
    ];
    bands.sort((a, b) => b.value - a.value);
    return bands[0]?.value > 0 ? bands[0].name : 'none';
}

/**
 * Parse 'dev' stream data from Emotiv Cortex API
 * 
 * Structure: [battery, signal, ...sensorQualities, overallQuality]
 * - Index 0: Battery level (0-100)
 * - Index 1: Signal strength (0-5)
 * - Indices 2 to N-1: Per-sensor contact quality (0=black/bad, 1=red, 2=orange, 4=green/good)
 * - Last index: Overall EEG quality percentage (0-100)
 */
function parseDevStream(data: unknown): { device: Partial<DeviceInfo>; sensors: Record<string, number> | null } {
    if (!Array.isArray(data) || data.length < 3) {
        if (DEBUG_SESSION_STORE) {
            console.warn('[SessionStore] parseDevStream: Invalid data format', data);
        }
        return { device: {}, sensors: null };
    }

    const SENSOR_NAMES = [
        'AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1',
        'O2', 'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4'
    ];

    const battery = typeof data[0] === 'number' ? Math.round(data[0]) : 0;
    const signal = typeof data[1] === 'number' ? Math.round(data[1]) : 0;

    // Overall EEG quality is at the LAST index
    const lastIdx = data.length - 1;
    const eegQuality = typeof data[lastIdx] === 'number' ? Math.round(data[lastIdx]) : null;

    // Validate EEG quality is in range 0-100 (not a sensor value like 0-4)
    const isValidEEGQuality = eegQuality !== null && eegQuality >= 0 && eegQuality <= 100;

    // Per-sensor quality is from index 2 to second-to-last
    const sensors: Record<string, number> = {};
    for (let i = 2; i < lastIdx && i - 2 < SENSOR_NAMES.length; i++) {
        const sensorIdx = i - 2;
        if (sensorIdx < SENSOR_NAMES.length) {
            sensors[SENSOR_NAMES[sensorIdx]] = typeof data[i] === 'number' ? data[i] : 0;
        }
    }

    if (DEBUG_SESSION_STORE) {
        console.log('[SessionStore] parseDevStream:', {
            rawLength: data.length,
            battery,
            signal,
            eegQuality,
            isValidEEGQuality,
            sensorCount: Object.keys(sensors).length,
            rawFirst5: data.slice(0, 5),
            rawLast3: data.slice(-3),
        });
    }

    return {
        device: { battery, signal, eegQuality: isValidEEGQuality ? eegQuality : null },
        sensors: Object.keys(sensors).length > 0 ? sensors : null
    };
}

/**
 * Parse 'pow' stream (band power)
 * Structure: [theta, alpha, betaL, betaH, gamma] (relative power values 0-1)
 */
function parsePowStream(data: unknown): BandPower | null {
    if (!Array.isArray(data) || data.length < 5) return null;

    return {
        theta: typeof data[0] === 'number' ? data[0] : 0,
        alpha: typeof data[1] === 'number' ? data[1] : 0,
        betaL: typeof data[2] === 'number' ? data[2] : 0,
        betaH: typeof data[3] === 'number' ? data[3] : 0,
        gamma: typeof data[4] === 'number' ? data[4] : 0,
        delta: 0, // Delta not typically in pow stream
    };
}

/**
 * Parse 'met' stream (performance metrics)
 * Structure: [eng, exc, str, rel, int, foc, ...]
 */
function parseMetStream(data: unknown): { axes: Partial<EmotionAxes>; top3: EmotionItem[] } | null {
    if (!Array.isArray(data) || data.length < 6) return null;

    // Standard Emotiv metrics indices
    const engagement = typeof data[0] === 'number' ? data[0] : 0;
    const excitement = typeof data[1] === 'number' ? data[1] : 0;
    const stress = typeof data[2] === 'number' ? data[2] : 0;
    const relaxation = typeof data[3] === 'number' ? data[3] : 0;
    const interest = typeof data[4] === 'number' ? data[4] : 0;
    const focus = typeof data[5] === 'number' ? data[5] : 0;

    // Derive emotion axes from metrics
    const valence = (relaxation - stress + interest - 0.5) * 2; // -1 to +1 approx
    const arousal = (excitement + engagement) / 2;
    const control = (focus + relaxation) / 2;

    // Build top 3 emotions
    const emotions = [
        { name: 'Engagement', score: engagement },
        { name: 'Excitement', score: excitement },
        { name: 'Stress', score: stress },
        { name: 'Relaxation', score: relaxation },
        { name: 'Interest', score: interest },
        { name: 'Focus', score: focus },
    ];
    emotions.sort((a, b) => b.score - a.score);

    return {
        axes: { valence: Math.max(-1, Math.min(1, valence)), arousal, control },
        top3: emotions.slice(0, 3)
    };
}

// ================================
// INITIAL STATE
// ================================

const initialState: SessionData = {
    connectionState: 'disconnected',
    connectionLabel: CONNECTION_LABELS.disconnected,
    isSessionActive: false,
    lastPacketAt: null,
    packetRate: 0,

    device: { ...DEFAULT_DEVICE },

    bandPower: { ...DEFAULT_BAND_POWER },
    rawBandPower: null,
    bandPowerStale: true,
    bandPowerLastUpdate: 0,
    dominantBand: 'none',

    emotionAxes: { ...DEFAULT_EMOTION_AXES },
    rawEmotionAxes: null,
    topEmotions: [],
    emotionsStale: true,
    emotionsLastUpdate: 0,

    currentState: null,
    challengerState: null,
    transitionLabel: 'Initializing...',
    stateChangeBlocked: false,
    stateChangeCooldownUntil: 0,

    sensorQuality: null,
    badSensorCount: 0,
    goodSensorCount: 0,

    sessionStartAt: null,
    lastStateChangeAt: 0,
};

// ================================
// STORE
// ================================

export const useSessionStore = create<SessionStore>()(
    subscribeWithSelector((set, get) => ({
        ...initialState,

        // Internal hysteresis state
        _connectionCounter: 0,
        _connectionTarget: 'disconnected',
        _lastConnectionChange: 0,

        setSessionActive: (active: boolean) => {
            set(state => ({
                isSessionActive: active,
                sessionStartAt: active ? Date.now() : state.sessionStartAt,
                connectionState: active ? 'connecting' : 'disconnected',
                connectionLabel: active ? CONNECTION_LABELS.connecting : CONNECTION_LABELS.disconnected,
            }));
        },

        receiveStreamPacket: (stream: string, data: unknown) => {
            const now = Date.now();
            const state = get();

            // Update last packet time (proves we're receiving data)
            set({ lastPacketAt: now });

            // Parse based on stream type
            if (stream === 'pow') {
                const pow = parsePowStream(data);
                if (pow) {
                    const smoothed = emaBandPower(pow, state.bandPower);
                    set({
                        rawBandPower: pow,
                        bandPower: smoothed,
                        bandPowerStale: false,
                        bandPowerLastUpdate: now,
                        dominantBand: getDominantBand(smoothed),
                    });
                }
            } else if (stream === 'dev') {
                const parsed = parseDevStream(data);
                set(s => ({
                    device: { ...s.device, ...parsed.device },
                    sensorQuality: parsed.sensors ?? s.sensorQuality,
                    badSensorCount: parsed.sensors
                        ? Object.values(parsed.sensors).filter(v => v <= 1).length
                        : s.badSensorCount,
                    goodSensorCount: parsed.sensors
                        ? Object.values(parsed.sensors).filter(v => v >= 4).length
                        : s.goodSensorCount,
                }));
            } else if (stream === 'met') {
                const parsed = parseMetStream(data);
                if (parsed) {
                    const current = state.emotionAxes;
                    const smoothed = emaEmotionAxes(
                        { ...current, ...parsed.axes } as EmotionAxes,
                        current
                    );
                    set({
                        rawEmotionAxes: { ...current, ...parsed.axes } as EmotionAxes,
                        emotionAxes: smoothed,
                        topEmotions: parsed.top3,
                        emotionsStale: false,
                        emotionsLastUpdate: now,
                    });
                }
            }

            // Update connection state with hysteresis
            const targetConnection: ConnectionState = 'connected';
            if (state._connectionTarget !== targetConnection) {
                set({ _connectionCounter: 1, _connectionTarget: targetConnection });
            } else if (state._connectionCounter < CONNECTION_HYSTERESIS_COUNT) {
                set({ _connectionCounter: state._connectionCounter + 1 });
            }

            // Apply connection state change after hysteresis threshold
            if (state._connectionCounter >= CONNECTION_HYSTERESIS_COUNT && state.connectionState !== targetConnection) {
                set({
                    connectionState: targetConnection,
                    connectionLabel: CONNECTION_LABELS[targetConnection],
                    _lastConnectionChange: now,
                });
            }
        },

        updateBandPower: (pow: Partial<BandPower>) => {
            const now = Date.now();
            set(state => {
                const merged = { ...state.bandPower, ...pow };
                const smoothed = emaBandPower(merged, state.bandPower);
                return {
                    rawBandPower: merged,
                    bandPower: smoothed,
                    bandPowerStale: false,
                    bandPowerLastUpdate: now,
                    dominantBand: getDominantBand(smoothed),
                };
            });
        },

        updateEmotions: (axes: Partial<EmotionAxes>, top3?: EmotionItem[]) => {
            const now = Date.now();
            set(state => {
                const merged = { ...state.emotionAxes, ...axes };
                const smoothed = emaEmotionAxes(merged, state.emotionAxes);
                return {
                    rawEmotionAxes: merged,
                    emotionAxes: smoothed,
                    topEmotions: top3 ?? state.topEmotions,
                    emotionsStale: false,
                    emotionsLastUpdate: now,
                };
            });
        },

        updateMindState: (current: MindState, challenger: MindState | null) => {
            const now = Date.now();
            const state = get();

            // Check if state actually changed
            const stateChanged = state.currentState?.id !== current.id;

            // If in cooldown, block the change (unless it's the same state)
            if (stateChanged && now < state.stateChangeCooldownUntil) {
                set({ stateChangeBlocked: true });
                return;
            }

            // Apply state change
            if (stateChanged) {
                set({
                    currentState: { ...current, enteredAt: now },
                    challengerState: challenger,
                    lastStateChangeAt: now,
                    stateChangeCooldownUntil: now + STATE_CHANGE_COOLDOWN_MS,
                    stateChangeBlocked: false,
                    transitionLabel: `${current.tier} - ${current.id}`,
                });
            } else {
                // Same state - just update confidence/tier
                set(s => ({
                    currentState: s.currentState ? {
                        ...s.currentState,
                        confidence: current.confidence,
                        tier: current.tier,
                        tierChangedAt: s.currentState.tier !== current.tier ? now : s.currentState.tierChangedAt,
                        dominantBands: current.dominantBands,
                    } : current,
                    challengerState: challenger,
                    stateChangeBlocked: false,
                    transitionLabel: `${current.tier} - ${current.id}`,
                }));
            }
        },

        updateDeviceInfo: (info: Partial<DeviceInfo>) => {
            set(state => ({
                device: { ...state.device, ...info }
            }));
        },

        resetSession: () => {
            set({
                ...initialState,
                _connectionCounter: 0,
                _connectionTarget: 'disconnected',
                _lastConnectionChange: 0,
            });
        },

        tick: () => {
            const now = Date.now();
            const state = get();

            if (!state.isSessionActive) return;

            // Check data staleness
            const bandStale = now - state.bandPowerLastUpdate > STALE_THRESHOLD_MS;
            const emotionStale = now - state.emotionsLastUpdate > STALE_THRESHOLD_MS;

            if (bandStale !== state.bandPowerStale || emotionStale !== state.emotionsStale) {
                set({ bandPowerStale: bandStale, emotionsStale: emotionStale });
            }

            // Check connection staleness
            const lastPacketAge = state.lastPacketAt ? now - state.lastPacketAt : Infinity;
            let targetConnection: ConnectionState = state.connectionState;

            if (lastPacketAge <= 2000) {
                targetConnection = 'connected';
            } else if (lastPacketAge <= 6000) {
                targetConnection = 'degraded';
            } else if (lastPacketAge <= 15000) {
                targetConnection = 'stale';
            } else {
                targetConnection = 'disconnected';
            }

            // Apply connection change with hysteresis (for degradation)
            if (targetConnection !== state.connectionState) {
                if (state._connectionTarget !== targetConnection) {
                    set({ _connectionCounter: 1, _connectionTarget: targetConnection });
                } else {
                    const newCount = state._connectionCounter + 1;
                    set({ _connectionCounter: newCount });

                    if (newCount >= CONNECTION_HYSTERESIS_COUNT) {
                        set({
                            connectionState: targetConnection,
                            connectionLabel: CONNECTION_LABELS[targetConnection],
                            _lastConnectionChange: now,
                        });
                    }
                }
            }

            // Check cooldown expiration
            if (state.stateChangeBlocked && now >= state.stateChangeCooldownUntil) {
                set({ stateChangeBlocked: false });
            }
        },
    }))
);

// ================================
// SELECTOR HOOKS
// ================================

import { useShallow } from 'zustand/react/shallow';

export function useConnectionState() {
    return useSessionStore(useShallow(s => ({
        state: s.connectionState,
        label: s.connectionLabel,
        isActive: s.isSessionActive,
        packetRate: s.packetRate,
    })));
}

export function useDeviceInfo() {
    return useSessionStore(s => s.device);
}

export function useBandPower() {
    return useSessionStore(useShallow(s => ({
        power: s.bandPower,
        raw: s.rawBandPower,
        stale: s.bandPowerStale,
        dominant: s.dominantBand,
    })));
}

export function useEmotions() {
    return useSessionStore(useShallow(s => ({
        axes: s.emotionAxes,
        top3: s.topEmotions,
        stale: s.emotionsStale,
    })));
}

export function useMindState() {
    return useSessionStore(useShallow(s => ({
        current: s.currentState,
        challenger: s.challengerState,
        label: s.transitionLabel,
        blocked: s.stateChangeBlocked,
    })));
}

export function useSensorQuality() {
    return useSessionStore(useShallow(s => ({
        sensors: s.sensorQuality,
        bad: s.badSensorCount,
        good: s.goodSensorCount,
        quality: s.device.eegQuality,
    })));
}

export default useSessionStore;

