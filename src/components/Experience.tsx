"use client";

/**
 * Experience Component - Refactored for Stability
 * 
 * Uses Zustand session store as SINGLE SOURCE OF TRUTH.
 * All UI components are ALWAYS MOUNTED to prevent flicker.
 * Correct field mapping for EEG Quality, Battery, Signal.
 * 
 * Key Changes:
 * - Removed duplicate local state
 * - Integrated useSessionStore for centralized data
 * - StablePOWBar and StableEmotionPanel are always mounted
 * - Connection state uses hysteresis to prevent flapping
 * - EMA smoothing on band power and emotions
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCortex } from '@/context/CortexContext';
import { useEEGStream } from '@/hooks/useEEGStream';
import { useEEGQuality } from '@/hooks/useEEGQuality';
import { useInference } from '@/hooks/useInference';
import { useEmotionInference } from '@/hooks/useEmotionInference';
import type { StreamType } from '@/services/cortex';
import {
    useStateMachine,
    StateMachineOutput,
    DisplayState,
    ChallengerDisplay,
} from '@/hooks/useStateMachine';

// Zustand session store - SINGLE SOURCE OF TRUTH
import { useSessionStore } from '@/stores/sessionStore';

// Stable components that are ALWAYS MOUNTED
import { StablePOWBar } from './StablePOWBar';
import { StableEmotionPanel } from './StableEmotionPanel';
import { EEGStatusBadge } from './EEGStatusBadge';

// Other components
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

    // UI state (NOT data state - that's in Zustand store)
    const [isRunning, setIsRunning] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const [isSleepMode, setIsSleepMode] = useState(false);
    const [showEmotions, setShowEmotions] = useState(true);
    const [showDebug, setShowDebug] = useState(false);
    const [showConnectionDebug, setShowConnectionDebug] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [sessionRecord, setSessionRecord] = useState<SessionRecord | null>(null);
    const [emotionPanelCollapsed, setEmotionPanelCollapsed] = useState(false);

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

    // ZUSTAND STORE - Get data and actions (use stable function references)
    const setStoreSessionActive = useSessionStore(s => s.setSessionActive);
    const setStoreDemoMode = useSessionStore(s => s.setDemoMode);
    const receiveStreamPacket = useSessionStore(s => s.receiveStreamPacket);
    const updateEmotions = useSessionStore(s => s.updateEmotions);
    const updateBandPower = useSessionStore(s => s.updateBandPower);
    const resetSession = useSessionStore(s => s.resetSession);
    const storeTick = useSessionStore(s => s.tick);

    // Get state for ConnectionDebugOverlay (read-only)
    const sessionStoreState = useSessionStore();

    // LAYER A: Raw Stream (still needed for state machine)
    const { latestPOW, latestMET } = useEEGStream(activeStreamData);

    // LAYER A.1: EEG Quality (for QualityBadge popover details)
    const { quality: eegQuality } = useEEGQuality(
        activeStreamData,
        sessionActive || isDemo
    );

    // LAYER B: Inference (6.7Hz)
    const { candidates } = useInference(latestPOW, latestMET, isSleepMode);

    // LAYER C: Emotion Inference (5Hz)
    const emotionResult = useEmotionInference(latestPOW, latestMET);

    // LAYER D: STATE MACHINE
    const { output: stateMachine, debug } = useStateMachine(candidates, emotionResult);

    // ================================
    // SYNC TO ZUSTAND STORE
    // ================================

    // Sync stream data to store
    useEffect(() => {
        if (activeStreamData?.data && activeStreamData.stream) {
            receiveStreamPacket(activeStreamData.stream, activeStreamData.data);
        }
    }, [activeStreamData, receiveStreamPacket]);

    // Sync session active state
    useEffect(() => {
        setStoreSessionActive(isRunning);
    }, [isRunning, setStoreSessionActive]);

    // Sync demo mode to store
    useEffect(() => {
        setStoreDemoMode(isDemo);
        return () => { setStoreDemoMode(false); };
    }, [isDemo, setStoreDemoMode]);

    // Sync emotions to store
    useEffect(() => {
        if (emotionResult.axes && emotionResult.topEmotions) {
            updateEmotions(
                emotionResult.axes,
                emotionResult.topEmotions.map(e => ({ name: e.label, score: e.confidence }))
            );
        }
    }, [emotionResult, updateEmotions]);

    // NOTE: Mind state is NOT synced to Zustand store to avoid infinite loops.
    // The state machine (useStateMachine) is the source of truth for mind state.
    // Use stateMachine.currentState and stateMachine.challenger directly in UI.

    // Store tick loop (runs every 500ms for stale detection)
    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => {
            storeTick();
        }, 500);
        return () => clearInterval(interval);
    }, [isRunning, storeTick]);

    // ================================
    // KEYBOARD SHORTCUTS
    // ================================

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

    // ================================
    // DEMO MODE SIMULATION
    // ================================

    useEffect(() => {
        if (!isDemo) {
            if (demoIntervalRef.current) {
                clearInterval(demoIntervalRef.current);
                demoIntervalRef.current = null;
            }
            return;
        }

        if (demoIntervalRef.current) return;

        // Smooth random-walk state for band power simulation
        const smoothed = { theta: 0.3, alpha: 0.45, betaL: 0.3, betaH: 0.25, gamma: 0.15, delta: 0.1 };
        const velocity = { theta: 0, alpha: 0, betaL: 0, betaH: 0, gamma: 0, delta: 0 };

        demoIntervalRef.current = setInterval(() => {
            demoTimeRef.current += 0.15;
            const t = demoTimeRef.current;

            // Slow macro-phase: breathe between calm / focused / active states
            const phase = (Math.sin(t * 0.018) + 1) / 2;          // 0..1 calm -> active
            const subPhase = (Math.sin(t * 0.055 + 1.2) + 1) / 2; // 0..1 secondary oscillation

            // Target band power values driven by phase
            const targets = {
                theta: 0.22 + (1 - phase) * 0.30 + subPhase * 0.08,  // high in calm
                alpha: 0.30 + (1 - phase) * 0.38 + subPhase * 0.10,  // high in calm
                betaL: 0.25 + phase * 0.28 + subPhase * 0.06,        // high in focus
                betaH: 0.18 + phase * 0.22 + (1 - subPhase) * 0.05, // high in active
                gamma: 0.10 + phase * 0.20 * subPhase,               // spikes when both high
                delta: 0.08 + (1 - phase) * 0.12,
            };

            // Apply EMA-like smooth random walk toward target
            const drift = 0.006;
            const tension = 0.08;
            for (const k of Object.keys(smoothed) as (keyof typeof smoothed)[]) {
                velocity[k] = velocity[k] * 0.92 + (targets[k] - smoothed[k]) * tension + (Math.random() - 0.5) * drift;
                smoothed[k] = Math.max(0.05, Math.min(0.99, smoothed[k] + velocity[k]));
            }

            // Write directly to Zustand store so the POW bar gets live values
            updateBandPower({ ...smoothed });

            // Also feed the legacy stream path for the state machine
            setSimulatedStreamData({
                data: [smoothed.theta, smoothed.alpha, smoothed.betaL, smoothed.betaH, smoothed.gamma] as unknown as Record<string, unknown>,
                stream: 'pow',
            });
        }, 150);

        return () => {
            if (demoIntervalRef.current) {
                clearInterval(demoIntervalRef.current);
                demoIntervalRef.current = null;
            }
        };
    }, [isDemo, updateBandPower]);

    // ================================
    // CANVAS ANIMATION
    // ================================

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

    // ================================
    // SESSION RECORDING
    // ================================

    useEffect(() => {
        if (!isRunning || !sessionCollectorRef.current) return;

        addStateSample(
            sessionCollectorRef.current,
            stateMachine.currentState.id,
            stateMachine.currentState.confidence,
            stateMachine.currentState.tier as 'candidate' | 'confirmed' | 'locked'
        );

        addEmotionSample(
            sessionCollectorRef.current,
            emotionResult.axes.valence,
            emotionResult.axes.arousal,
            emotionResult.axes.control,
            emotionResult.topEmotions
        );

        addBandPowerSample(
            sessionCollectorRef.current,
            latestPOW.theta,
            latestPOW.alpha,
            latestPOW.betaL,
            latestPOW.betaH,
            latestPOW.gamma
        );

        if (eegQuality.available) {
            const badSensorNames = eegQuality.perSensor
                ? Object.values(eegQuality.perSensor)
                    .filter(s => s.rawValue <= 1)
                    .map(s => s.name)
                : [];
            addEEGQualitySample(
                sessionCollectorRef.current,
                eegQuality.eegQualityPercent,
                eegQuality.badSensorsCount,
                badSensorNames
            );
        }
    }, [isRunning, stateMachine, emotionResult, latestPOW, eegQuality]);

    // ================================
    // HANDLERS
    // ================================

    const handleStart = useCallback(async () => {
        if (sessionActive) {
            try {
                const streams: StreamType[] = ['pow', 'met', 'dev'];
                await startStreaming(streams);
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
        sessionCollectorRef.current = createSessionCollector();
    }, [sessionActive, startStreaming]);

    const handleStop = useCallback(async () => {
        if (!isDemo && isRunning) {
            try {
                const streams: StreamType[] = ['pow', 'met'];
                await stopStreaming(streams);
            } catch {
                // Ignore stop errors
            }
        }

        if (sessionCollectorRef.current) {
            const record = finalizeSession(sessionCollectorRef.current);
            setSessionRecord(record);
            setShowSummary(true);
        }

        setIsRunning(false);
        setIsDemo(false);
        setSimulatedStreamData(null);

        // Reset store
        resetSession();
    }, [isDemo, isRunning, stopStreaming, resetSession]);

    // ================================
    // RENDER
    // ================================

    return (
        <div className={styles.container}>
            <canvas ref={canvasRef} className={styles.canvas} />

            {/* STABLE POW BAR - ALWAYS MOUNTED (from Zustand store) */}
            <StablePOWBar />

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
                            {/* EEG Status Badge - shows correct EEG/Battery/Signal from store */}
                            <EEGStatusBadge />

                            {/* Quality Badge with detailed popover */}
                            <QualityBadge quality={eegQuality} />

                            <button
                                onClick={() => setIsSleepMode(!isSleepMode)}
                                className={`${styles.sleepToggle} ${isSleepMode ? styles.sleepActive : ''}`}
                                title={isSleepMode ? 'Sleep mode enabled' : 'Awake mode'}
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

            {/* STABLE EMOTION PANEL - ALWAYS MOUNTED (from Zustand store) */}
            <StableEmotionPanel
                collapsed={emotionPanelCollapsed || !showEmotions || !isRunning}
                onToggle={() => setEmotionPanelCollapsed(prev => !prev)}
            />

            {/* Emotion Overlay - existing component for visual feedback */}
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
                connection={{
                    state: sessionStoreState.connectionState,
                    label: sessionStoreState.connectionLabel,
                    lastPacketAgeMs: sessionStoreState.lastPacketAt ? Date.now() - sessionStoreState.lastPacketAt : -1,
                    lastPacketAt: sessionStoreState.lastPacketAt,
                    isReceivingData: sessionStoreState.connectionState === 'connected',
                    packetRate: sessionStoreState.packetRate,
                    reconnectAttempts: 0,
                }}
                dataStore={{
                    bandPower: {
                        ...sessionStoreState.bandPower,
                        isStale: sessionStoreState.bandPowerStale,
                        lastUpdatedAt: sessionStoreState.bandPowerLastUpdate,
                        dominantBand: sessionStoreState.dominantBand,
                        dominantBandStable: sessionStoreState.dominantBand,
                    },
                    rawBandPower: sessionStoreState.rawBandPower,
                    metrics: {
                        stress: 0,
                        relaxation: 0,
                        engagement: 0,
                        focus: 0,
                        excitement: 0,
                        interest: 0,
                        isStale: sessionStoreState.emotionsStale,
                        lastUpdatedAt: sessionStoreState.emotionsLastUpdate,
                    },
                    quality: {
                        eegQualityPercent: sessionStoreState.device.eegQuality,
                        badSensorsCount: sessionStoreState.badSensorCount,
                        goodSensorsCount: sessionStoreState.goodSensorCount,
                        totalSensors: 14,
                        isStale: false,
                        lastUpdatedAt: Date.now(),
                        source: sessionStoreState.device.eegQuality !== null ? 'stream' : 'unavailable',
                    },
                    isDataStale: sessionStoreState.bandPowerStale || sessionStoreState.emotionsStale,
                    lastAnyUpdateAt: Math.max(sessionStoreState.bandPowerLastUpdate, sessionStoreState.emotionsLastUpdate),
                }}
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
                    }}
                />
            )}
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
    const { currentState, challenger } = model;

    return (
        <div className={styles.orbArea}>
            {/* LEFT: Current State */}
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

            {/* RIGHT: Challenger */}
            <div className={styles.rightCard}>
                <SMChallengerCard challenger={challenger} />
            </div>
        </div>
    );
}

// ================================
// STATE MACHINE CURRENT STATE CARD
// ================================

interface SMCurrentStateCardProps {
    state: DisplayState;
}

function SMCurrentStateCard({ state }: SMCurrentStateCardProps) {
    const info = getStateInfo(state.id);
    const tierProgress = getTierProgress(state.tier, state.durationMs);
    const { color, progressColor } = getTierStyles(state.tier);

    return (
        <div className={styles.stateCard} style={{ borderColor: state.color }}>
            <StatePopover stateInfo={info} confidence={state.confidence}>
                <div className={styles.stateCardHeader}>
                    <span className={styles.stateCardEmoji}>🧠</span>
                    <div className={styles.stateCardInfo}>
                        <span className={styles.stateCardName}>{info.name}</span>
                        <span className={styles.stateCardDesc} style={{ color: state.color }}>
                            {state.confidence.toFixed(0)}% confidence
                        </span>
                    </div>
                </div>
            </StatePopover>

            {/* Circular progress ring */}
            <div className={styles.confidenceRing}>
                <svg viewBox="0 0 36 36" className={styles.ringCircle}>
                    <circle className={styles.ringBg} cx="18" cy="18" r="15.9" />
                    <circle
                        className={styles.ringFill}
                        cx="18" cy="18" r="15.9"
                        style={{
                            stroke: state.color,
                            strokeDasharray: `${state.confidence}, 100`
                        }}
                    />
                </svg>
                <span className={styles.ringValue}>{state.confidence.toFixed(0)}</span>
            </div>

            {/* Tier badge */}
            <div className={styles.lockedBadge} style={{ background: color, color: progressColor }}>
                {state.tier === 'locked' ? '🔒 LOCKED' :
                    state.tier === 'confirmed' ? '✓ CONFIRMED' : '○ CANDIDATE'}
            </div>

            {/* Duration (only source of time) */}
            <div className={styles.durationBox}>
                <span className={styles.durationValue}>
                    {formatDuration(state.durationMs)}
                </span>
                <span className={styles.durationLabel}>in state</span>
            </div>

            {/* Tier progress bar */}
            <div className={styles.tierProgress}>
                <div className={styles.tierProgressBar}>
                    <div
                        className={styles.tierProgressFill}
                        style={{ width: `${tierProgress * 100}%`, background: progressColor }}
                    />
                </div>
                <span className={styles.tierProgressLabel}>
                    {getNextTierLabel(state.tier, state.durationMs)}
                </span>
            </div>
        </div>
    );
}

// ================================
// STATE MACHINE TRANSITION BADGE
// ================================

function SMTransitionBadge({ state }: { state: DisplayState }) {
    const { icon, label, color } = getStatusBadge(state.tier, state.durationMs);

    return (
        <div className={styles.transitionBadge} style={{ background: color }}>
            <span className={styles.badgeEmoji}>{icon}</span>
            <span className={styles.badgeLabel}>{label}</span>
        </div>
    );
}

// ================================
// STATE MACHINE CHALLENGER CARD
// ================================

interface SMChallengerCardProps {
    challenger: ChallengerDisplay | null;
}

function SMChallengerCard({ challenger }: SMChallengerCardProps) {
    if (!challenger) {
        return (
            <div className={styles.stateCard + ' ' + styles.noChallenger}>
                <div className={styles.noChallengerContent}>
                    <span className={styles.noChallengerIcon}>—</span>
                    <span className={styles.noChallengerText}>No challenger</span>
                    <span className={styles.challengerHint}>
                        Another state will appear here when competing for dominance
                    </span>
                </div>
            </div>
        );
    }

    const info = getStateInfo(challenger.id);

    return (
        <div
            className={styles.stateCard}
            style={{ borderColor: challenger.color, opacity: 0.85 }}
        >
            <StatePopover stateInfo={info} confidence={challenger.confidence} status="challenger">
                <div className={styles.stateCardHeader}>
                    <span className={styles.stateCardEmoji}>🧠</span>
                    <div className={styles.stateCardInfo}>
                        <span className={styles.stateCardName}>{info.name}</span>
                        <span className={styles.stateCardDesc} style={{ color: challenger.color }}>
                            Challenger
                        </span>
                    </div>
                </div>
            </StatePopover>

            <div className={styles.confidenceRing}>
                <svg viewBox="0 0 36 36" className={styles.ringCircle}>
                    <circle className={styles.ringBg} cx="18" cy="18" r="15.9" />
                    <circle
                        className={styles.ringFill}
                        cx="18" cy="18" r="15.9"
                        style={{
                            stroke: challenger.color,
                            strokeDasharray: `${challenger.confidence}, 100`
                        }}
                    />
                </svg>
                <span className={styles.ringValue}>{challenger.confidence.toFixed(0)}</span>
            </div>

            <div className={styles.challengerConfidence}>
                <span>{challenger.confidence.toFixed(0)}% confidence</span>
            </div>

            <div className={styles.challengerGap}>
                Lead: {(challenger.leadDurationMs / 1000).toFixed(1)}s
            </div>

            {challenger.isCandidate && (
                <div className={styles.contendingBadge}>
                    ⚡ Candidate
                </div>
            )}
        </div>
    );
}

// ================================
// HELPER FUNCTIONS
// ================================

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function getTierProgress(tier: string, durationMs: number): number {
    const CANDIDATE_MS = 6000;
    const CONFIRMED_MS = 15000;
    const LOCKED_MS = 30000;

    if (tier === 'candidate') {
        return Math.min(1, durationMs / CANDIDATE_MS);
    } else if (tier === 'confirmed') {
        return Math.min(1, (durationMs - CANDIDATE_MS) / (CONFIRMED_MS - CANDIDATE_MS));
    } else if (tier === 'locked') {
        return Math.min(1, (durationMs - CONFIRMED_MS) / (LOCKED_MS - CONFIRMED_MS));
    }
    return 0;
}

function getTierStyles(tier: string): { color: string; progressColor: string } {
    switch (tier) {
        case 'locked':
            return { color: 'rgba(34, 197, 94, 0.25)', progressColor: '#22c55e' };
        case 'confirmed':
            return { color: 'rgba(234, 179, 8, 0.25)', progressColor: '#eab308' };
        default:
            return { color: 'rgba(255, 255, 255, 0.1)', progressColor: '#888' };
    }
}

function getNextTierLabel(tier: string, durationMs: number): string {
    const CANDIDATE_MS = 6000;
    const CONFIRMED_MS = 15000;
    const LOCKED_MS = 30000;

    if (tier === 'candidate') {
        const remaining = Math.max(0, CANDIDATE_MS - durationMs);
        return remaining > 0 ? `Confirmed in ${(remaining / 1000).toFixed(0)}s` : 'Promoting...';
    } else if (tier === 'confirmed') {
        const remaining = Math.max(0, CONFIRMED_MS - durationMs);
        return remaining > 0 ? `Locked in ${(remaining / 1000).toFixed(0)}s` : 'Locking...';
    } else if (tier === 'locked') {
        return '🔒 Fully Locked';
    }
    return '';
}

function getStatusBadge(tier: string, durationMs: number): { icon: string; label: string; color: string } {
    if (tier === 'locked') {
        return { icon: '🔒', label: 'STABLE', color: 'rgba(34, 197, 94, 0.3)' };
    }
    if (tier === 'confirmed') {
        return { icon: '✓', label: 'CONFIRMING', color: 'rgba(234, 179, 8, 0.3)' };
    }
    if (durationMs > 3000) {
        return { icon: '○', label: 'DETECTING', color: 'rgba(255, 255, 255, 0.15)' };
    }
    return { icon: '◌', label: 'SENSING', color: 'rgba(255, 255, 255, 0.1)' };
}

// ================================
// CANVAS DRAWING FUNCTIONS
// ================================

class Particle {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    size: number;
    speed: number;
    angle: number;
    distance: number;
    opacity: number;

    constructor(width: number, height: number) {
        this.baseX = Math.random() * width;
        this.baseY = Math.random() * height;
        this.x = this.baseX;
        this.y = this.baseY;
        this.size = Math.random() * 2 + 1;
        this.speed = Math.random() * 0.5 + 0.1;
        this.angle = Math.random() * Math.PI * 2;
        this.distance = Math.random() * 50 + 20;
        this.opacity = Math.random() * 0.5 + 0.3;
    }

    update(model: StateMachineOutput, width: number, height: number) {
        const confidence = model.currentState.confidence / 100;
        this.angle += this.speed * 0.02 * (1 + confidence);
        this.x = this.baseX + Math.cos(this.angle) * this.distance * confidence;
        this.y = this.baseY + Math.sin(this.angle) * this.distance * confidence;

        if (this.x < 0 || this.x > width) this.baseX = Math.random() * width;
        if (this.y < 0 || this.y > height) this.baseY = Math.random() * height;
    }

    draw(ctx: CanvasRenderingContext2D, model: StateMachineOutput) {
        const color = model.currentState.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(')', `, ${this.opacity})`).replace('hsl', 'hsla');
        ctx.fill();
    }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, confidence: number) {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, `hsla(230, 20%, ${8 + confidence * 4}%, 1)`);
    gradient.addColorStop(1, 'hsl(220, 25%, 4%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

function drawWaves(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, confidence: number, status: string) {
    const time = Date.now() * 0.001;
    ctx.strokeStyle = color.replace(')', ', 0.1)').replace('hsl', 'hsla');
    ctx.lineWidth = 1;

    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 5) {
            const y = h / 2 +
                Math.sin(x * 0.01 + time + i) * (30 + confidence * 20) +
                Math.sin(x * 0.02 + time * 1.5) * 15;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawConnections(ctx: CanvasRenderingContext2D, particles: Particle[], model: StateMachineOutput) {
    const color = model.currentState.color;
    const maxDist = 80;

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
                const opacity = (1 - dist / maxDist) * 0.15;
                ctx.strokeStyle = color.replace(')', `, ${opacity})`).replace('hsl', 'hsla');
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function drawCenterOrb(ctx: CanvasRenderingContext2D, x: number, y: number, model: StateMachineOutput) {
    const color = model.currentState.color;
    const confidence = model.currentState.confidence / 100;
    const radius = 40 + confidence * 30;
    const time = Date.now() * 0.001;
    const pulse = Math.sin(time * 2) * 5 * confidence;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    glowGradient.addColorStop(0, color.replace(')', ', 0.3)').replace('hsl', 'hsla'));
    glowGradient.addColorStop(0.5, color.replace(')', ', 0.1)').replace('hsl', 'hsla'));
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Core orb
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, radius + pulse);
    coreGradient.addColorStop(0, 'white');
    coreGradient.addColorStop(0.3, color);
    coreGradient.addColorStop(1, color.replace(')', ', 0.5)').replace('hsl', 'hsla'));
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
    ctx.fill();
}

