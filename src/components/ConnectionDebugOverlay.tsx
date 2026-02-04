/**
 * Debug Overlay Component
 * 
 * Shows real-time diagnostic information for debugging:
 * - Connection state
 * - Packet rate and age
 * - Data staleness
 * - Quality source
 * - Raw values
 */

'use client';

import React, { useState } from 'react';
import { ConnectionStateInfo } from '@/hooks/useConnectionState';
import { StableDataStore } from '@/hooks/useStableDataStore';
import styles from './ConnectionDebugOverlay.module.css';

interface DebugOverlayProps {
    connection: ConnectionStateInfo;
    dataStore: StableDataStore;
    eegQualityRaw?: {
        eegQualityPercent: number | null;
        badSensorsCount: number | null;
        goodSensorsCount: number | null;
        perSensor: Record<string, unknown> | null;
    } | null;
    isVisible: boolean;
    onToggle: () => void;
}

export function ConnectionDebugOverlay({
    connection,
    dataStore,
    eegQualityRaw,
    isVisible,
    onToggle,
}: DebugOverlayProps) {
    if (!isVisible) {
        return (
            <button className={styles.toggleButton} onClick={onToggle} title="Show Debug Info">
                🐛
            </button>
        );
    }

    const now = Date.now();

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <span className={styles.title}>🐛 Debug Info</span>
                <button className={styles.closeButton} onClick={onToggle}>×</button>
            </div>

            {/* Connection State */}
            <section className={styles.section}>
                <h4>Connection</h4>
                <div className={styles.row}>
                    <span className={styles.label}>State:</span>
                    <span className={`${styles.value} ${styles[connection.state]}`}>
                        {connection.state}
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Last Packet:</span>
                    <span className={styles.value}>
                        {connection.lastPacketAt
                            ? `${connection.lastPacketAgeMs}ms ago`
                            : 'never'
                        }
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Packet Rate:</span>
                    <span className={styles.value}>
                        {connection.packetRate.toFixed(1)} pkt/s
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Receiving:</span>
                    <span className={`${styles.value} ${connection.isReceivingData ? styles.good : styles.bad}`}>
                        {connection.isReceivingData ? 'Yes' : 'No'}
                    </span>
                </div>
            </section>

            {/* Data Staleness */}
            <section className={styles.section}>
                <h4>Data Status</h4>
                <div className={styles.row}>
                    <span className={styles.label}>Band Power:</span>
                    <span className={`${styles.value} ${dataStore.bandPower.isStale ? styles.stale : styles.fresh}`}>
                        {dataStore.bandPower.isStale ? 'STALE' : 'Fresh'}
                        {' '}({now - dataStore.bandPower.lastUpdatedAt}ms)
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Metrics:</span>
                    <span className={`${styles.value} ${dataStore.metrics.isStale ? styles.stale : styles.fresh}`}>
                        {dataStore.metrics.isStale ? 'STALE' : 'Fresh'}
                        {' '}({now - dataStore.metrics.lastUpdatedAt}ms)
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Quality:</span>
                    <span className={`${styles.value} ${dataStore.quality.isStale ? styles.stale : styles.fresh}`}>
                        {dataStore.quality.isStale ? 'STALE' : 'Fresh'}
                        {' '}({now - dataStore.quality.lastUpdatedAt}ms)
                    </span>
                </div>
            </section>

            {/* EEG Quality */}
            <section className={styles.section}>
                <h4>EEG Quality Source</h4>
                <div className={styles.row}>
                    <span className={styles.label}>Source:</span>
                    <span className={`${styles.value} ${dataStore.quality.source === 'stream' ? styles.good : styles.bad}`}>
                        {dataStore.quality.source}
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>EEG %:</span>
                    <span className={styles.value}>
                        {dataStore.quality.eegQualityPercent ?? 'null'}
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Bad Sensors:</span>
                    <span className={styles.value}>
                        {dataStore.quality.badSensorsCount ?? 'null'}
                    </span>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Good Sensors:</span>
                    <span className={styles.value}>
                        {dataStore.quality.goodSensorsCount ?? 'null'}
                    </span>
                </div>
            </section>

            {/* Raw Quality Data */}
            {eegQualityRaw && (
                <section className={styles.section}>
                    <h4>Raw Quality Data</h4>
                    <div className={styles.row}>
                        <span className={styles.label}>eegQualityPercent:</span>
                        <span className={styles.value}>
                            {eegQualityRaw.eegQualityPercent ?? 'null'}
                        </span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>badSensorsCount:</span>
                        <span className={styles.value}>
                            {eegQualityRaw.badSensorsCount ?? 'null'}
                        </span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>perSensor:</span>
                        <span className={styles.value}>
                            {eegQualityRaw.perSensor ? 'present' : 'null'}
                        </span>
                    </div>
                </section>
            )}

            {/* Band Power */}
            <section className={styles.section}>
                <h4>Band Power (Smoothed)</h4>
                <div className={styles.bands}>
                    <div className={styles.bandItem}>
                        <span>θ</span>
                        <span>{dataStore.bandPower.theta.toFixed(2)}</span>
                    </div>
                    <div className={styles.bandItem}>
                        <span>α</span>
                        <span>{dataStore.bandPower.alpha.toFixed(2)}</span>
                    </div>
                    <div className={styles.bandItem}>
                        <span>βL</span>
                        <span>{dataStore.bandPower.betaL.toFixed(2)}</span>
                    </div>
                    <div className={styles.bandItem}>
                        <span>βH</span>
                        <span>{dataStore.bandPower.betaH.toFixed(2)}</span>
                    </div>
                    <div className={styles.bandItem}>
                        <span>γ</span>
                        <span>{dataStore.bandPower.gamma.toFixed(2)}</span>
                    </div>
                </div>
                <div className={styles.row}>
                    <span className={styles.label}>Dominant:</span>
                    <span className={styles.value}>
                        {dataStore.bandPower.dominantBandStable}
                    </span>
                </div>
            </section>
        </div>
    );
}

export default ConnectionDebugOverlay;
