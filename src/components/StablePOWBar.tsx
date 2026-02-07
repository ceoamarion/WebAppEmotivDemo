/**
 * Stable POW Bar Component
 * 
 * ALWAYS mounted - never conditionally rendered/unmounted.
 * Shows band power levels (Theta, Alpha, Beta-L, Beta-H, Gamma).
 * When data missing or stale, shows last-known values with stale indicator.
 */

'use client';

import React from 'react';
import { useBandPower, useConnectionState } from '@/stores/sessionStore';
import styles from './StablePOWBar.module.css';

const BAND_CONFIG = [
    { key: 'theta', label: 'Theta', color: '#8b5cf6', description: '4-8 Hz: Drowsy, meditative' },
    { key: 'alpha', label: 'Alpha', color: '#22c55e', description: '8-12 Hz: Relaxed, calm' },
    { key: 'betaL', label: 'Beta-L', color: '#3b82f6', description: '12-16 Hz: Alert, focused' },
    { key: 'betaH', label: 'Beta-H', color: '#f59e0b', description: '16-25 Hz: Active thinking' },
    { key: 'gamma', label: 'Gamma', color: '#ef4444', description: '25-45 Hz: High cognition' },
] as const;

export function StablePOWBar() {
    const { power, stale, dominant } = useBandPower();
    const connection = useConnectionState();

    const isDisconnected = connection.state === 'disconnected';

    return (
        <div className={`${styles.container} ${stale ? styles.stale : ''} ${isDisconnected ? styles.disconnected : ''}`}>
            {/* Connection Indicator */}
            <div className={`${styles.connectionIndicator} ${styles[connection.state]}`}>
                <span className={styles.connectionDot} />
                <span className={styles.connectionLabel}>{connection.label}</span>
            </div>

            {/* POW Label */}
            <span className={styles.powLabel} title="Band Power (relative, smoothed)">
                BAND PWR
            </span>

            {/* Band Power Bars */}
            {BAND_CONFIG.map(band => {
                const value = power[band.key as keyof typeof power];
                const isDominant = dominant === band.key;

                return (
                    <div
                        key={band.key}
                        className={`${styles.bandItem} ${isDominant ? styles.dominant : ''}`}
                        title={band.description}
                    >
                        <div className={styles.bandMeter}>
                            <div
                                className={styles.bandFill}
                                style={{
                                    width: `${Math.min(100, value * 100)}%`,
                                    backgroundColor: band.color,
                                    opacity: stale ? 0.5 : 1,
                                }}
                            />
                        </div>
                        <span className={styles.bandLabel}>{band.label}</span>
                        <span
                            className={styles.bandValue}
                            style={{ color: stale ? '#666' : band.color }}
                        >
                            {stale && value === 0 ? '—' : (value * 100).toFixed(0)}
                        </span>
                    </div>
                );
            })}

            {/* Stale Indicator */}
            {stale && !isDisconnected && (
                <span className={styles.staleIndicator} title="Data is stale - holding last values">
                    ⏳
                </span>
            )}

            {/* Disconnected Message */}
            {isDisconnected && (
                <span className={styles.disconnectedMessage}>
                    No data stream
                </span>
            )}
        </div>
    );
}

export default StablePOWBar;
