/**
 * Duration Overlay Component
 * 
 * Displays duration-based validation status for mental states.
 * Shows tier progression, time tracking, and stability indicators.
 */

"use client";

import { ValidatedState, ValidationTier, DurationValidationResult } from '@/hooks/useDurationValidation';
import styles from './DurationOverlay.module.css';

interface DurationOverlayProps {
    validation: DurationValidationResult;
    isVisible: boolean;
}

// Tier colors
const TIER_COLORS: Record<ValidationTier, string> = {
    detected: '#f59e0b',    // Amber
    candidate: '#3b82f6',   // Blue
    confirmed: '#22c55e',   // Green
    locked: '#a855f7',      // Purple
};

const TIER_ICONS: Record<ValidationTier, string> = {
    detected: '○',
    candidate: '◐',
    confirmed: '●',
    locked: '🔒',
};

export function DurationOverlay({ validation, isVisible }: DurationOverlayProps) {
    const { currentState, transitionStatus, transitionLabel } = validation;

    return (
        <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}>
            {/* Current Tier */}
            <div className={styles.tierSection}>
                <div className={styles.tierHeader}>
                    <span
                        className={styles.tierIcon}
                        style={{ color: TIER_COLORS[currentState.tier] }}
                    >
                        {TIER_ICONS[currentState.tier]}
                    </span>
                    <span
                        className={styles.tierLabel}
                        style={{ color: TIER_COLORS[currentState.tier] }}
                    >
                        {currentState.tierLabel}
                    </span>
                </div>

                {/* Duration */}
                <div className={styles.duration}>
                    <span className={styles.durationValue}>{currentState.durationFormatted}</span>
                    <span className={styles.durationLabel}>duration</span>
                </div>
            </div>

            {/* Progress to Next Tier */}
            {currentState.nextTier && (
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span className={styles.progressLabel}>
                            → {currentState.nextTier.charAt(0).toUpperCase() + currentState.nextTier.slice(1)}
                        </span>
                        <span className={styles.progressPercent}>
                            {Math.round(currentState.progressToNextTier)}%
                        </span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{
                                width: `${currentState.progressToNextTier}%`,
                                backgroundColor: TIER_COLORS[currentState.nextTier]
                            }}
                        />
                    </div>
                    {currentState.timeToNextTier > 0 && (
                        <span className={styles.timeRemaining}>
                            {Math.ceil(currentState.timeToNextTier / 1000)}s remaining
                        </span>
                    )}
                </div>
            )}

            {/* Stability Indicators */}
            <div className={styles.stabilitySection}>
                <StabilityIndicator
                    label="Variance"
                    value={currentState.variance}
                    isGood={currentState.isStable}
                    format={(v) => v.toFixed(1)}
                />
                <StabilityIndicator
                    label="Emotional"
                    value={currentState.isEmotionallyStable ? 1 : 0}
                    isGood={currentState.isEmotionallyStable}
                    format={() => currentState.isEmotionallyStable ? 'Stable' : 'Unstable'}
                />
            </div>

            {/* Microstate Badge */}
            {currentState.microstate && (
                <div className={styles.microstateBadge}>
                    {currentState.microstate === 'brief_access' ? '⚡ Brief Access' : '◌ Microstate'}
                </div>
            )}

            {/* Transition Status */}
            <div className={`${styles.transitionBadge} ${styles[transitionStatus]}`}>
                {transitionLabel}
            </div>
        </div>
    );
}

// Stability indicator component
interface StabilityIndicatorProps {
    label: string;
    value: number;
    isGood: boolean;
    format: (v: number) => string;
}

function StabilityIndicator({ label, value, isGood, format }: StabilityIndicatorProps) {
    return (
        <div className={styles.stabilityItem}>
            <span className={styles.stabilityLabel}>{label}</span>
            <span
                className={styles.stabilityValue}
                style={{ color: isGood ? '#22c55e' : '#ef4444' }}
            >
                {format(value)}
            </span>
        </div>
    );
}

// Compact tier badge for state cards
interface TierBadgeProps {
    tier: ValidationTier;
    durationFormatted: string;
    progressToNextTier: number;
}

export function TierBadge({ tier, durationFormatted, progressToNextTier }: TierBadgeProps) {
    return (
        <div
            className={styles.tierBadgeCompact}
            style={{ borderColor: TIER_COLORS[tier] }}
        >
            <span
                className={styles.tierBadgeIcon}
                style={{ color: TIER_COLORS[tier] }}
            >
                {TIER_ICONS[tier]}
            </span>
            <span className={styles.tierBadgeText}>{tier}</span>
            <span className={styles.tierBadgeDuration}>{durationFormatted}</span>
            {tier !== 'locked' && (
                <div className={styles.tierBadgeProgress}>
                    <div
                        className={styles.tierBadgeProgressFill}
                        style={{
                            width: `${progressToNextTier}%`,
                            backgroundColor: TIER_COLORS[tier]
                        }}
                    />
                </div>
            )}
        </div>
    );
}
