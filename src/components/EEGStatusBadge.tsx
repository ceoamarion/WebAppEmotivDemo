/**
 * EEG Status Badge Component
 * 
 * Displays EEG connection status with correct field mapping:
 * - EEG Quality % (from dev stream last index, NOT battery)
 * - Battery % (from dev stream index 0)
 * - Signal Strength (from dev stream index 1)
 * 
 * Always mounted; shows stale/unavailable state when data missing.
 */

'use client';

import React from 'react';
import { useDeviceInfo, useConnectionState, useSensorQuality } from '@/stores/sessionStore';
import styles from './EEGStatusBadge.module.css';

export function EEGStatusBadge() {
    const connection = useConnectionState();
    const device = useDeviceInfo();
    const sensors = useSensorQuality();

    // EEG Quality color based on percentage
    const getQualityColor = (quality: number | null): string => {
        if (quality === null) return 'gray';
        if (quality >= 75) return 'green';
        if (quality >= 50) return 'yellow';
        if (quality >= 25) return 'orange';
        return 'red';
    };

    // Signal strength to bars
    const getSignalBars = (signal: number): string => {
        const bars = Math.min(5, Math.max(0, Math.round(signal)));
        return '▮'.repeat(bars) + '▯'.repeat(5 - bars);
    };

    // Connection state color
    const getConnectionColor = (): string => {
        switch (connection.state) {
            case 'connected': return 'green';
            case 'degraded': return 'yellow';
            case 'stale': return 'orange';
            case 'connecting': return 'blue';
            default: return 'gray';
        }
    };

    return (
        <div className={styles.container}>
            {/* Connection Status */}
            <div className={`${styles.badge} ${styles[getConnectionColor()]}`}>
                <span className={styles.dot} />
                <span className={styles.label}>{connection.label}</span>
            </div>

            {/* EEG Quality - from eegQuality field (NOT battery) */}
            <div
                className={`${styles.metric} ${styles[getQualityColor(sensors.quality)]}`}
                title="EEG Quality % - derived from electrode contact quality"
            >
                <span className={styles.metricIcon}>📊</span>
                <span className={styles.metricLabel}>EEG</span>
                <span className={styles.metricValue}>
                    {sensors.quality !== null ? `${sensors.quality}%` : '—'}
                </span>
            </div>

            {/* Battery - from battery field (index 0) */}
            <div
                className={`${styles.metric} ${device.battery > 20 ? styles.green : styles.red}`}
                title="Battery Level"
            >
                <span className={styles.metricIcon}>🔋</span>
                <span className={styles.metricLabel}>BAT</span>
                <span className={styles.metricValue}>{device.battery}%</span>
            </div>

            {/* Signal - from signal field (index 1) */}
            <div
                className={`${styles.metric} ${device.signal >= 3 ? styles.green : device.signal >= 1 ? styles.yellow : styles.red}`}
                title="Wireless Signal Strength"
            >
                <span className={styles.metricIcon}>📶</span>
                <span className={styles.metricLabel}>SIG</span>
                <span className={styles.metricValue}>{getSignalBars(device.signal)}</span>
            </div>

            {/* Sensor Quality Summary */}
            {sensors.bad > 0 && (
                <div className={`${styles.metric} ${styles.orange}`} title="Bad Sensors">
                    <span className={styles.metricIcon}>⚠️</span>
                    <span className={styles.metricValue}>{sensors.bad} bad</span>
                </div>
            )}
        </div>
    );
}

export default EEGStatusBadge;
