/**
 * Emotion Overlay Component
 * 
 * READ-ONLY display of emotion inference.
 * Now includes hoverable InfoPanel for detailed explanation.
 */

"use client";

import React, { useState } from 'react';
import { EmotionResult, EmotionLabel } from '@/hooks/useEmotionInference';
import { POWData } from '@/hooks/useEEGStream';
import InfoPanel from './InfoPanel';
import { EmotionInfoPanelContent } from './EmotionInfoPanel';
import styles from './EmotionOverlay.module.css';

interface EmotionOverlayProps {
    emotion: EmotionResult;
    isVisible: boolean;
    bandPowers?: POWData | null;
}

// Emotion colors
const EMOTION_COLORS: Record<EmotionLabel, string> = {
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

export function EmotionOverlay({ emotion, isVisible, bandPowers }: EmotionOverlayProps) {
    const { axes, topEmotions, emotionNote, isTranscendenceUnstable } = emotion;
    const [isPinned, setIsPinned] = useState(false);

    // Determine valence indicator
    const valenceEmoji = axes.valence > 0.2 ? '✨' : axes.valence < -0.2 ? '⚡' : '○';
    const valenceLabel = axes.valence > 0.2 ? 'Positive' : axes.valence < -0.2 ? 'Negative' : 'Neutral';

    const overlayContent = (
        <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}>
            {/* Dimensional Axes */}
            <div className={styles.axesPanel}>
                <div className={styles.axisRow}>
                    <span className={styles.axisLabel}>Valence</span>
                    <div className={styles.axisBar}>
                        <div
                            className={styles.axisFill}
                            style={{
                                width: `${((axes.valence + 1) / 2) * 100}%`,
                                backgroundColor: axes.valence > 0 ? '#22c55e' : axes.valence < 0 ? '#ef4444' : '#64748b'
                            }}
                        />
                        <div className={styles.axisCenter} />
                    </div>
                    <span className={styles.axisValue}>{valenceEmoji} {valenceLabel}</span>
                </div>

                <div className={styles.axisRow}>
                    <span className={styles.axisLabel}>Arousal</span>
                    <div className={styles.axisBar}>
                        <div
                            className={styles.axisFill}
                            style={{
                                width: `${axes.arousal * 100}%`,
                                backgroundColor: axes.arousal > 0.6 ? '#f59e0b' : axes.arousal < 0.4 ? '#3b82f6' : '#a855f7'
                            }}
                        />
                    </div>
                    <span className={styles.axisValue}>{(axes.arousal * 100).toFixed(0)}%</span>
                </div>

                <div className={styles.axisRow}>
                    <span className={styles.axisLabel}>Control</span>
                    <div className={styles.axisBar}>
                        <div
                            className={styles.axisFill}
                            style={{
                                width: `${axes.control * 100}%`,
                                backgroundColor: axes.control > 0.6 ? '#22c55e' : axes.control < 0.4 ? '#ef4444' : '#f59e0b'
                            }}
                        />
                    </div>
                    <span className={styles.axisValue}>{(axes.control * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Top Emotions */}
            <div className={styles.emotionsPanel}>
                <span className={styles.emotionsLabel}>Emotions</span>
                <div className={styles.emotionsList}>
                    {topEmotions.map((em, i) => (
                        <div
                            key={`${em.label}-${i}`}
                            className={styles.emotionChip}
                            style={{ borderColor: EMOTION_COLORS[em.label] }}
                        >
                            <span
                                className={styles.emotionDot}
                                style={{ backgroundColor: EMOTION_COLORS[em.label] }}
                            />
                            <span className={styles.emotionName}>{em.label}</span>
                            <span className={styles.emotionConf}>{em.confidence}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Emotion Note */}
            <div className={styles.notePanel}>
                <span className={styles.noteText}>{emotionNote}</span>
            </div>

            {/* Transcendence Instability Warning */}
            {isTranscendenceUnstable && (
                <div className={styles.instabilityBadge}>
                    ⚠️ Emotional Instability
                </div>
            )}
        </div>
    );

    return (
        <InfoPanel
            title="Emotional Readout"
            subtitle="Probabilistic inference (not certainty)"
            placement="right-start"
            isPinned={isPinned}
            onPinChange={setIsPinned}
            width={360}
            content={
                <EmotionInfoPanelContent
                    emotion={emotion}
                    bandPowers={bandPowers}
                />
            }
        >
            {overlayContent}
        </InfoPanel>
    );
}

// Frequency Ranges Reference Component
export function FrequencyReference() {
    const bands = [
        { name: 'Delta', range: '0.5–4 Hz', color: '#64748b' },
        { name: 'Theta', range: '4–8 Hz', color: '#8b5cf6' },
        { name: 'Alpha', range: '8–12 Hz', color: '#22c55e' },
        { name: 'Beta-L', range: '12–16 Hz', color: '#3b82f6' },
        { name: 'Beta-H', range: '16–30 Hz', color: '#f59e0b' },
        { name: 'Gamma', range: '30–80+ Hz', color: '#ef4444' },
    ];

    return (
        <div className={styles.freqRef}>
            <span className={styles.freqRefTitle}>Band Frequency Ranges</span>
            <div className={styles.freqRefList}>
                {bands.map(band => (
                    <div key={band.name} className={styles.freqRefItem}>
                        <span
                            className={styles.freqRefDot}
                            style={{ backgroundColor: band.color }}
                        />
                        <span className={styles.freqRefName}>{band.name}</span>
                        <span className={styles.freqRefRange}>{band.range}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Peak Frequency Display (only if available)
interface PeakFrequencyProps {
    peakHz: number | null;
    peakBand: string | null;
}

export function PeakFrequencyDisplay({ peakHz, peakBand }: PeakFrequencyProps) {
    if (peakHz === null) {
        return (
            <div className={styles.peakFreq}>
                <span className={styles.peakLabel}>Peak Frequency:</span>
                <span className={styles.peakUnavailable}>
                    unavailable (requires spectral/FFT data)
                </span>
            </div>
        );
    }

    return (
        <div className={styles.peakFreq}>
            <span className={styles.peakLabel}>Peak Frequency:</span>
            <span className={styles.peakValue}>{peakHz.toFixed(1)} Hz</span>
            {peakBand && (
                <span className={styles.peakBand}>({peakBand})</span>
            )}
        </div>
    );
}
