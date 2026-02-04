/**
 * State Tooltip Component
 * 
 * Hover tooltip/popover for state cards showing detailed info.
 * Uses CSS-only approach to avoid extra dependencies and prevent layout shifts.
 */

"use client";

import { ReactNode } from 'react';
import { StateInfo } from '@/data/stateInfo';
import styles from './StateTooltip.module.css';

interface StateTooltipProps {
    children: ReactNode;
    stateInfo: StateInfo;
    confidence: number;
    lockedSince?: number;
    status?: 'locked' | 'candidate' | 'challenger';
}

export function StateTooltip({
    children,
    stateInfo,
    confidence,
    lockedSince,
    status = 'candidate'
}: StateTooltipProps) {
    const timeLocked = lockedSince
        ? Math.round((Date.now() - lockedSince) / 1000)
        : 0;

    return (
        <div className={styles.tooltipWrapper}>
            {children}
            <div className={styles.tooltip}>
                <div className={styles.tooltipContent}>
                    {/* Header */}
                    <div className={styles.header}>
                        <span
                            className={styles.headerName}
                            style={{ color: stateInfo.color }}
                        >
                            {stateInfo.name}
                        </span>
                        <span className={`${styles.statusBadge} ${styles[status]}`}>
                            {status}
                        </span>
                    </div>

                    {/* Aliases */}
                    <div className={styles.aliases}>
                        {stateInfo.aliases.slice(0, 3).map((alias, i) => (
                            <span key={i} className={styles.alias}>{alias}</span>
                        ))}
                    </div>

                    {/* Dominant Bands */}
                    <div className={styles.bands}>
                        <span className={styles.label}>Dominant:</span>
                        {stateInfo.dominantBands.map(band => (
                            <span key={band} className={styles.bandTag}>{band}</span>
                        ))}
                    </div>

                    {/* Description */}
                    <p className={styles.description}>{stateInfo.description}</p>

                    {/* Metrics */}
                    <div className={styles.metrics}>
                        <div className={styles.metric}>
                            <span className={styles.metricValue}>{confidence}%</span>
                            <span className={styles.metricLabel}>confidence</span>
                        </div>
                        {lockedSince && (
                            <div className={styles.metric}>
                                <span className={styles.metricValue}>{timeLocked}s</span>
                                <span className={styles.metricLabel}>locked</span>
                            </div>
                        )}
                    </div>

                    {/* Gating Hint */}
                    <div className={styles.gatingHint}>
                        <span className={styles.label}>Pattern:</span>
                        <span>{stateInfo.gatingHint}</span>
                    </div>
                </div>

                {/* Arrow */}
                <div className={styles.arrow} />
            </div>
        </div>
    );
}
