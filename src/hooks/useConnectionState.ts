/**
 * Connection State Machine Hook
 * 
 * Single source of truth for EEG connection status.
 * Implements hysteresis to prevent flapping between states.
 * 
 * States: DISCONNECTED → CONNECTING → CONNECTED → DEGRADED → STALE → DISCONNECTED
 * 
 * Thresholds:
 * - CONNECTED: packet within 2 seconds
 * - DEGRADED: packet within 2-6 seconds
 * - STALE: packet within 6-15 seconds
 * - DISCONNECTED: no packet for >15 seconds
 * 
 * State transitions are debounced (minimum 500ms between changes).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ================================
// TYPES
// ================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'stale';

export interface ConnectionStateInfo {
    state: ConnectionState;
    label: string;
    lastPacketAgeMs: number;
    lastPacketAt: number | null;
    isReceivingData: boolean;
    packetRate: number;  // packets per second (rolling average)
    reconnectAttempts: number;
}

// ================================
// CONSTANTS
// ================================

const THRESHOLDS = {
    CONNECTED_MAX_MS: 2000,      // Connected if packet within 2s
    DEGRADED_MAX_MS: 6000,       // Degraded if packet within 2-6s
    STALE_MAX_MS: 15000,         // Stale if packet within 6-15s
    STATE_DEBOUNCE_MS: 500,      // Minimum time between state changes
    PACKET_RATE_WINDOW_MS: 3000, // Window for calculating packet rate
};

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: 'EEG Disconnected',
    connecting: 'Connecting...',
    connected: 'EEG Connected',
    degraded: 'EEG Weak',
    stale: 'EEG Stale (holding last values…)',
};

// ================================
// HOOK
// ================================

export function useConnectionState(
    isSessionActive: boolean,
    streamData: { data: unknown; stream: string } | null
): ConnectionStateInfo {
    const [state, setState] = useState<ConnectionState>('disconnected');

    // Timestamps
    const lastPacketAtRef = useRef<number | null>(null);
    const lastStateChangeAtRef = useRef<number>(0);
    const packetTimestampsRef = useRef<number[]>([]);
    const reconnectAttemptsRef = useRef<number>(0);

    // Calculate packet rate (packets per second)
    const getPacketRate = useCallback((): number => {
        const now = Date.now();
        const cutoff = now - THRESHOLDS.PACKET_RATE_WINDOW_MS;

        // Remove old timestamps
        packetTimestampsRef.current = packetTimestampsRef.current.filter(t => t > cutoff);

        if (packetTimestampsRef.current.length < 2) return 0;

        // Calculate rate
        const windowMs = now - packetTimestampsRef.current[0];
        if (windowMs <= 0) return 0;

        return (packetTimestampsRef.current.length / windowMs) * 1000;
    }, []);

    // Determine target state based on packet age
    const determineTargetState = useCallback((lastPacketAt: number | null): ConnectionState => {
        if (!isSessionActive) return 'disconnected';

        if (lastPacketAt === null) {
            return 'connecting';
        }

        const ageMs = Date.now() - lastPacketAt;

        if (ageMs <= THRESHOLDS.CONNECTED_MAX_MS) {
            return 'connected';
        } else if (ageMs <= THRESHOLDS.DEGRADED_MAX_MS) {
            return 'degraded';
        } else if (ageMs <= THRESHOLDS.STALE_MAX_MS) {
            return 'stale';
        } else {
            return 'disconnected';
        }
    }, [isSessionActive]);

    // Update state with debounce
    const updateState = useCallback((targetState: ConnectionState) => {
        const now = Date.now();
        const timeSinceLastChange = now - lastStateChangeAtRef.current;

        // Only change state if debounce period has passed
        // Exception: always allow transition TO 'connected' immediately
        if (timeSinceLastChange >= THRESHOLDS.STATE_DEBOUNCE_MS || targetState === 'connected') {
            setState(prevState => {
                if (prevState !== targetState) {
                    lastStateChangeAtRef.current = now;

                    // Reset reconnect attempts when connected
                    if (targetState === 'connected') {
                        reconnectAttemptsRef.current = 0;
                    }

                    return targetState;
                }
                return prevState;
            });
        }
    }, []);

    // Handle incoming data
    useEffect(() => {
        if (streamData?.data) {
            const now = Date.now();
            lastPacketAtRef.current = now;
            packetTimestampsRef.current.push(now);

            // Immediately transition to connected when data arrives
            if (state !== 'connected') {
                updateState('connected');
            }
        }
    }, [streamData, state, updateState]);

    // Periodic state check (runs every 500ms)
    useEffect(() => {
        if (!isSessionActive) {
            setState('disconnected');
            return;
        }

        const interval = setInterval(() => {
            const targetState = determineTargetState(lastPacketAtRef.current);
            updateState(targetState);
        }, 500);

        return () => clearInterval(interval);
    }, [isSessionActive, determineTargetState, updateState]);

    // Reset when session becomes inactive
    useEffect(() => {
        if (!isSessionActive) {
            lastPacketAtRef.current = null;
            packetTimestampsRef.current = [];
            setState('disconnected');
        }
    }, [isSessionActive]);

    // Build result
    const lastPacketAgeMs = lastPacketAtRef.current !== null
        ? Date.now() - lastPacketAtRef.current
        : -1;

    return {
        state,
        label: STATE_LABELS[state],
        lastPacketAgeMs,
        lastPacketAt: lastPacketAtRef.current,
        isReceivingData: state === 'connected' || state === 'degraded',
        packetRate: getPacketRate(),
        reconnectAttempts: reconnectAttemptsRef.current,
    };
}

export default useConnectionState;
