/**
 * SessionSummaryModal
 * 
 * Shown when user ends a session.
 * Displays summary and allows save/discard.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SessionRecord, saveSession } from '@/data/sessionStorage';
import { saveSessionToSupabase } from '@/services/supabaseSessions';
import styles from './SessionSummaryModal.module.css';

interface SessionSummaryModalProps {
    record: SessionRecord;
    onSave: () => void;
    onDiscard: () => void;
    onViewRecords: () => void;
}

export function SessionSummaryModal({
    record,
    onSave,
    onDiscard,
    onViewRecords,
}: SessionSummaryModalProps) {
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Calculate summary stats
    const summary = useMemo(() => {
        // Most frequent state
        const stateEntries = Object.entries(record.timeByState);
        stateEntries.sort((a, b) => b[1] - a[1]);
        const mostFrequentState = stateEntries[0] || ['unknown', 0];

        // Format duration
        const formatTime = (sec: number) => {
            const mins = Math.floor(sec / 60);
            const secs = Math.round(sec % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Peak calm moment
        const calmEmotions = record.emotionTimeline.filter(e =>
            e.topEmotions.some(em => em.label === 'calm/peace' && em.confidence > 50)
        );
        const peakCalm = calmEmotions.length > 0
            ? Math.max(...calmEmotions.flatMap(e => e.topEmotions.filter(em => em.label === 'calm/peace').map(em => em.confidence)))
            : 0;

        return {
            duration: formatTime(record.durationSec),
            durationSec: record.durationSec,
            mostFrequentState: formatStateName(mostFrequentState[0]),
            mostFrequentStateTime: formatTime(mostFrequentState[1]),
            bestState: formatStateName(record.bestState.stateId),
            bestStateDuration: formatTime(record.bestState.sustainedSec),
            bestStateConf: record.bestState.maxConfidence,
            avgValence: record.emotionAverages.valence,
            avgArousal: record.emotionAverages.arousal,
            avgControl: record.emotionAverages.control,
            topEmotion: record.mostCommonEmotions[0]?.label || 'neutral',
            peakCalm,
            artifactPct: record.artifactPct,
            stabilityPct: record.stabilityPct,
        };
    }, [record]);

    const handleSave = () => {
        setSaving(true);
        const recordWithNotes = notes ? { ...record, notes } : record;

        // 1. Save to localStorage immediately (sync)
        saveSession(recordWithNotes);

        // 2. Save to Supabase non-blocking
        setCloudStatus('saving');
        saveSessionToSupabase(recordWithNotes, (status) => {
            setCloudStatus(status);
        }).catch(() => setCloudStatus('error'));

        setSaving(false);
        onSave();
    };

    return createPortal(
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onDiscard()}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>Session Complete</h2>
                    <span className={styles.duration}>{summary.duration}</span>
                </div>

                {/* Mind States Summary */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>🧠 Mind States</h3>
                    <div className={styles.grid}>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Most Frequent</span>
                            <span className={styles.statValue}>{summary.mostFrequentState}</span>
                            <span className={styles.statSub}>{summary.mostFrequentStateTime}</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Best State Achieved</span>
                            <span className={styles.statValue}>{summary.bestState}</span>
                            <span className={styles.statSub}>
                                {summary.bestStateDuration} at {summary.bestStateConf}% conf
                            </span>
                        </div>
                    </div>
                </section>

                {/* Emotional Summary */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>💭 Emotional Summary</h3>
                    <div className={styles.axesGrid}>
                        <div className={styles.axisItem}>
                            <span className={styles.axisLabel}>Valence</span>
                            <span
                                className={styles.axisValue}
                                style={{ color: summary.avgValence > 0 ? '#22c55e' : summary.avgValence < 0 ? '#ef4444' : '#64748b' }}
                            >
                                {summary.avgValence > 0 ? '+' : ''}{(summary.avgValence * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className={styles.axisItem}>
                            <span className={styles.axisLabel}>Arousal</span>
                            <span className={styles.axisValue}>
                                {(summary.avgArousal * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className={styles.axisItem}>
                            <span className={styles.axisLabel}>Control</span>
                            <span className={styles.axisValue}>
                                {(summary.avgControl * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                    <div className={styles.emotionNote}>
                        Top emotion: <strong>{summary.topEmotion}</strong>
                        {summary.peakCalm > 0 && (
                            <> • Peak calm: <strong>{summary.peakCalm}%</strong></>
                        )}
                    </div>
                </section>

                {/* Signal Quality */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>📊 Signal Quality</h3>
                    <div className={styles.qualityGrid}>
                        <div className={styles.qualityItem}>
                            <span className={styles.qualityLabel}>Artifact Time</span>
                            <span
                                className={styles.qualityValue}
                                style={{ color: summary.artifactPct < 10 ? '#22c55e' : summary.artifactPct < 30 ? '#f59e0b' : '#ef4444' }}
                            >
                                {summary.artifactPct}%
                            </span>
                        </div>
                        <div className={styles.qualityItem}>
                            <span className={styles.qualityLabel}>Stability</span>
                            <span
                                className={styles.qualityValue}
                                style={{ color: summary.stabilityPct > 60 ? '#22c55e' : summary.stabilityPct > 30 ? '#f59e0b' : '#ef4444' }}
                            >
                                {summary.stabilityPct}%
                            </span>
                        </div>
                    </div>
                </section>

                {/* Notes */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>📝 Notes (optional)</h3>
                    <textarea
                        className={styles.notesInput}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any notes about this session..."
                        rows={2}
                    />
                </section>

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        className={styles.discardButton}
                        onClick={onDiscard}
                    >
                        Discard
                    </button>
                    <button
                        className={styles.recordsButton}
                        onClick={() => {
                            handleSave();
                            onViewRecords();
                        }}
                    >
                        Save & View Records
                    </button>
                    <button
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Session'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function formatStateName(stateId: string): string {
    return stateId
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export default SessionSummaryModal;
