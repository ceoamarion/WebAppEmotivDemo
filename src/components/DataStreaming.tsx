"use client";

import { useState } from 'react';
import { useCortex } from '@/context/CortexContext';
import { StreamType } from '@/services/cortex';
import styles from './DataStreaming.module.css';

const AVAILABLE_STREAMS: { type: StreamType; label: string; description: string }[] = [
    { type: 'eeg', label: 'EEG', description: 'Raw brainwave data' },
    { type: 'pow', label: 'Power', description: 'Band power values' },
    { type: 'fac', label: 'Facial', description: 'Facial expressions' },
    { type: 'met', label: 'Metrics', description: 'Performance metrics' },
    { type: 'com', label: 'Commands', description: 'Mental commands' },
    { type: 'mot', label: 'Motion', description: 'Motion sensors' },
];

export default function DataStreaming() {
    const { sessionActive, streamData, startStreaming, stopStreaming } = useCortex();
    const [activeStreams, setActiveStreams] = useState<StreamType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const toggleStream = async (streamType: StreamType) => {
        setIsLoading(true);
        try {
            if (activeStreams.includes(streamType)) {
                await stopStreaming([streamType]);
                setActiveStreams(prev => prev.filter(s => s !== streamType));
            } else {
                await startStreaming([streamType]);
                setActiveStreams(prev => [...prev, streamType]);
            }
        } catch (e) {
            console.error('Stream toggle error:', e);
        }
        setIsLoading(false);
    };

    if (!sessionActive) {
        return (
            <div className={styles.container}>
                <h2 className={styles.title}>Data Streams</h2>
                <p className={styles.placeholder}>Connect to a headset to start streaming data</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Data Streams</h2>

            <div className={styles.streamGrid}>
                {AVAILABLE_STREAMS.map((stream) => (
                    <button
                        key={stream.type}
                        onClick={() => toggleStream(stream.type)}
                        disabled={isLoading}
                        className={`${styles.streamButton} ${activeStreams.includes(stream.type) ? styles.active : ''}`}
                    >
                        <span className={styles.streamLabel}>{stream.label}</span>
                        <span className={styles.streamDesc}>{stream.description}</span>
                        {activeStreams.includes(stream.type) && (
                            <span className={styles.liveIndicator}>LIVE</span>
                        )}
                    </button>
                ))}
            </div>

            {streamData && (
                <div className={styles.dataDisplay}>
                    <h3 className={styles.dataTitle}>
                        Live Data: <span className={styles.streamType}>{streamData.stream.toUpperCase()}</span>
                    </h3>
                    <pre className={styles.dataContent}>
                        {JSON.stringify(streamData.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
