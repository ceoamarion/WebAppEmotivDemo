/**
 * Debug Overlay Component
 * 
 * Shows state machine debug info.
 * Toggle with 'D' key.
 */

'use client';

import React from 'react';
import styles from './DebugOverlay.module.css';

// Import the actual DebugInfo type from useStateMachine
import type { DebugInfo } from '@/hooks/useStateMachine';

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
                    <span className={styles.label}>Current:</span>
                    <span className={styles.value}>{debug.currentStateId}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Challenger:</span>
                    <span className={styles.value}>{debug.challengerStateId ?? 'none'}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Confidence:</span>
                    <span className={styles.value}>{debug.currentConfidence.toFixed(1)}%</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Time in State:</span>
                    <span className={styles.value}>{(debug.timeInStateMs / 1000).toFixed(1)}s</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Status:</span>
                    <span className={styles.value}>{debug.status}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Block Reason:</span>
                    <span className={styles.value}>{debug.blockReason ? String(debug.blockReason) : 'none'}</span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Emergency:</span>
                    <span className={`${styles.value} ${debug.emergencyActive ? styles.active : ''}`}>
                        {debug.emergencyActive ? 'ACTIVE' : 'off'}
                    </span>
                </div>
            </section>

            <section className={styles.section}>
                <h4>Top 3 (smoothed)</h4>
                {debug.smoothedTop3.slice(0, 3).map((item, i) => (
                    <div key={item.id} className={styles.row}>
                        <span className={styles.label}>{i + 1}. {item.id}:</span>
                        <span className={styles.value}>{item.confidence.toFixed(1)}</span>
                    </div>
                ))}
            </section>
        </div>
    );
}

export default DebugOverlay;
