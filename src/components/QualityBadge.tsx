/**
 * QualityBadge Component - Refactored
 * 
 * Displays EEG quality with two separate metrics:
 * A) EEG Quality % - The primary mirrored value from Emotiv's stream
 * B) Bad Sensors count - Derived from per-sensor contact quality
 * 
 * These are NOT mixed or derived from each other.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    useHover,
    useFocus,
    useDismiss,
    useInteractions,
    FloatingPortal,
} from '@floating-ui/react';
import { EEGQualityPayload, SensorQualityInfo } from '@/hooks/useEEGQuality';
import styles from './QualityBadge.module.css';

interface QualityBadgeProps {
    quality: EEGQualityPayload;
    compact?: boolean;
}

export function QualityBadge({ quality, compact = false }: QualityBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-end',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });

    const hover = useHover(context, { delay: { open: 100, close: 150 } });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss]);

    // Primary display: EEG Quality Percent (the mirrored Emotiv value)
    const { primaryText, statusColor, iconEmoji } = useMemo(() => {
        if (!quality.connected) {
            return {
                primaryText: 'Disconnected',
                statusColor: 'gray' as const,
                iconEmoji: '🔌',
            };
        }

        if (!quality.available) {
            return {
                primaryText: 'Unavailable',
                statusColor: 'gray' as const,
                iconEmoji: '❓',
            };
        }

        // Use smoothed EEG Quality Percent as primary metric
        const pct = quality.eegQualityPercentSmoothed;
        if (pct === null) {
            return {
                primaryText: 'Quality: ?',
                statusColor: 'gray' as const,
                iconEmoji: '📡',
            };
        }

        // Color based on Emotiv's EEG Quality percentage
        let color: 'green' | 'yellow' | 'orange' | 'red' = 'green';
        let icon = '✅';

        if (pct < 25) {
            color = 'red';
            icon = '🔴';
        } else if (pct < 50) {
            color = 'orange';
            icon = '🟠';
        } else if (pct < 75) {
            color = 'yellow';
            icon = '🟡';
        }

        return {
            primaryText: `${pct}%`,
            statusColor: color,
            iconEmoji: icon,
        };
    }, [quality]);

    return (
        <>
            {/* Badge */}
            <div
                ref={refs.setReference}
                className={`${styles.badge} ${styles[statusColor]} ${compact ? styles.compact : ''}`}
                tabIndex={0}
                {...getReferenceProps()}
            >
                <span className={styles.icon}>{iconEmoji}</span>
                {!compact && (
                    <>
                        <span className={styles.label}>EEG</span>
                        <span className={styles.value}>{primaryText}</span>
                    </>
                )}
            </div>

            {/* Popover */}
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        className={styles.popover}
                        {...getFloatingProps()}
                    >
                        <QualityPopoverContent quality={quality} />
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

// ================================
// POPOVER CONTENT
// ================================

function QualityPopoverContent({ quality }: { quality: EEGQualityPayload }) {
    return (
        <div className={styles.popoverContent}>
            {/* Header */}
            <div className={styles.header}>
                <span className={styles.title}>EEG Quality</span>
                <ConnectionStatus connected={quality.connected} />
            </div>

            {/* Not connected message */}
            {!quality.connected && (
                <div className={styles.unavailableMessage}>
                    No headset connected.
                </div>
            )}

            {/* Connected but no data */}
            {quality.connected && !quality.available && (
                <div className={styles.unavailableMessage}>
                    Quality data not available.
                    <br />
                    <code>dev</code> stream may not be subscribed.
                </div>
            )}

            {/* Quality data available */}
            {quality.connected && quality.available && (
                <>
                    {/* A) EEG Quality Percent - PRIMARY METRIC */}
                    <div className={styles.metricSection}>
                        <div className={styles.metricHeader}>
                            EEG Quality
                            <span
                                className={styles.metricTooltip}
                                title="Derived from electrode contact quality; may differ from cognitive metrics shown in Emotiv Launcher."
                            >
                                ⓘ
                            </span>
                        </div>
                        {quality.eegQualityPercent !== null ? (
                            <div className={styles.primaryMetric}>
                                <span className={styles.primaryValue}>
                                    {quality.eegQualityPercentSmoothed ?? quality.eegQualityPercent}%
                                </span>
                                <span className={styles.primaryNote}>
                                    (raw: {quality.eegQualityPercent}%)
                                </span>
                            </div>
                        ) : (
                            <div className={styles.unavailableMetric}>
                                Not provided by stream
                            </div>
                        )}
                    </div>

                    {/* B) Sensor Contact Quality - SECONDARY METRIC */}
                    <div className={styles.metricSection}>
                        <div className={styles.metricHeader}>Contact Quality</div>

                        {/* Total Sensors */}
                        <div className={styles.row}>
                            <span className={styles.rowLabel}>Total Sensors</span>
                            <span className={styles.rowValue}>{quality.totalSensors}</span>
                        </div>

                        {/* Bad/Good Sensors - only show if we have per-sensor data */}
                        {quality.badSensorsCount !== null && quality.goodSensorsCount !== null ? (
                            <>
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Bad Sensors</span>
                                    <span className={`${styles.rowValue} ${quality.badSensorsCount > 0 ? styles.bad : styles.good}`}>
                                        {quality.badSensorsCount}
                                    </span>
                                </div>
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Good Sensors</span>
                                    <span className={`${styles.rowValue} ${styles.good}`}>
                                        {quality.goodSensorsCount}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className={styles.unavailableMetric}>
                                Per-sensor data unavailable
                            </div>
                        )}
                    </div>

                    {/* Device Info */}
                    <div className={styles.metricSection}>
                        <div className={styles.metricHeader}>Device</div>
                        <div className={styles.row}>
                            <span className={styles.rowLabel}>Battery</span>
                            <span className={styles.rowValue}>🔋 {quality.battery}%</span>
                        </div>
                        <div className={styles.row}>
                            <span className={styles.rowLabel}>Signal</span>
                            <span className={styles.rowValue}>{getSignalBars(quality.wirelessSignal)}</span>
                        </div>
                    </div>

                    {/* Per-Sensor Grid - only show if we have data */}
                    {quality.perSensor && Object.keys(quality.perSensor).length > 0 && (
                        <div className={styles.sensorsSection}>
                            <div className={styles.sensorsSectionTitle}>Per-Sensor Quality</div>
                            <div className={styles.sensorsGrid}>
                                {Object.values(quality.perSensor).map((sensor) => (
                                    <SensorDot key={sensor.name} sensor={sensor} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ================================
// HELPER COMPONENTS
// ================================

function ConnectionStatus({ connected }: { connected: boolean }) {
    return (
        <span className={`${styles.statusChip} ${connected ? styles.green : styles.gray}`}>
            {connected ? 'Connected' : 'Disconnected'}
        </span>
    );
}

function SensorDot({ sensor }: { sensor: SensorQualityInfo }) {
    const colorClass = useMemo(() => {
        switch (sensor.level) {
            case 'good': return styles.sensorGood;
            case 'ok': return styles.sensorOk;
            case 'bad': return styles.sensorBad;
            default: return styles.sensorVeryBad;
        }
    }, [sensor.level]);

    return (
        <div
            className={`${styles.sensorDot} ${colorClass}`}
            title={`${sensor.name}: ${sensor.level} (${sensor.rawValue})`}
        >
            <span className={styles.sensorName}>{sensor.name}</span>
        </div>
    );
}

// ================================
// HELPERS
// ================================

function getSignalBars(signal: number): string {
    const bars = Math.min(4, Math.max(0, Math.round(signal)));
    const filled = '▮'.repeat(bars);
    const empty = '▯'.repeat(4 - bars);
    return filled + empty;
}

export default QualityBadge;
