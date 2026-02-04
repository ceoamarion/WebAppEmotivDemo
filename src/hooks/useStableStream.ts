/**
 * useStableStream Hook
 * 
 * Provides hysteresis (debounce) for stream state to prevent UI flicker.
 * - Only enters RUNNING after stable data for enterThresholdMs
 * - Only exits RUNNING after sustained dropout for exitThresholdMs
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface StableStreamConfig {
    enterThresholdMs?: number;  // Time of good samples before entering running
    exitThresholdMs?: number;   // Time without samples before exiting running
    debugLog?: boolean;         // Enable throttled debug logging
}

interface StableStreamState {
    isStableRunning: boolean;
    lastGoodSampleTimestamp: number;
    sampleCount: number;
    dropoutDurationMs: number;
}

export function useStableStream(
    isStreamActive: boolean,
    hasNewSample: boolean,
    config: StableStreamConfig = {}
) {
    const {
        enterThresholdMs = 500,    // 500ms of stable data to enter
        exitThresholdMs = 2000,    // 2s dropout to exit
        debugLog = false,
    } = config;

    const [isStableRunning, setIsStableRunning] = useState(false);

    // Refs to avoid re-render loops
    const lastGoodSampleRef = useRef<number>(0);
    const enterTimerRef = useRef<NodeJS.Timeout | null>(null);
    const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sampleCountRef = useRef<number>(0);
    const lastLogTimeRef = useRef<number>(0);

    // Debug logger (throttled to 2Hz)
    const debugLogThrottled = useCallback((data: Record<string, any>) => {
        if (!debugLog) return;
        const now = Date.now();
        if (now - lastLogTimeRef.current < 500) return;
        lastLogTimeRef.current = now;
        console.log('[StableStream]', {
            ...data,
            timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
        });
    }, [debugLog]);

    // Handle sample received
    const onSampleReceived = useCallback(() => {
        const now = Date.now();
        lastGoodSampleRef.current = now;
        sampleCountRef.current++;

        // Clear any pending exit timer
        if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current);
            exitTimerRef.current = null;
        }

        // If not running, start enter timer
        if (!isStableRunning && !enterTimerRef.current) {
            debugLogThrottled({ event: 'starting_enter_timer', threshold: enterThresholdMs });
            enterTimerRef.current = setTimeout(() => {
                setIsStableRunning(true);
                enterTimerRef.current = null;
                debugLogThrottled({ event: 'entered_running', sampleCount: sampleCountRef.current });
            }, enterThresholdMs);
        }
    }, [isStableRunning, enterThresholdMs, debugLogThrottled]);

    // Handle stream going inactive or dropout
    const checkForDropout = useCallback(() => {
        if (!isStableRunning) return;

        const now = Date.now();
        const timeSinceLastSample = now - lastGoodSampleRef.current;

        debugLogThrottled({
            event: 'dropout_check',
            timeSinceLastSample,
            threshold: exitThresholdMs
        });

        // Start exit timer if no samples for a while
        if (timeSinceLastSample > 500 && !exitTimerRef.current) {
            exitTimerRef.current = setTimeout(() => {
                const finalTimeSince = Date.now() - lastGoodSampleRef.current;
                if (finalTimeSince >= exitThresholdMs) {
                    setIsStableRunning(false);
                    sampleCountRef.current = 0;
                    debugLogThrottled({ event: 'exited_running', dropoutMs: finalTimeSince });
                }
                exitTimerRef.current = null;
            }, exitThresholdMs);
        }
    }, [isStableRunning, exitThresholdMs, debugLogThrottled]);

    // Effect to handle sample updates
    useEffect(() => {
        if (hasNewSample && isStreamActive) {
            onSampleReceived();
        }
    }, [hasNewSample, isStreamActive, onSampleReceived]);

    // Effect to check for dropout periodically
    useEffect(() => {
        if (!isStreamActive) {
            // Stream stopped - clear timers and exit
            if (enterTimerRef.current) {
                clearTimeout(enterTimerRef.current);
                enterTimerRef.current = null;
            }
            if (exitTimerRef.current) {
                clearTimeout(exitTimerRef.current);
                exitTimerRef.current = null;
            }
            setIsStableRunning(false);
            return;
        }

        const interval = setInterval(checkForDropout, 500);
        return () => clearInterval(interval);
    }, [isStreamActive, checkForDropout]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
            if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        };
    }, []);

    return {
        isStableRunning,
        lastGoodSampleTimestamp: lastGoodSampleRef.current,
        sampleCount: sampleCountRef.current,
    };
}

/**
 * useSingleConnection Hook
 * 
 * Ensures only ONE connection is made, even with React StrictMode.
 * Uses refs to prevent double-connect on double-mount.
 */
export function useSingleConnection<T>(
    connectFn: () => Promise<T>,
    disconnectFn: (connection: T) => void,
    shouldConnect: boolean = true
) {
    const connectionRef = useRef<T | null>(null);
    const isConnectingRef = useRef(false);
    const mountedRef = useRef(false);

    useEffect(() => {
        // Guard against double-mount in StrictMode
        if (mountedRef.current) return;
        mountedRef.current = true;

        if (!shouldConnect) return;
        if (connectionRef.current) return;
        if (isConnectingRef.current) return;

        isConnectingRef.current = true;

        connectFn()
            .then((conn) => {
                connectionRef.current = conn;
                isConnectingRef.current = false;
            })
            .catch((err) => {
                console.error('Connection failed:', err);
                isConnectingRef.current = false;
            });

        return () => {
            if (connectionRef.current) {
                disconnectFn(connectionRef.current);
                connectionRef.current = null;
            }
            mountedRef.current = false;
        };
    }, []); // Empty deps - only on mount

    return connectionRef;
}

/**
 * useThrottledState Hook
 * 
 * Prevents state updates from causing re-renders more than N times per second.
 */
export function useThrottledState<T>(
    value: T,
    throttleMs: number = 100
): T {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastUpdateRef = useRef<number>(0);
    const pendingRef = useRef<T | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;

        if (timeSinceLastUpdate >= throttleMs) {
            // Enough time has passed, update immediately
            setThrottledValue(value);
            lastUpdateRef.current = now;
            pendingRef.current = null;
        } else {
            // Queue the update
            pendingRef.current = value;

            if (!timerRef.current) {
                timerRef.current = setTimeout(() => {
                    if (pendingRef.current !== null) {
                        setThrottledValue(pendingRef.current);
                        lastUpdateRef.current = Date.now();
                        pendingRef.current = null;
                    }
                    timerRef.current = null;
                }, throttleMs - timeSinceLastUpdate);
            }
        }
    }, [value, throttleMs]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return throttledValue;
}

/**
 * Debug logger for tracking UI mode transitions
 */
export function createModeDebugger(enabled: boolean = false) {
    let lastLogTime = 0;
    let lastMode = '';

    return function logModeChange(data: {
        mode: string;
        isStreaming: boolean;
        isAutoMode: boolean;
        hasData: boolean;
        lastSampleAgeMs: number;
        isStableRunning: boolean;
    }) {
        if (!enabled) return;

        const now = Date.now();
        // Throttle to 2Hz unless mode changed
        if (now - lastLogTime < 500 && data.mode === lastMode) return;

        lastLogTime = now;
        const modeChanged = data.mode !== lastMode;
        lastMode = data.mode;

        console.log(
            `[ModeDebug] ${modeChanged ? '⚠️ CHANGED' : ''}`,
            `mode=${data.mode}`,
            `streaming=${data.isStreaming}`,
            `auto=${data.isAutoMode}`,
            `hasData=${data.hasData}`,
            `sampleAge=${data.lastSampleAgeMs}ms`,
            `stable=${data.isStableRunning}`
        );
    };
}
