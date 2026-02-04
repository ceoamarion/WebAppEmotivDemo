"use client";

import { useCortex } from '@/context/CortexContext';
import styles from './HeadsetStatus.module.css';

export default function HeadsetStatus() {
    const { selectedHeadset, sessionActive, service } = useCortex();

    if (!sessionActive || !selectedHeadset) {
        return (
            <div className={styles.container}>
                <h3 className={styles.title}>Device Status</h3>
                <p style={{ color: '#9ca3af', textAlign: 'center' }}>No headset connected</p>
            </div>
        );
    }

    // Epoc X has 14 EEG sensors
    const sensors = ['AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 'O2', 'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4'];

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Emotiv Epoc X</h3>

            <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Headset ID</span>
                    <span className={styles.infoValue}>{selectedHeadset.id}</span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Status</span>
                    <span className={styles.infoValue} style={{ color: '#22c55e' }}>
                        {selectedHeadset.status}
                    </span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Session</span>
                    <span className={styles.infoValue} style={{ color: '#60a5fa' }}>
                        {service.sessionId ? service.sessionId.substring(0, 12) + '...' : 'N/A'}
                    </span>
                </div>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Firmware</span>
                    <span className={styles.infoValue}>
                        {selectedHeadset.firmware || 'Unknown'}
                    </span>
                </div>
            </div>

            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', color: '#d1d5db', fontSize: '0.9rem' }}>
                EEG Sensors (14 Channels)
            </h4>
            <div className={styles.sensors}>
                {sensors.map((sensor) => (
                    <div key={sensor} className={styles.sensorNode}>
                        <span>{sensor}</span>
                        <div className={`${styles.sensorValue} ${styles.good}`}></div>
                    </div>
                ))}
            </div>

            <p className={styles.sensorNote}>
                Sensor quality updates with real EEG data stream
            </p>
        </div>
    );
}
