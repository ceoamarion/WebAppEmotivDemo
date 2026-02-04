/**
 * Tutorial Page
 * 
 * Adaptive guidance page that helps users reach calmer/higher states.
 * Uses session data to personalize recommendations.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { loadAllSessions, SessionRecord } from '@/data/sessionStorage';
import { EmotionResult, EmotionAxes } from '@/hooks/useEmotionInference';
import { DisplayState } from '@/hooks/useStateMachine';
import { POWData } from '@/hooks/useEEGStream';
import { EEGQualityPayload } from '@/hooks/useEEGQuality';
import { QualityBadge } from './QualityBadge';
import styles from './Tutorial.module.css';

// ================================
// TYPES
// ================================

interface TutorialProps {
    currentState?: DisplayState | null;
    emotion?: EmotionResult | null;
    bandPowers?: POWData | null;
    eegQuality?: EEGQualityPayload | null;
    isConnected: boolean;
}

type GuidanceStep = 'stabilize' | 'downshift' | 'enhance' | 'sustain';

interface PersonalizedInsight {
    pattern: string;
    recommendation: string;
}

// ================================
// COMPONENT
// ================================

export function Tutorial({ currentState, emotion, bandPowers, isConnected }: TutorialProps) {
    const [activeStep, setActiveStep] = useState<GuidanceStep>('stabilize');
    const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
    const [breathTimer, setBreathTimer] = useState(0);
    const [isBreathingActive, setIsBreathingActive] = useState(false);

    // Load historical sessions for personalization
    const sessions = useMemo(() => loadAllSessions(), []);

    // Personalized insights from past sessions
    const insights = useMemo(() => deriveInsights(sessions), [sessions]);

    // Real-time feedback
    const feedback = useMemo(() => {
        if (!emotion || !currentState) return null;
        return generateFeedback(emotion, currentState, bandPowers);
    }, [emotion, currentState, bandPowers]);

    // Breathing exercise timer
    useEffect(() => {
        if (!isBreathingActive) return;

        const interval = setInterval(() => {
            setBreathTimer(prev => {
                const newVal = prev + 0.1;
                // 4s inhale, 2s hold, 6s exhale
                if (breathPhase === 'inhale' && newVal >= 4) {
                    setBreathPhase('hold');
                    return 0;
                } else if (breathPhase === 'hold' && newVal >= 2) {
                    setBreathPhase('exhale');
                    return 0;
                } else if (breathPhase === 'exhale' && newVal >= 6) {
                    setBreathPhase('inhale');
                    return 0;
                }
                return newVal;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isBreathingActive, breathPhase]);

    const steps: { id: GuidanceStep; label: string; icon: string; description: string }[] = [
        { id: 'stabilize', label: 'Stabilize Signal', icon: '📡', description: 'Reduce artifacts and motion' },
        { id: 'downshift', label: 'Downshift Arousal', icon: '🌊', description: 'Calm the nervous system' },
        { id: 'enhance', label: 'Enhance Clarity', icon: '✨', description: 'Balance Alpha/Theta' },
        { id: 'sustain', label: 'Sustain', icon: '🎯', description: 'Maintain the state' },
    ];

    return (
        <div className={styles.container}>
            {/* Disclaimer */}
            <div className={styles.disclaimer}>
                ⚠️ <strong>Guidance only.</strong> Not a medical device. This is for exploration and relaxation.
            </div>

            {/* Connection Status */}
            {!isConnected && (
                <div className={styles.disconnected}>
                    🔌 Connect your Emotiv headset and start a session to receive personalized guidance.
                </div>
            )}

            {/* Guidance Loop Steps */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Guidance Loop</h2>
                <div className={styles.stepsContainer}>
                    {steps.map((step, index) => (
                        <button
                            key={step.id}
                            className={`${styles.stepCard} ${activeStep === step.id ? styles.active : ''}`}
                            onClick={() => setActiveStep(step.id)}
                        >
                            <span className={styles.stepNumber}>{index + 1}</span>
                            <span className={styles.stepIcon}>{step.icon}</span>
                            <span className={styles.stepLabel}>{step.label}</span>
                            <span className={styles.stepDesc}>{step.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Active Step Content */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    {steps.find(s => s.id === activeStep)?.icon} {steps.find(s => s.id === activeStep)?.label}
                </h2>

                {activeStep === 'stabilize' && (
                    <div className={styles.stepContent}>
                        <h3>Reduce Movement Artifacts</h3>
                        <ul className={styles.tipList}>
                            <li>🪑 Sit in a comfortable, stable position</li>
                            <li>👀 Keep eyes softly closed or fixed on a single point</li>
                            <li>🦷 Relax jaw muscles - unclench teeth</li>
                            <li>💆 Loosen facial muscles, especially forehead</li>
                            <li>🧘 Keep head still - avoid nodding or turning</li>
                        </ul>
                        {isConnected && feedback && (
                            <div className={styles.feedback}>
                                <span className={styles.feedbackIcon}>{feedback.stabilityIcon}</span>
                                <span>{feedback.stabilityMessage}</span>
                            </div>
                        )}
                    </div>
                )}

                {activeStep === 'downshift' && (
                    <div className={styles.stepContent}>
                        <h3>Breathing Exercise (4-2-6)</h3>
                        <div className={styles.breathingBox}>
                            <div
                                className={styles.breathCircle}
                                style={{
                                    transform: isBreathingActive
                                        ? breathPhase === 'inhale'
                                            ? `scale(${1 + breathTimer / 8})`
                                            : breathPhase === 'hold'
                                                ? 'scale(1.5)'
                                                : `scale(${1.5 - breathTimer / 12})`
                                        : 'scale(1)'
                                }}
                            >
                                <span className={styles.breathLabel}>
                                    {isBreathingActive ? breathPhase.toUpperCase() : 'START'}
                                </span>
                            </div>
                            <button
                                className={styles.breathButton}
                                onClick={() => {
                                    setIsBreathingActive(!isBreathingActive);
                                    setBreathPhase('inhale');
                                    setBreathTimer(0);
                                }}
                            >
                                {isBreathingActive ? '⏹ Stop' : '▶ Start Breathing'}
                            </button>
                        </div>
                        <ul className={styles.tipList}>
                            <li>4 seconds inhale through nose</li>
                            <li>2 seconds hold</li>
                            <li>6 seconds exhale through mouth</li>
                        </ul>
                        {isConnected && feedback && (
                            <div className={styles.feedback}>
                                <span className={styles.feedbackIcon}>{feedback.arousalIcon}</span>
                                <span>{feedback.arousalMessage}</span>
                            </div>
                        )}
                    </div>
                )}

                {activeStep === 'enhance' && (
                    <div className={styles.stepContent}>
                        <h3>Increase Alpha/Theta Balance</h3>
                        <ul className={styles.tipList}>
                            <li>🧘 Focus on the space behind your closed eyes</li>
                            <li>💭 Let thoughts pass without engaging</li>
                            <li>🔔 If using audio, try binaural beats (8-12 Hz)</li>
                            <li>🌿 Visualize a calm, natural scene</li>
                            <li>👁️ Eyes closed generally promotes Alpha</li>
                        </ul>
                        {isConnected && bandPowers && (
                            <div className={styles.bandReadout}>
                                <div className={styles.bandItem}>
                                    <span>Alpha</span>
                                    <div className={styles.bandBar}>
                                        <div
                                            className={styles.bandFill}
                                            style={{
                                                width: `${Math.min(bandPowers.alpha * 20, 100)}%`,
                                                backgroundColor: '#22c55e'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.bandItem}>
                                    <span>Theta</span>
                                    <div className={styles.bandBar}>
                                        <div
                                            className={styles.bandFill}
                                            style={{
                                                width: `${Math.min(bandPowers.theta * 20, 100)}%`,
                                                backgroundColor: '#8b5cf6'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {isConnected && feedback && (
                            <div className={styles.feedback}>
                                <span className={styles.feedbackIcon}>{feedback.clarityIcon}</span>
                                <span>{feedback.clarityMessage}</span>
                            </div>
                        )}
                    </div>
                )}

                {activeStep === 'sustain' && (
                    <div className={styles.stepContent}>
                        <h3>Maintain Your State</h3>
                        <ul className={styles.tipList}>
                            <li>⏰ Set a timer for 5-10 minutes</li>
                            <li>🔄 Return to breath if mind wanders</li>
                            <li>📊 Check the orb visualization for feedback</li>
                            <li>🎯 Aim to sustain for progressively longer periods</li>
                        </ul>
                        {isConnected && currentState && (
                            <div className={styles.currentStateBox}>
                                <span className={styles.stateLabel}>Current State:</span>
                                <span className={styles.stateName} style={{ color: currentState.color }}>
                                    {currentState.name}
                                </span>
                                <span className={styles.stateDuration}>{currentState.durationFormatted}</span>
                            </div>
                        )}
                        {isConnected && feedback && (
                            <div className={styles.feedback}>
                                <span className={styles.feedbackIcon}>{feedback.sustainIcon}</span>
                                <span>{feedback.sustainMessage}</span>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Personalization Section */}
            {insights.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>🎯 Personalized Insights</h2>
                    <p className={styles.insightNote}>
                        Based on your last {sessions.length} session{sessions.length !== 1 ? 's' : ''}:
                    </p>
                    <div className={styles.insightsList}>
                        {insights.map((insight, i) => (
                            <div key={i} className={styles.insightCard}>
                                <span className={styles.insightPattern}>{insight.pattern}</span>
                                <span className={styles.insightRec}>{insight.recommendation}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Real-time Trends */}
            {isConnected && feedback && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>📈 Real-time Trends</h2>
                    <div className={styles.trendsGrid}>
                        <div className={`${styles.trendCard} ${feedback.arousalTrend}`}>
                            <span className={styles.trendLabel}>Arousal</span>
                            <span className={styles.trendValue}>{feedback.arousalTrend}</span>
                        </div>
                        <div className={`${styles.trendCard} ${feedback.valenceTrend}`}>
                            <span className={styles.trendLabel}>Valence</span>
                            <span className={styles.trendValue}>{feedback.valenceTrend}</span>
                        </div>
                        <div className={`${styles.trendCard} ${feedback.controlTrend}`}>
                            <span className={styles.trendLabel}>Control</span>
                            <span className={styles.trendValue}>{feedback.controlTrend}</span>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

// ================================
// HELPERS
// ================================

function deriveInsights(sessions: SessionRecord[]): PersonalizedInsight[] {
    if (sessions.length === 0) return [];

    const insights: PersonalizedInsight[] = [];

    // Find best state pattern
    const stateCounts: Record<string, number> = {};
    for (const session of sessions) {
        if (session.bestState.stateId !== 'ordinary_waking') {
            stateCounts[session.bestState.stateId] = (stateCounts[session.bestState.stateId] || 0) + 1;
        }
    }

    const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];
    if (topState) {
        insights.push({
            pattern: `Best state: ${formatStateName(topState[0])}`,
            recommendation: 'This state appears most achievable for you. Focus on conditions that led to it.',
        });
    }

    // Average band powers across sessions
    const avgBands = { alpha: 0, theta: 0, betaH: 0 };
    let bandCount = 0;
    for (const session of sessions) {
        if (session.bandPowerAverages) {
            avgBands.alpha += session.bandPowerAverages.alpha;
            avgBands.theta += session.bandPowerAverages.theta;
            avgBands.betaH += session.bandPowerAverages.betaH;
            bandCount++;
        }
    }

    if (bandCount > 0) {
        avgBands.alpha /= bandCount;
        avgBands.theta /= bandCount;
        avgBands.betaH /= bandCount;

        if (avgBands.alpha > avgBands.theta && avgBands.alpha > avgBands.betaH) {
            insights.push({
                pattern: 'Strong Alpha signature',
                recommendation: 'Your calm pattern involves high Alpha. Try eyes-closed relaxation.',
            });
        } else if (avgBands.betaH > avgBands.alpha) {
            insights.push({
                pattern: 'Elevated Beta-H detected',
                recommendation: 'Consider reducing mental activity. Breathing exercises may help.',
            });
        }
    }

    // Stability trend
    const recentStability = sessions.slice(0, 3).map(s => s.stabilityPct);
    if (recentStability.length >= 2) {
        const trend = recentStability[0] - recentStability[recentStability.length - 1];
        if (trend > 10) {
            insights.push({
                pattern: 'Stability improving',
                recommendation: 'Your signal stability is trending up. Keep minimizing movement.',
            });
        }
    }

    return insights.slice(0, 3);
}

interface Feedback {
    stabilityIcon: string;
    stabilityMessage: string;
    arousalIcon: string;
    arousalMessage: string;
    arousalTrend: string;
    clarityIcon: string;
    clarityMessage: string;
    sustainIcon: string;
    sustainMessage: string;
    valenceTrend: string;
    controlTrend: string;
}

function generateFeedback(
    emotion: EmotionResult,
    state: DisplayState,
    bandPowers?: POWData | null
): Feedback {
    const { axes } = emotion;

    // Arousal trend
    let arousalTrend = 'stable';
    let arousalMessage = 'Arousal is moderate';
    let arousalIcon = '○';
    if (axes.arousal < 0.3) {
        arousalTrend = 'low';
        arousalMessage = 'Arousal is low - relaxed state';
        arousalIcon = '🌊';
    } else if (axes.arousal > 0.7) {
        arousalTrend = 'high';
        arousalMessage = 'Arousal is elevated - try breathing';
        arousalIcon = '🔥';
    }

    // Valence trend
    let valenceTrend = 'neutral';
    if (axes.valence > 0.2) valenceTrend = 'positive';
    else if (axes.valence < -0.2) valenceTrend = 'negative';

    // Control trend
    let controlTrend = 'moderate';
    if (axes.control > 0.6) controlTrend = 'high';
    else if (axes.control < 0.4) controlTrend = 'low';

    // Stability
    let stabilityIcon = '📡';
    let stabilityMessage = 'Signal quality looks stable';
    if (state.variance > 20) {
        stabilityIcon = '⚠️';
        stabilityMessage = 'High variance detected - try to stay still';
    }

    // Clarity (Alpha/Theta)
    let clarityIcon = '✨';
    let clarityMessage = 'Alpha levels appear normal';
    if (bandPowers) {
        const alphaRatio = bandPowers.alpha / (bandPowers.betaH + 0.1);
        if (alphaRatio > 1.5) {
            clarityMessage = 'Strong Alpha presence - good clarity';
        } else if (alphaRatio < 0.5) {
            clarityIcon = '💭';
            clarityMessage = 'Low Alpha - try closing eyes and relaxing';
        }
    }

    // Sustain
    let sustainIcon = '🎯';
    let sustainMessage = 'Maintain current state';
    if (state.tier === 'locked') {
        sustainIcon = '✅';
        sustainMessage = `State locked for ${state.durationFormatted}!`;
    } else if (state.tier === 'confirmed') {
        sustainMessage = 'Good - state is confirming. Keep steady.';
    }

    return {
        stabilityIcon,
        stabilityMessage,
        arousalIcon,
        arousalMessage,
        arousalTrend,
        clarityIcon,
        clarityMessage,
        sustainIcon,
        sustainMessage,
        valenceTrend,
        controlTrend,
    };
}

function formatStateName(stateId: string): string {
    return stateId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default Tutorial;
