/**
 * Stable Emotion Panel Component
 * 
 * ALWAYS mounted - never conditionally rendered/unmounted.
 * Shows emotion axes (Valence/Arousal/Control) and top 3 emotions.
 * When data missing, shows "awaiting data" state but stays visible.
 */

'use client';

import React from 'react';
import { useEmotions } from '@/stores/sessionStore';
import styles from './StableEmotionPanel.module.css';

interface EmotionPanelProps {
    collapsed?: boolean;
    onToggle?: () => void;
}

export function StableEmotionPanel({ collapsed = false, onToggle }: EmotionPanelProps) {
    const { axes, top3, stale } = useEmotions();

    const hasData = top3.length > 0 || axes.valence !== 0 || axes.arousal !== 0 || axes.control !== 0;

    // Format axis value for display
    const formatAxis = (value: number, range: 'bipolar' | 'unipolar'): string => {
        if (range === 'bipolar') {
            // -1 to +1
            const sign = value >= 0 ? '+' : '';
            return `${sign}${(value * 100).toFixed(0)}%`;
        }
        // 0 to 1
        return `${(value * 100).toFixed(0)}%`;
    };

    // Get axis bar width (0-100%)
    const getAxisWidth = (value: number, range: 'bipolar' | 'unipolar'): number => {
        if (range === 'bipolar') {
            return ((value + 1) / 2) * 100;
        }
        return value * 100;
    };

    // Get axis color
    const getAxisColor = (value: number, type: 'valence' | 'arousal' | 'control'): string => {
        if (type === 'valence') {
            return value >= 0 ? '#22c55e' : '#ef4444';
        }
        if (type === 'arousal') {
            return value > 0.5 ? '#f59e0b' : '#3b82f6';
        }
        return '#8b5cf6';
    };

    if (collapsed) {
        return (
            <div className={styles.collapsedPanel} onClick={onToggle}>
                <span className={styles.collapsedIcon}>😊</span>
                <span className={styles.collapsedLabel}>Emotions</span>
            </div>
        );
    }

    return (
        <div className={`${styles.panel} ${stale ? styles.stale : ''}`}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.title}>Emotion State</span>
                {stale && <span className={styles.staleBadge}>⏳ Stale</span>}
                {onToggle && (
                    <button className={styles.toggleBtn} onClick={onToggle} title="Collapse">
                        −
                    </button>
                )}
            </div>

            {/* Awaiting Data State */}
            {!hasData && (
                <div className={styles.awaitingData}>
                    <span className={styles.awaitingIcon}>🧠</span>
                    <span className={styles.awaitingText}>Awaiting emotion inference...</span>
                    <span className={styles.awaitingHint}>Data will appear when the stream begins</span>
                </div>
            )}

            {/* Emotion Axes */}
            {hasData && (
                <>
                    <div className={styles.axesSection}>
                        {/* Valence: -1 to +1 */}
                        <div className={styles.axisRow}>
                            <span className={styles.axisLabel}>Valence</span>
                            <div className={styles.axisBarContainer}>
                                <div className={styles.axisMidline} />
                                <div
                                    className={styles.axisBar}
                                    style={{
                                        width: `${getAxisWidth(axes.valence, 'bipolar')}%`,
                                        backgroundColor: getAxisColor(axes.valence, 'valence'),
                                    }}
                                />
                            </div>
                            <span className={styles.axisValue} style={{ color: getAxisColor(axes.valence, 'valence') }}>
                                {formatAxis(axes.valence, 'bipolar')}
                            </span>
                        </div>

                        {/* Arousal: 0 to 1 */}
                        <div className={styles.axisRow}>
                            <span className={styles.axisLabel}>Arousal</span>
                            <div className={styles.axisBarContainer}>
                                <div
                                    className={styles.axisBar}
                                    style={{
                                        width: `${getAxisWidth(axes.arousal, 'unipolar')}%`,
                                        backgroundColor: getAxisColor(axes.arousal, 'arousal'),
                                    }}
                                />
                            </div>
                            <span className={styles.axisValue} style={{ color: getAxisColor(axes.arousal, 'arousal') }}>
                                {formatAxis(axes.arousal, 'unipolar')}
                            </span>
                        </div>

                        {/* Control: 0 to 1 */}
                        <div className={styles.axisRow}>
                            <span className={styles.axisLabel}>Control</span>
                            <div className={styles.axisBarContainer}>
                                <div
                                    className={styles.axisBar}
                                    style={{
                                        width: `${getAxisWidth(axes.control, 'unipolar')}%`,
                                        backgroundColor: getAxisColor(axes.control, 'control'),
                                    }}
                                />
                            </div>
                            <span className={styles.axisValue} style={{ color: getAxisColor(axes.control, 'control') }}>
                                {formatAxis(axes.control, 'unipolar')}
                            </span>
                        </div>
                    </div>

                    {/* Top 3 Emotions */}
                    {top3.length > 0 && (
                        <div className={styles.top3Section}>
                            <div className={styles.sectionLabel}>Top Emotions</div>
                            {top3.map((emotion, index) => {
                                // Scores from useEmotionInference are already 0-100
                                // Normalize to 0-1 for bar width, clamp to 0-100 range for display
                                const normalizedScore = Math.min(100, Math.max(0, emotion.score));
                                const barWidth = normalizedScore; // Already 0-100
                                return (
                                    <div key={emotion.name} className={styles.emotionRow}>
                                        <span className={styles.emotionRank}>{index + 1}</span>
                                        <span className={styles.emotionName}>{emotion.name}</span>
                                        <div className={styles.emotionBarContainer}>
                                            <div
                                                className={styles.emotionBar}
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                        <span className={styles.emotionScore}>
                                            {normalizedScore.toFixed(0)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default StableEmotionPanel;
