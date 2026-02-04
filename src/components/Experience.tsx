"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCortex } from '@/context/CortexContext';
import { useEEGStream, POWData } from '@/hooks/useEEGStream';
import { useEEGQuality } from '@/hooks/useEEGQuality';
import { useConnectionState } from '@/hooks/useConnectionState';
import { useStableDataStore } from '@/hooks/useStableDataStore';
import { useInference } from '@/hooks/useInference';
import { useEmotionInference } from '@/hooks/useEmotionInference';
import {
    useStateMachine,
    StateMachineOutput,
    DisplayState,
    ChallengerDisplay,
} from '@/hooks/useStateMachine';
import { DebugOverlay } from './DebugOverlay';
import { ConnectionDebugOverlay } from './ConnectionDebugOverlay';
import { StatePopover } from './StatePopover';
import { EmotionOverlay, FrequencyReference } from './EmotionOverlay';
import { SessionSummaryModal } from './SessionSummaryModal';
import { QualityBadge } from './QualityBadge';
import { getStateInfo } from '@/data/stateInfo';
import {
    SessionCollector,
    SessionRecord,
    createSessionCollector,
    addStateSample,
    addEmotionSample,
    addBandPowerSample,
    addEEGQualitySample,
    finalizeSession,
} from '@/data/sessionStorage';
import styles from './Experience.module.css';

// ================================
// MAIN EXPERIENCE COMPONENT
// ================================

export default function Experience() {
    const { streamData, sessionActive, startStreaming, stopStreaming } = useCortex();

    const [isRunning, setIsRunning] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const [isSleepMode, setIsSleepMode] = useState(false); // Critical: affects "Lucid Dreaming" labeling
    const [showEmotions, setShowEmotions] = useState(true); // Emotion overlay toggle
    const [showDebug, setShowDebug] = useState(false); // Debug overlay (press D)
    const [showConnectionDebug, setShowConnectionDebug] = useState(false); // Connection debug (press C)
    const [showSummary, setShowSummary] = useState(false); // Session summary modal
    const [sessionRecord, setSessionRecord] = useState<SessionRecord | null>(null);

    // Session collector for recording data
    const sessionCollectorRef = useRef<SessionCollector | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const demoTimeRef = useRef(0);

    const [simulatedStreamData, setSimulatedStreamData] = useState<{
        data: Record<string, unknown> | null;
        stream: string;
    } | null>(null);

    const activeStreamData = isDemo ? simulatedStreamData : streamData;

    // LAYER A: Raw Stream
    const { latestPOW, latestMET, lastSampleTs, isStale } = useEEGStream(activeStreamData);

    // LAYER A.1: CONNECTION STATE MACHINE (single source of truth for connection status)
    // Implements hysteresis: DISCONNECTED → CONNECTING → CONNECTED → DEGRADED → STALE → DISCONNECTED
    const connectionState = useConnectionState(isRunning, activeStreamData);

    // LAYER A.2: STABLE DATA STORE (caches last-known values, applies EMA smoothing)
    // Never loses data on temporary connection drops
    const { quality: eegQuality, resetSessionStats: resetEEGQualityStats } = useEEGQuality(
        activeStreamData,
        sessionActive || isDemo
    );
    const stableDataStore = useStableDataStore(latestPOW, latestMET, eegQuality);

    // LAYER B: Inference (6.7Hz) - pass isSleepMode for proper state labeling
    const { candidates } = useInference(latestPOW, latestMET, isSleepMode);

    // LAYER C: Emotion Inference (5Hz) - feeds into state machine
    const emotionResult = useEmotionInference(latestPOW, latestMET);

    // LAYER D: STATE MACHINE (SINGLE SOURCE OF TRUTH)
    // Uses useReducer for deterministic state transitions
    // Implements hysteresis to prevent fast switching
    // Timer resets ONLY when currentStateId actually changes
    const { output: stateMachine, debug } = useStateMachine(candidates, emotionResult);

    // Debug keyboard shortcuts (D for state machine debug, C for connection debug)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'd' || e.key === 'D') {
                setShowDebug(prev => !prev);
            }
            if (e.key === 'c' || e.key === 'C') {
                setShowConnectionDebug(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Demo mode simulation
    useEffect(() => {
        if (!isDemo) {
            if (demoIntervalRef.current) {
                clearInterval(demoIntervalRef.current);
                demoIntervalRef.current = null;
            }
            return;
        }

        if (demoIntervalRef.current) return;

        demoIntervalRef.current = setInterval(() => {
            demoTimeRef.current += 0.1;
            const t = demoTimeRef.current;

            // Slower oscillation for more stable states
            const phase = (Math.sin(t * 0.02) + 1) / 2;
            const subPhase = (Math.sin(t * 0.08) + 1) / 2;
            const noise = () => (Math.random() - 0.5) * 0.06;

            const pow = [
                0.25 + phase * 0.45 + subPhase * 0.12 + noise(),
                0.35 + (1 - phase) * 0.35 + subPhase * 0.15 + noise(),
                0.30 - phase * 0.15 + noise(),
                0.30 - phase * 0.20 + noise(),
                0.15 + phase * 0.35 * subPhase + noise(),
            ];

            setSimulatedStreamData({
                data: { pow },
                stream: 'pow',
            });
        }, 100);

        return () => {
            if (demoIntervalRef.current) {
                clearInterval(demoIntervalRef.current);
                demoIntervalRef.current = null;
            }
        };
    }, [isDemo]);

    // Canvas animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const particles: Particle[] = [];

        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(canvas.offsetWidth, canvas.offsetHeight));
        }

        const animate = () => {
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;

            ctx.clearRect(0, 0, w, h);

            const color = stateMachine.currentState.color;
            const confidence = stateMachine.currentState.confidence / 100;
            const tier = stateMachine.currentState.tier;
            const transitionStatus = tier === 'locked' ? 'STABILIZING' :
                tier === 'confirmed' ? 'TRANSITION' : 'HOLDING';

            drawBackground(ctx, w, h, color, confidence);
            drawWaves(ctx, w, h, color, confidence, transitionStatus);

            particles.forEach(p => {
                p.update(stateMachine, w, h);
                p.draw(ctx, stateMachine);
            });

            if (confidence > 0.35) {
                drawConnections(ctx, particles, stateMachine);
            }

            drawCenterOrb(ctx, w / 2, h / 2, stateMachine);

            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationId);
        };
    }, [stateMachine]);

    const handleStart = useCallback(async () => {
        if (sessionActive) {
            try {
                // Subscribe to pow, met, and dev (for quality) streams
                await startStreaming(['pow', 'met', 'dev'] as any);
                setIsRunning(true);
                setIsDemo(false);
            } catch {
                setIsDemo(true);
                setIsRunning(true);
            }
        } else {
            setIsDemo(true);
            setIsRunning(true);
            demoTimeRef.current = 0;
        }
        // Initialize session collector
        sessionCollectorRef.current = createSessionCollector();
    }, [sessionActive, startStreaming]);

    // Record data samples when running
    useEffect(() => {
        if (!isRunning || !sessionCollectorRef.current) return;

        // Record state sample
        addStateSample(
            sessionCollectorRef.current,
            stateMachine.currentState.id,
            stateMachine.currentState.confidence,
            stateMachine.currentState.tier as 'candidate' | 'confirmed' | 'locked'
        );

        // Record emotion sample
        addEmotionSample(
            sessionCollectorRef.current,
            emotionResult.axes.valence,
            emotionResult.axes.arousal,
            emotionResult.axes.control,
            emotionResult.topEmotions
        );

        // Record band power sample
        addBandPowerSample(
            sessionCollectorRef.current,
            latestPOW.theta,
            latestPOW.alpha,
            latestPOW.betaL,
            latestPOW.betaH,
            latestPOW.gamma
        );

        // Record EEG quality sample (if available)
        if (eegQuality.available) {
            // Get bad sensor names from per-sensor data (now a Record, not array)
            const badSensorNames = eegQuality.perSensor
                ? Object.values(eegQuality.perSensor)
                    .filter(s => s.rawValue <= 1)
                    .map(s => s.name)
                : [];
            addEEGQualitySample(
                sessionCollectorRef.current,
                eegQuality.eegQualityPercent,  // From Emotiv stream
                eegQuality.badSensorsCount,    // From per-sensor data
                badSensorNames
            );
        }
    }, [isRunning, stateMachine, emotionResult, latestPOW, eegQuality]);

    const handleStop = useCallback(async () => {
        if (!isDemo && isRunning) {
            try {
                await stopStreaming(['pow', 'met']);
            } catch {
                // Ignore stop errors
            }
        }

        // Finalize and show session summary
        if (sessionCollectorRef.current) {
            const record = finalizeSession(sessionCollectorRef.current);
            setSessionRecord(record);
            setShowSummary(true);
        }

        setIsRunning(false);
        setIsDemo(false);
        setSimulatedStreamData(null);
    }, [isDemo, isRunning, stopStreaming]);

    return (
        <div className={styles.container}>
            <canvas ref={canvasRef} className={styles.canvas} />

            {/* POW Bar - ALWAYS visible (uses smoothed data from stable store) */}
            <POWBar
                pow={stableDataStore.bandPower}
                isStale={stableDataStore.bandPower.isStale}
                connectionLabel={connectionState.label}
                connectionState={connectionState.state}
            />

            <div className={styles.overlay}>
                {/* Top controls */}
                <div className={styles.topBar}>
                    <h2 className={styles.title}>Consciousness Explorer</h2>
                    {!isRunning ? (
                        <button onClick={handleStart} className={styles.startBtn}>
                            {sessionActive ? '🧠 Start Analysis' : '✨ Demo Mode'}
                        </button>
                    ) : (
                        <div className={styles.controlsGroup}>
                            <QualityBadge quality={eegQuality} />
                            <button
                                onClick={() => setIsSleepMode(!isSleepMode)}
                                className={`${styles.sleepToggle} ${isSleepMode ? styles.sleepActive : ''}`}
                                title={isSleepMode ? 'Sleep mode enabled - Lucid Dreaming can be detected' : 'Awake mode - Lucid patterns labeled as Dreamlike Awareness'}
                            >
                                {isSleepMode ? '🌙 Sleep' : '☀️ Awake'}
                            </button>
                            <button onClick={handleStop} className={styles.stopBtn}>
                                ⏹ Stop
                            </button>
                            <button
                                onClick={() => setShowEmotions(!showEmotions)}
                                className={`${styles.emotionToggle} ${showEmotions ? styles.emotionActive : ''}`}
                                title={showEmotions ? 'Hide emotion overlay' : 'Show emotion overlay'}
                            >
                                {showEmotions ? '💭' : '◯'}
                            </button>
                        </div>
                    )}
                </div>

                {/* 3-Part Layout */}
                {isRunning && (
                    <StateMachineOrbArea model={stateMachine} />
                )}

                {!isRunning && (
                    <div className={styles.legend}>
                        <p>Real-time EEG interpretation with stable state detection</p>
                        <ul>
                            <li>Duration-based state validation tiers</li>
                            <li>All timing lives with the Current State</li>
                            <li>Challengers shown on close race or strong signal</li>
                            <li>Single source of truth for stability</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Emotion Overlay - READ-ONLY with Info Panel */}
            <EmotionOverlay
                emotion={emotionResult}
                isVisible={isRunning && showEmotions}
                bandPowers={latestPOW}
            />

            {/* Frequency Reference */}
            {isRunning && <FrequencyReference />}

            {/* Debug Overlay - Press D to toggle */}
            <DebugOverlay debug={debug} visible={showDebug} />

            {/* Connection Debug Overlay - Press C to toggle */}
            <ConnectionDebugOverlay
                connection={connectionState}
                dataStore={stableDataStore}
                eegQualityRaw={eegQuality}
                isVisible={showConnectionDebug}
                onToggle={() => setShowConnectionDebug(prev => !prev)}
            />

            {/* Session Summary Modal */}
            {showSummary && sessionRecord && (
                <SessionSummaryModal
                    record={sessionRecord}
                    onSave={() => {
                        setShowSummary(false);
                        setSessionRecord(null);
                        sessionCollectorRef.current = null;
                    }}
                    onDiscard={() => {
                        setShowSummary(false);
                        setSessionRecord(null);
                        sessionCollectorRef.current = null;
                    }}
                    onViewRecords={() => {
                        setShowSummary(false);
                        // Navigate to records - would need tab state lifted
                    }}
                />
            )}
        </div>
    );
}

// ================================
// POW BAR - ALWAYS MOUNTED (never unmounts for stability)
// ================================

// Types imported at top of file from useConnectionState and useStableDataStore

interface POWBarProps {
    pow: SmoothedPOWData;
    isStale: boolean;
    connectionLabel?: string;
    connectionState?: ConnectionState;
}

const CONNECTION_STATE_COLORS: Record<ConnectionState, string> = {
    connected: '#22c55e',
    degraded: '#f59e0b',
    stale: '#ef4444',
    disconnected: '#64748b',
    connecting: '#3b82f6',
};

function POWBar({ pow, isStale, connectionLabel, connectionState = 'disconnected' }: POWBarProps) {
    const bands = [
        { name: 'Theta', value: pow.theta, color: '#8b5cf6' },
        { name: 'Alpha', value: pow.alpha, color: '#22c55e' },
        { name: 'Beta-L', value: pow.betaL, color: '#3b82f6' },
        { name: 'Beta-H', value: pow.betaH, color: '#f59e0b' },
        { name: 'Gamma', value: pow.gamma, color: '#ef4444' },
    ];

    const stateColor = CONNECTION_STATE_COLORS[connectionState];

    return (
        <div className={`${styles.powBar} ${isStale ? styles.powBarStale : ''}`}>
            {/* Connection Status Indicator */}
            {connectionLabel && (
                <span
                    className={styles.connectionIndicator}
                    style={{ color: stateColor }}
                    title={`Connection: ${connectionState}`}
                >
                    <span
                        className={styles.connectionDot}
                        style={{ backgroundColor: stateColor }}
                    />
                    {connectionLabel}
                </span>
            )}

            <span className={styles.powLabel} title="Band Power (relative, not Hz)">BAND PWR</span>
            {bands.map(band => (
                <div key={band.name} className={styles.powBand}>
                    <div className={styles.powMeter}>
                        <div
                            className={styles.powFill}
                            style={{
                                width: `${Math.min(100, band.value * 100)}%`,
                                backgroundColor: band.color,
                                opacity: isStale ? 0.5 : 1,
                            }}
                        />
                    </div>
                    <span className={styles.powName}>{band.name}</span>
                    <span className={styles.powValue} style={{ color: isStale ? '#666' : band.color }}>
                        {isStale ? '—' : (band.value * 100).toFixed(0)}
                    </span>
                </div>
            ))}
            {isStale && <span className={styles.staleIndicator}>⏳</span>}
        </div>
    );
}

// ================================
// STATE MACHINE ORB AREA
// ================================

interface StateMachineOrbAreaProps {
    model: StateMachineOutput;
}

function StateMachineOrbArea({ model }: StateMachineOrbAreaProps) {
    const { currentState, challenger, transitionLabel } = model;

    return (
        <div className={styles.orbArea}>
            {/* LEFT: Current State - SINGLE SOURCE OF TRUTH */}
            <div className={styles.leftCard}>
                <SMCurrentStateCard state={currentState} />
            </div>

            {/* CENTER */}
            <div className={styles.centerArea}>
                <SMTransitionBadge state={currentState} />
                <div className={styles.orbPlaceholder} />
                <div className={styles.dominantBands}>
                    {currentState.dominantBands.map((band: string) => (
                        <span key={band} className={styles.bandTag}>{band}</span>
                    ))}
                </div>
            </div>

            {/* RIGHT: Challenger - NO duration (not promoted) */}
            <div className={styles.rightCard}>
                <SMChallengerCard challenger={challenger} />
            </div>
        </div>
    );
}

// ================================
// STATE MACHINE CURRENT STATE CARD
// SINGLE SOURCE: Duration, Tier, Stability all here
// ================================

// Tier display info
const TIER_ICONS: Record<string, string> = {
    detected: '○',
    candidate: '◐',
    confirmed: '●',
    locked: '🔒',
};

const TIER_COLORS: Record<string, string> = {
    detected: '#f59e0b',
    candidate: '#3b82f6',
    confirmed: '#22c55e',
    locked: '#a855f7',
};

function SMCurrentStateCard({ state }: { state: DisplayState }) {
    const stateInfo = getStateInfo(state.id);

    return (
        <StatePopover
            stateInfo={stateInfo}
            confidence={state.confidence}
            lockedSince={state.lockedDurationMs > 0 ? Date.now() - state.lockedDurationMs : undefined}
            status={state.tier === 'locked' ? 'locked' : 'candidate'}
        >
            <div
                className={`${styles.stateCard} ${styles.currentCard}`}
                style={{ borderColor: state.color }}
            >
                <span className={styles.stateCardTitle}>Current State</span>
                <span
                    className={styles.stateCardName}
                    style={{ color: state.color }}
                >
                    {state.name}
                </span>

                {/* DURATION - SINGLE SOURCE OF TRUTH */}
                <div className={styles.durationDisplay}>
                    <span className={styles.durationTime}>{state.durationFormatted}</span>
                    <span
                        className={styles.tierBadge}
                        style={{
                            color: TIER_COLORS[state.tier],
                            borderColor: TIER_COLORS[state.tier]
                        }}
                    >
                        {TIER_ICONS[state.tier]} {state.tierLabel}
                    </span>
                </div>

                {/* Confidence */}
                <div className={styles.confidenceRing}>
                    <svg viewBox="0 0 36 36" className={styles.ringChart}>
                        <path
                            className={styles.ringBg}
                            d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                            className={styles.ringFill}
                            style={{
                                stroke: state.color,
                                strokeDasharray: `${state.confidence}, 100`
                            }}
                            d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                    </svg>
                    <span className={styles.ringValue}>{state.confidence}%</span>
                </div>

                {/* Stability Status */}
                <div className={`${styles.stabilityBadge} ${styles[state.stabilityStatus]}`}>
                    {state.stabilityStatus === 'stable' && '✓ Stable'}
                    {state.stabilityStatus === 'unstable' && '⚠ Unstable'}
                    {state.stabilityStatus === 'transitioning' && '↻ Transitioning'}
                </div>
            </div>
        </StatePopover>
    );
}

// ================================
// STATE MACHINE CHALLENGER CARD (NO duration - not promoted)
// ================================

function SMChallengerCard({ challenger }: { challenger: ChallengerDisplay | null }) {
    if (!challenger) {
        return (
            <div className={`${styles.stateCard} ${styles.challengerCard} ${styles.noChallenger}`}>
                <span className={styles.stateCardTitle}>Challenger</span>
                <div className={styles.noChallengerContent}>
                    <span className={styles.noChallengerIcon}>⬡</span>
                    <span className={styles.noChallengerText}>No challenger</span>
                </div>
                <span className={styles.challengerHint}>State is stable</span>
            </div>
        );
    }

    const stateInfo = getStateInfo(challenger.id);

    return (
        <StatePopover
            stateInfo={stateInfo}
            confidence={challenger.confidence}
            status="challenger"
        >
            <div
                className={`${styles.stateCard} ${styles.challengerCard}`}
                style={{ borderColor: challenger.color }}
            >
                <span className={styles.stateCardTitle}>Challenger</span>
                <span
                    className={styles.stateCardName}
                    style={{ color: challenger.color }}
                >
                    {challenger.name}
                </span>

                {/* Show lead duration if candidate */}
                {challenger.isCandidate && (
                    <span className={styles.challengerNote}>
                        Leading for {Math.round(challenger.leadDurationMs / 1000)}s
                    </span>
                )}

                {/* Confidence bar */}
                <div className={styles.challengerConfidence}>
                    <div className={styles.challengerBar}>
                        <div
                            className={styles.challengerFill}
                            style={{
                                width: `${challenger.confidence}%`,
                                backgroundColor: challenger.color
                            }}
                        />
                    </div>
                    <span className={styles.challengerValue}>{challenger.confidence}%</span>
                </div>

                <span className={styles.challengerBadge}>
                    {challenger.isCandidate ? '🎯 CANDIDATE' : '⚡ CONTENDING'}
                </span>
            </div>
        </StatePopover>
    );
}

// ================================
// STATE MACHINE TRANSITION BADGE
// ================================

function SMTransitionBadge({ state }: { state: DisplayState }) {
    // Derive badge from state tier and stability
    let label = 'DETECTING';
    let emoji = '○';
    let className = styles.badgeHolding;

    if (state.tier === 'locked' && state.isStable) {
        label = 'LOCKED';
        emoji = '🔒';
        className = styles.badgeStabilizing;
    } else if (state.tier === 'confirmed') {
        label = 'CONFIRMED';
        emoji = '●';
        className = styles.badgeTransition;
    } else if (state.tier === 'candidate') {
        label = 'CANDIDATE';
        emoji = '◐';
        className = styles.badgeTransition;
    } else if (!state.isStable) {
        label = 'UNSTABLE';
        emoji = '⚠';
        className = styles.badgeHolding;
    }

    return (
        <div className={`${styles.transitionBadge} ${className}`}>
            <span className={styles.badgeEmoji}>{emoji}</span>
            <span className={styles.badgeLabel}>{label}</span>
        </div>
    );
}

// ================================
// DRAWING HELPERS
// ================================

function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 220, s: 50, l: 20 };

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
    confidence: number
) {
    const hsl = hexToHSL(color);
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);

    const sat = 10 + confidence * 18;
    const light = 5 + confidence * 7;

    gradient.addColorStop(0, `hsl(${hsl.h}, ${sat}%, ${light + 4}%)`);
    gradient.addColorStop(0.5, `hsl(${hsl.h + 12}, ${sat - 4}%, ${light}%)`);
    gradient.addColorStop(1, `hsl(${hsl.h + 25}, ${sat - 8}%, ${light - 2}%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

function drawWaves(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
    confidence: number,
    status: string // 'STABILIZING' | 'TRANSITION' | 'HOLDING'
) {
    const time = Date.now() / 1000;
    const hsl = hexToHSL(color);

    ctx.globalAlpha = status === 'STABILIZING' ? 0.12 : 0.06 + confidence * 0.06;

    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hsl.h + i * 12}, 45%, 50%, ${0.1 + confidence * 0.06})`;
        ctx.lineWidth = status === 'STABILIZING' ? 1.5 : 1;

        const amplitude = 12 + i * 10 + confidence * 20;
        const frequency = 0.25 + i * 0.12;
        const speed = status === 'STABILIZING' ? 0.12 : 0.25 + confidence * 0.15;
        const yOffset = h * 0.22 + i * (h * 0.18);

        for (let x = 0; x < w; x += 4) {
            const y = yOffset + Math.sin((x / w) * Math.PI * frequency * 4 + time * speed + i) * amplitude;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawCenterOrb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    model: StateMachineOutput
) {
    const time = Date.now() / 1000;
    const color = model.currentState.color;
    const hsl = hexToHSL(color);
    const confidence = model.currentState.confidence / 100;
    const tier = model.currentState.tier;

    // Map tier to status for animation
    const isStabilizing = tier === 'locked';
    const isTransition = tier === 'confirmed' || tier === 'candidate';

    let baseRadius = 45 + confidence * 25;
    let pulseSpeed = 0.8;
    let pulseAmount = 8;

    if (isTransition) { pulseSpeed = 1.5; pulseAmount = 12; }
    if (isStabilizing) { baseRadius += 15; pulseSpeed = 0.35; pulseAmount = 6; }
    if (tier === 'detected') { pulseSpeed = 2; pulseAmount = 5; }

    const pulse = Math.sin(time * pulseSpeed) * pulseAmount * confidence;
    const radius = baseRadius + pulse;

    const glowLayers = isStabilizing ? 4 : 2;
    for (let i = glowLayers; i > 0; i--) {
        const glowRadius = radius * (1 + i * 0.3);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${0.18 / i})`);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    const coreGradient = ctx.createRadialGradient(x - radius * 0.18, y - radius * 0.18, 0, x, y, radius);
    coreGradient.addColorStop(0, `hsla(${hsl.h}, 75%, 78%, 1)`);
    coreGradient.addColorStop(0.5, `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.85)`);
    coreGradient.addColorStop(1, `hsla(${hsl.h + 12}, ${hsl.s - 18}%, ${hsl.l - 12}%, 0.55)`);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.fill();
}

function drawConnections(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    model: StateMachineOutput
) {
    const confidence = model.currentState.confidence / 100;
    const maxDist = 45 + confidence * 30;
    const hsl = hexToHSL(model.currentState.color);
    const isStabilizing = model.currentState.tier === 'locked';

    ctx.lineWidth = isStabilizing ? 0.8 : 0.4;

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
                const alpha = (1 - dist / maxDist) * 0.06 * confidence;
                ctx.strokeStyle = `hsla(${hsl.h}, 38%, 52%, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

// ================================
// PARTICLE CLASS
// ================================

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    hueOffset: number;

    constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.radius = Math.random() * 2 + 0.8;
        this.hueOffset = Math.random() * 25 - 12;
    }

    update(model: StateMachineOutput, w: number, h: number) {
        const tier = model.currentState.tier;
        const isStabilizing = tier === 'locked';
        const isTransition = tier === 'confirmed' || tier === 'candidate';

        let speed = 0.3;
        let chaos = 0.008;

        if (isTransition) { speed = 0.45; chaos = 0.018; }
        if (isStabilizing) {
            speed = 0.18;
            chaos = 0.004;
            const cx = w / 2, cy = h / 2;
            const dx = cx - this.x, dy = cy - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 60) {
                this.vx += (dx / dist) * 0.006;
                this.vy += (dy / dist) * 0.006;
            }
        }
        if (tier === 'detected') { speed = 0.15; chaos = 0.003; }

        this.vx += (Math.random() - 0.5) * chaos;
        this.vy += (Math.random() - 0.5) * chaos;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.x += this.vx * speed;
        this.y += this.vy * speed;

        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;
    }

    draw(ctx: CanvasRenderingContext2D, model: StateMachineOutput) {
        const color = model.currentState.color;
        const hsl = hexToHSL(color);
        const confidence = model.currentState.confidence / 100;
        const isStabilizing = model.currentState.tier === 'locked';

        const hue = hsl.h + this.hueOffset;
        const size = this.radius * (0.75 + confidence * 0.3);
        const alpha = isStabilizing ? 0.35 + confidence * 0.3 : 0.18 + confidence * 0.22;

        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 45%, 52%, ${alpha})`;
        ctx.fill();
    }
}
