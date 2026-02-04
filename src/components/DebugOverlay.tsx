/**
 * Debug Overlay Component
 * 
 * Shows state machine debug info.
 * Toggle with 'D' key.
 */

'use client';

import React from 'react';
import styles from './DebugOverlay.module.css';

interface DebugInfo {
    lastStateChange: number;
    transitionCount: number;
    confidence: number;
    tier: string;
    hysteresisCooldown: boolean;
    rawScores: Record<string, number>;
}

interface DebugOverlayProps {
    debug: DebugInfo;
    visible: boolean;
}

export function DebugOverlay({ debug, visible }: DebugOverlayProps) {
    if (!visible) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <span className={styles.title}>🔧 State Machine Debug</span>
            </div>

            <section className={styles.section}>
                <div className={styles.row}>
                    <span className={styles.label}>Tier:</span>
                    <span className={styles.value}>{debug.tier}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Confidence:</span>
                    <span className={styles.value}>{debug.confidence.toFixed(1)}%</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Transitions:</span>
                    <span className={styles.value}>{debug.transitionCount}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Hysteresis:</span>
                    <span className={`${styles.value} ${debug.hysteresisCooldown ? styles.active : ''}`}>
                        {debug.hysteresisCooldown ? 'COOLDOWN' : 'ready'}
                    </span>
                </div>
            </section>

            <section className={styles.section}>
                <h4>Raw Scores</h4>
                {Object.entries(debug.rawScores || {}).slice(0, 5).map(([state, score]) => (
                    <div key={state} className={styles.row}>
                        <span className={styles.label}>{state}:</span>
                        <span className={styles.value}>{typeof score === 'number' ? score.toFixed(2) : score}</span>
                    </div>
                ))}
            </section>
        </div>
    );
}

export default DebugOverlay;
