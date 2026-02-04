/**
 * EmotionInfoPanel
 * 
 * Detailed info panel for the Emotion/Axes widget.
 * Shows how emotions are computed and contributing signals.
 */

'use client';

import React from 'react';
import { EmotionResult } from '@/hooks/useEmotionInference';
import { POWData } from '@/hooks/useEEGStream';
import styles from './EmotionInfoPanel.module.css';

interface EmotionInfoPanelContentProps {
    emotion: EmotionResult;
    bandPowers?: POWData | null;
}

// Emotion colors
const EMOTION_COLORS: Record<string, string> = {
    'joy/happy': '#fbbf24',
    'calm/peace': '#22c55e',
    'gratitude': '#a855f7',
    'love/connection': '#ec4899',
    'curiosity': '#3b82f6',
    'confidence': '#f59e0b',
    'awe': '#818cf8',
    'anxiety': '#ef4444',
    'stress': '#f97316',
    'fear': '#dc2626',
    'sadness': '#6366f1',
    'anger/irritation': '#b91c1c',
    'frustration': '#ea580c',
    'shame/guilt': '#7c3aed',
    'overwhelm': '#9333ea',
    'neutral': '#64748b',
};

export function EmotionInfoPanelContent({ emotion, bandPowers }: EmotionInfoPanelContentProps) {
    const { axes, topEmotions, emotionNote } = emotion;

    // Determine contributing signals
    const contributingSignals = getContributingSignals(axes, bandPowers);

    return (
        <div className={styles.container}>
            {/* Axes Explanation */}
            <section className={styles.section}>
                <h4 className={styles.sectionTitle}>Dimensional Axes</h4>
                <div className={styles.axesList}>
                    <div className={styles.axisExplain}>
                        <span className={styles.axisName}>Valence</span>
                        <span className={styles.axisRange}>negative ↔ positive</span>
                        <span className={styles.axisValue} style={{ color: axes.valence > 0 ? '#22c55e' : axes.valence < 0 ? '#ef4444' : '#64748b' }}>
                            {axes.valence > 0 ? '+' : ''}{(axes.valence * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className={styles.axisExplain}>
                        <span className={styles.axisName}>Arousal</span>
                        <span className={styles.axisRange}>low ↔ high</span>
                        <span className={styles.axisValue} style={{ color: axes.arousal > 0.6 ? '#f59e0b' : axes.arousal < 0.4 ? '#3b82f6' : '#a855f7' }}>
                            {(axes.arousal * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className={styles.axisExplain}>
                        <span className={styles.axisName}>Control</span>
                        <span className={styles.axisRange}>overwhelmed ↔ composed</span>
                        <span className={styles.axisValue} style={{ color: axes.control > 0.6 ? '#22c55e' : axes.control < 0.4 ? '#ef4444' : '#f59e0b' }}>
                            {(axes.control * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </section>

            {/* Top Emotions */}
            <section className={styles.section}>
                <h4 className={styles.sectionTitle}>Top Emotions</h4>
                <div className={styles.emotionsList}>
                    {topEmotions.slice(0, 3).map((em, i) => (
                        <div key={em.label} className={styles.emotionRow}>
                            <span
                                className={styles.emotionDot}
                                style={{ backgroundColor: EMOTION_COLORS[em.label] || '#64748b' }}
                            />
                            <span className={styles.emotionLabel}>{em.label}</span>
                            <span className={styles.emotionConf}>{em.confidence}%</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Emotion Note */}
            <section className={styles.section}>
                <h4 className={styles.sectionTitle}>Summary</h4>
                <p className={styles.note}>{emotionNote}</p>
            </section>

            {/* How It's Computed */}
            <section className={styles.section}>
                <h4 className={styles.sectionTitle}>How It&apos;s Computed</h4>
                <ul className={styles.computeList}>
                    <li>• Stress/Relaxation/Focus/Engagement signals</li>
                    <li>• Band power patterns (Alpha, Theta, Beta, Gamma)</li>
                    <li>• Facial EMG signals <span className={styles.unavailable}>(if available)</span></li>
                </ul>
            </section>

            {/* Contributing Signals */}
            <section className={styles.section}>
                <h4 className={styles.sectionTitle}>Why This Emotion?</h4>
                <div className={styles.signalsList}>
                    {contributingSignals.length > 0 ? (
                        contributingSignals.map((signal, i) => (
                            <div key={i} className={styles.signalRow}>
                                <span className={styles.signalIcon}>{signal.icon}</span>
                                <span className={styles.signalText}>{signal.text}</span>
                            </div>
                        ))
                    ) : (
                        <span className={styles.noSignals}>Analyzing signals...</span>
                    )}
                </div>
            </section>
        </div>
    );
}

interface ContributingSignal {
    icon: string;
    text: string;
}

function getContributingSignals(
    axes: { valence: number; arousal: number; control: number },
    bandPowers?: POWData | null
): ContributingSignal[] {
    const signals: ContributingSignal[] = [];

    // Valence-based signals
    if (axes.valence > 0.3) {
        signals.push({ icon: '✨', text: 'Positive valence trend' });
    } else if (axes.valence < -0.3) {
        signals.push({ icon: '⚡', text: 'Negative valence detected' });
    }

    // Arousal-based signals
    if (axes.arousal > 0.7) {
        signals.push({ icon: '🔥', text: 'Elevated arousal' });
    } else if (axes.arousal < 0.3) {
        signals.push({ icon: '🌊', text: 'Low arousal / Relaxed state' });
    }

    // Control-based signals
    if (axes.control > 0.7) {
        signals.push({ icon: '🎯', text: 'High composure / Control' });
    } else if (axes.control < 0.3) {
        signals.push({ icon: '⚠️', text: 'Low control / Overwhelmed' });
    }

    // Band power signals
    if (bandPowers) {
        const total = bandPowers.theta + bandPowers.alpha + bandPowers.betaL + bandPowers.betaH + bandPowers.gamma || 1;
        const alphaPct = (bandPowers.alpha / total) * 100;
        const thetaPct = (bandPowers.theta / total) * 100;
        const betaHPct = (bandPowers.betaH / total) * 100;
        const gammaPct = (bandPowers.gamma / total) * 100;

        if (alphaPct > 25) {
            signals.push({ icon: '🧘', text: `Strong Alpha (${alphaPct.toFixed(0)}%)` });
        }
        if (thetaPct > 30) {
            signals.push({ icon: '💭', text: `Elevated Theta (${thetaPct.toFixed(0)}%)` });
        }
        if (betaHPct > 25) {
            signals.push({ icon: '🧠', text: `High Beta-H (${betaHPct.toFixed(0)}%)` });
        }
        if (gammaPct > 20) {
            signals.push({ icon: '⚡', text: `Active Gamma (${gammaPct.toFixed(0)}%)` });
        }
    }

    return signals.slice(0, 4); // Max 4 signals
}

export default EmotionInfoPanelContent;
