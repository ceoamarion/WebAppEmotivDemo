"use client";

import HeadsetConnection from './HeadsetConnection';
import HeadsetStatus from './HeadsetStatus';
import DataStreaming from './DataStreaming';
import styles from './Dashboard.module.css';

export default function Dashboard() {
    return (
        <div className={styles.dashboard}>
            <header className={styles.header}>
                <h1 className={styles.title}>Emotiv Cortex Demo</h1>
                <p className={styles.subtitle}>Connect your Epoc X and visualize brainwave data</p>
            </header>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <HeadsetConnection />
                </div>
                <div className={styles.card}>
                    <HeadsetStatus />
                </div>
            </div>

            <div className={styles.streamingSection}>
                <DataStreaming />
            </div>
        </div>
    );
}
