"use client";

import { useCortex } from '@/context/CortexContext';
import styles from './DataBar.module.css';

interface DisplayData {
    type: string;
    values?: Record<string, number | string>;
    raw?: boolean;
    sample?: number[];
}

export default function DataBar() {
    const { streamData, sessionActive, selectedHeadset } = useCortex();

    // Extract and format data based on stream type
    const getDisplayData = (): DisplayData | null => {
        if (!streamData?.data) return null;

        // POW stream - Band Power (Alpha, Beta, Theta, etc.)
        if (streamData.data.pow) {
            const pow = streamData.data.pow;
            let bands: number[];

            if (Array.isArray(pow[0])) {
                bands = pow.map((arr: number[]) => average(arr));
            } else {
                const numBands = 5;
                const valuesPerBand = Math.floor(pow.length / numBands);
                bands = [
                    average(pow.slice(0, valuesPerBand)),
                    average(pow.slice(valuesPerBand, valuesPerBand * 2)),
                    average(pow.slice(valuesPerBand * 2, valuesPerBand * 3)),
                    average(pow.slice(valuesPerBand * 3, valuesPerBand * 4)),
                    average(pow.slice(valuesPerBand * 4)),
                ];
            }

            return {
                type: 'brainwaves',
                values: {
                    Theta: bands[0] || 0,
                    Alpha: bands[1] || 0,
                    'β-L': bands[2] || 0,
                    'β-H': bands[3] || 0,
                    Gamma: bands[4] || 0,
                }
            };
        }

        // MET stream - Performance Metrics
        if (streamData.data.met) {
            const met = streamData.data.met;
            return {
                type: 'metrics',
                values: {
                    Engage: met[0] || 0,
                    Excite: met[1] || 0,
                    Stress: met[3] || 0,
                    Relax: met[4] || 0,
                    Focus: met[6] || 0,
                }
            };
        }

        // FAC stream - Facial Expression
        if (streamData.data.fac) {
            return {
                type: 'facial',
                values: {
                    Eye: streamData.data.fac[0],
                    Upper: streamData.data.fac[1],
                    'U-Pwr': streamData.data.fac[2],
                    Lower: streamData.data.fac[3],
                    'L-Pwr': streamData.data.fac[4],
                }
            };
        }

        // COM stream - Mental Command
        if (streamData.data.com) {
            return {
                type: 'command',
                values: {
                    Action: streamData.data.com[0],
                    Power: streamData.data.com[1],
                }
            };
        }

        // EEG stream - Raw data
        if (streamData.data.eeg) {
            return {
                type: 'eeg',
                raw: true,
                sample: streamData.data.eeg.slice(0, 5)
            };
        }

        return null;
    };

    const displayData = getDisplayData();

    const getColor = (key: string, type: string): string => {
        if (type === 'brainwaves') {
            const colors: Record<string, string> = {
                'Theta': '#8b5cf6',
                'Alpha': '#22c55e',
                'β-L': '#3b82f6',
                'β-H': '#f59e0b',
                'Gamma': '#ef4444',
            };
            return colors[key] || '#60a5fa';
        }
        if (type === 'metrics') {
            const colors: Record<string, string> = {
                'Engage': '#a855f7',
                'Excite': '#f59e0b',
                'Stress': '#ef4444',
                'Relax': '#22c55e',
                'Focus': '#3b82f6',
            };
            return colors[key] || '#60a5fa';
        }
        return '#60a5fa';
    };

    return (
        <div className={styles.dataBar}>
            <div className={styles.connectionStatus}>
                <div className={`${styles.dot} ${sessionActive ? styles.active : ''}`}></div>
                <span>{sessionActive ? selectedHeadset?.id || 'Connected' : 'No Headset'}</span>
            </div>

            <div className={styles.dataStream}>
                {!sessionActive && (
                    <span className={styles.placeholder}>Connect headset to see live neural data</span>
                )}

                {sessionActive && !streamData && (
                    <span className={styles.placeholder}>Select a stream to begin analysis</span>
                )}

                {streamData && displayData && (
                    <>
                        <span className={styles.streamType}>{streamData.stream.toUpperCase()}</span>

                        {displayData.raw ? (
                            <span className={styles.rawData}>
                                [{displayData.sample?.map((v: number) => v.toFixed(1)).join(', ')}...]
                            </span>
                        ) : displayData.values ? (
                            <div className={styles.dataValues}>
                                {Object.entries(displayData.values).map(([key, value]) => (
                                    <div key={key} className={styles.metric}>
                                        <div className={styles.metricBar}>
                                            <div
                                                className={styles.metricFill}
                                                style={{
                                                    width: `${Math.min(100, (typeof value === 'number' ? value : 0) * 100)}%`,
                                                    backgroundColor: getColor(key, displayData.type)
                                                }}
                                            ></div>
                                        </div>
                                        <span className={styles.metricLabel}>{key}</span>
                                        <span
                                            className={styles.metricValue}
                                            style={{ color: getColor(key, displayData.type) }}
                                        >
                                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

function average(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
