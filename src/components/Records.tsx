/**
 * Records Page
 * 
 * Three views:
 * A) Individual Sessions - list and detail view
 * B) Over-Time - trends across sessions
 * C) Overall Summary - aggregate stats
 */

'use client';

import React, { useState, useMemo } from 'react';
import { SessionRecord, loadAllSessions, deleteSession, exportSessionsJSON } from '@/data/sessionStorage';
import styles from './Records.module.css';

// ================================
// TYPES
// ================================

type ViewTab = 'sessions' | 'trends' | 'summary';

// ================================
// COMPONENT
// ================================

export function Records() {
    const [activeView, setActiveView] = useState<ViewTab>('sessions');
    const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
    const [sessions, setSessions] = useState<SessionRecord[]>(() => loadAllSessions());

    const refreshSessions = () => setSessions(loadAllSessions());

    const handleDelete = (id: string) => {
        if (confirm('Delete this session?')) {
            deleteSession(id);
            refreshSessions();
            if (selectedSession?.id === id) {
                setSelectedSession(null);
            }
        }
    };

    const handleExport = () => {
        const json = exportSessionsJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consciousness_explorer_records_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Records</h1>
                <div className={styles.headerActions}>
                    <span className={styles.sessionCount}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                    <button className={styles.exportButton} onClick={handleExport} disabled={sessions.length === 0}>
                        📥 Export JSON
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeView === 'sessions' ? styles.active : ''}`}
                    onClick={() => { setActiveView('sessions'); setSelectedSession(null); }}
                >
                    📋 Sessions
                </button>
                <button
                    className={`${styles.tab} ${activeView === 'trends' ? styles.active : ''}`}
                    onClick={() => { setActiveView('trends'); setSelectedSession(null); }}
                >
                    📈 Trends
                </button>
                <button
                    className={`${styles.tab} ${activeView === 'summary' ? styles.active : ''}`}
                    onClick={() => { setActiveView('summary'); setSelectedSession(null); }}
                >
                    📊 Summary
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {sessions.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>📭</span>
                        <span className={styles.emptyText}>No sessions recorded yet.</span>
                        <span className={styles.emptyHint}>Complete a session and save it to see records here.</span>
                    </div>
                ) : (
                    <>
                        {activeView === 'sessions' && (
                            <SessionsView
                                sessions={sessions}
                                selectedSession={selectedSession}
                                onSelect={setSelectedSession}
                                onDelete={handleDelete}
                            />
                        )}
                        {activeView === 'trends' && <TrendsView sessions={sessions} />}
                        {activeView === 'summary' && <SummaryView sessions={sessions} />}
                    </>
                )}
            </div>
        </div>
    );
}

// ================================
// SESSIONS VIEW
// ================================

function SessionsView({
    sessions,
    selectedSession,
    onSelect,
    onDelete,
}: {
    sessions: SessionRecord[];
    selectedSession: SessionRecord | null;
    onSelect: (s: SessionRecord | null) => void;
    onDelete: (id: string) => void;
}) {
    if (selectedSession) {
        return <SessionDetail session={selectedSession} onBack={() => onSelect(null)} onDelete={onDelete} />;
    }

    return (
        <div className={styles.sessionsList}>
            {sessions.map(session => (
                <div key={session.id} className={styles.sessionCard} onClick={() => onSelect(session)}>
                    <div className={styles.sessionHeader}>
                        <span className={styles.sessionDate}>
                            {new Date(session.startedAt).toLocaleDateString()} at {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={styles.sessionDuration}>{formatTime(session.durationSec)}</span>
                    </div>
                    <div className={styles.sessionStats}>
                        <span className={styles.sessionStat}>
                            Best: <strong>{formatStateName(session.bestState.stateId)}</strong>
                        </span>
                        <span className={styles.sessionStat}>
                            V: {(session.emotionAverages.valence * 100).toFixed(0)}% |
                            A: {(session.emotionAverages.arousal * 100).toFixed(0)}% |
                            C: {(session.emotionAverages.control * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function SessionDetail({
    session,
    onBack,
    onDelete,
}: {
    session: SessionRecord;
    onBack: () => void;
    onDelete: (id: string) => void;
}) {
    // Time by state breakdown
    const stateBreakdown = useMemo(() => {
        return Object.entries(session.timeByState)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [session]);

    return (
        <div className={styles.sessionDetail}>
            <button className={styles.backButton} onClick={onBack}>
                ← Back to Sessions
            </button>

            <div className={styles.detailHeader}>
                <div>
                    <h2 className={styles.detailDate}>
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </h2>
                    <span className={styles.detailTime}>
                        {new Date(session.startedAt).toLocaleTimeString()} - {new Date(session.endedAt).toLocaleTimeString()}
                    </span>
                </div>
                <span className={styles.detailDuration}>{formatTime(session.durationSec)}</span>
            </div>

            {/* Best State */}
            <section className={styles.detailSection}>
                <h3>🏆 Best State Achieved</h3>
                <div className={styles.bestStateBox}>
                    <span className={styles.bestStateName}>{formatStateName(session.bestState.stateId)}</span>
                    <span className={styles.bestStateDuration}>
                        Sustained for {formatTime(session.bestState.sustainedSec)} at {session.bestState.maxConfidence}% confidence
                    </span>
                </div>
            </section>

            {/* State Breakdown */}
            <section className={styles.detailSection}>
                <h3>🧠 Time by State</h3>
                <div className={styles.stateBreakdown}>
                    {stateBreakdown.map(([stateId, seconds]) => (
                        <div key={stateId} className={styles.stateBarRow}>
                            <span className={styles.stateBarLabel}>{formatStateName(stateId)}</span>
                            <div className={styles.stateBar}>
                                <div
                                    className={styles.stateBarFill}
                                    style={{ width: `${Math.min((seconds / session.durationSec) * 100, 100)}%` }}
                                />
                            </div>
                            <span className={styles.stateBarTime}>{formatTime(seconds)}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Emotion Averages */}
            <section className={styles.detailSection}>
                <h3>💭 Emotional Averages</h3>
                <div className={styles.emotionGrid}>
                    <div className={styles.emotionStat}>
                        <span className={styles.emotionLabel}>Valence</span>
                        <span className={styles.emotionValue}>
                            {session.emotionAverages.valence > 0 ? '+' : ''}{(session.emotionAverages.valence * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className={styles.emotionStat}>
                        <span className={styles.emotionLabel}>Arousal</span>
                        <span className={styles.emotionValue}>{(session.emotionAverages.arousal * 100).toFixed(0)}%</span>
                    </div>
                    <div className={styles.emotionStat}>
                        <span className={styles.emotionLabel}>Control</span>
                        <span className={styles.emotionValue}>{(session.emotionAverages.control * 100).toFixed(0)}%</span>
                    </div>
                </div>
            </section>

            {/* Top Emotions */}
            <section className={styles.detailSection}>
                <h3>🎭 Top Emotions</h3>
                <div className={styles.topEmotions}>
                    {session.mostCommonEmotions.slice(0, 5).map(em => (
                        <div key={em.label} className={styles.emotionTag}>
                            {em.label} <span>{em.percent}%</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Quality */}
            <section className={styles.detailSection}>
                <h3>📊 Signal Quality</h3>
                <div className={styles.qualityRow}>
                    <span>Artifact Time: <strong>{session.artifactPct}%</strong></span>
                    <span>Stability: <strong>{session.stabilityPct}%</strong></span>
                </div>
            </section>

            {/* EEG Quality (if available) */}
            {session.eegQuality && (
                <section className={styles.detailSection}>
                    <h3>📡 EEG Quality</h3>

                    {/* A) EEG Quality Percent (primary metric from Emotiv) */}
                    {session.eegQuality.avgEEGQualityPercent !== null ? (
                        <div className={styles.qualityRow}>
                            <span>Avg EEG Quality: <strong>{session.eegQuality.avgEEGQualityPercent}%</strong></span>
                            <span>Min: <strong>{session.eegQuality.minEEGQualityPercent}%</strong></span>
                            <span>Max: <strong>{session.eegQuality.maxEEGQualityPercent}%</strong></span>
                        </div>
                    ) : (
                        <div className={styles.qualityRow}>
                            <span>EEG Quality: <em>not provided by stream</em></span>
                        </div>
                    )}

                    {/* B) Sensor Contact Quality (from per-sensor data) */}
                    {session.eegQuality.avgBadSensors !== null ? (
                        <div className={styles.qualityRow}>
                            <span>Avg Bad Sensors: <strong>{session.eegQuality.avgBadSensors}</strong></span>
                            <span>Worst: <strong>{session.eegQuality.worstBadSensors}</strong></span>
                            <span>Time with Bad: <strong>{session.eegQuality.timeBadSensorsPct}%</strong></span>
                        </div>
                    ) : (
                        <div className={styles.qualityRow}>
                            <span>Sensor Quality: <em>per-sensor data unavailable</em></span>
                        </div>
                    )}

                    {session.eegQuality.frequentlyBadSensors.length > 0 && (
                        <div className={styles.badSensorsList}>
                            <span className={styles.badSensorsLabel}>Frequently Bad Sensors:</span>
                            {session.eegQuality.frequentlyBadSensors.map(s => (
                                <span key={s.name} className={styles.badSensorTag}>
                                    {s.name} ({s.badPct}%)
                                </span>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Notes */}
            {session.notes && (
                <section className={styles.detailSection}>
                    <h3>📝 Notes</h3>
                    <p className={styles.notes}>{session.notes}</p>
                </section>
            )}

            {/* Delete */}
            <button className={styles.deleteButton} onClick={() => onDelete(session.id)}>
                🗑️ Delete Session
            </button>
        </div>
    );
}

// ================================
// TRENDS VIEW
// ================================

function TrendsView({ sessions }: { sessions: SessionRecord[] }) {
    // Calculate trends
    const trends = useMemo(() => {
        if (sessions.length < 2) return null;

        const recentSessions = sessions.slice(0, 10);

        // Arousal trend
        const arousalTrend = recentSessions.map((s, i) => ({
            index: i,
            value: s.emotionAverages.arousal,
        }));

        // Stability trend
        const stabilityTrend = recentSessions.map((s, i) => ({
            index: i,
            value: s.stabilityPct,
        }));

        // Best states frequency
        const bestStateCounts: Record<string, number> = {};
        for (const s of sessions) {
            const state = s.bestState.stateId;
            if (state !== 'ordinary_waking') {
                bestStateCounts[state] = (bestStateCounts[state] || 0) + 1;
            }
        }

        return {
            arousalTrend,
            stabilityTrend,
            bestStateCounts,
        };
    }, [sessions]);

    if (!trends) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyText}>Need at least 2 sessions to show trends.</span>
            </div>
        );
    }

    return (
        <div className={styles.trendsContainer}>
            {/* Arousal Trend */}
            <section className={styles.trendSection}>
                <h3>📉 Arousal Over Time (Last 10 sessions)</h3>
                <div className={styles.miniChart}>
                    {trends.arousalTrend.map((point, i) => (
                        <div
                            key={i}
                            className={styles.miniBar}
                            style={{ height: `${point.value * 100}%` }}
                            title={`Session ${i + 1}: ${(point.value * 100).toFixed(0)}%`}
                        />
                    ))}
                </div>
            </section>

            {/* Stability Trend */}
            <section className={styles.trendSection}>
                <h3>📈 Stability Over Time (Last 10 sessions)</h3>
                <div className={styles.miniChart}>
                    {trends.stabilityTrend.map((point, i) => (
                        <div
                            key={i}
                            className={`${styles.miniBar} ${styles.green}`}
                            style={{ height: `${point.value}%` }}
                            title={`Session ${i + 1}: ${point.value}%`}
                        />
                    ))}
                </div>
            </section>

            {/* Best States Frequency */}
            <section className={styles.trendSection}>
                <h3>🏆 Best States Achieved (All Time)</h3>
                <div className={styles.bestStatesGrid}>
                    {Object.entries(trends.bestStateCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([stateId, count]) => (
                            <div key={stateId} className={styles.bestStateTag}>
                                <span>{formatStateName(stateId)}</span>
                                <span className={styles.bestStateCount}>{count}x</span>
                            </div>
                        ))}
                </div>
            </section>
        </div>
    );
}

// ================================
// SUMMARY VIEW
// ================================

function SummaryView({ sessions }: { sessions: SessionRecord[] }) {
    const summary = useMemo(() => {
        const totalTime = sessions.reduce((acc, s) => acc + s.durationSec, 0);

        // Most common best state
        const bestStateCounts: Record<string, number> = {};
        for (const s of sessions) {
            bestStateCounts[s.bestState.stateId] = (bestStateCounts[s.bestState.stateId] || 0) + 1;
        }
        const topBestState = Object.entries(bestStateCounts).sort((a, b) => b[1] - a[1])[0];

        // Best sustained duration ever
        const bestSustained = sessions.reduce(
            (best, s) =>
                s.bestState.sustainedSec > best.sustainedSec
                    ? { stateId: s.bestState.stateId, sustainedSec: s.bestState.sustainedSec }
                    : best,
            { stateId: 'none', sustainedSec: 0 }
        );

        // Average band powers
        const avgBands = { alpha: 0, theta: 0, betaH: 0 };
        let bandCount = 0;
        for (const s of sessions) {
            if (s.bandPowerAverages) {
                avgBands.alpha += s.bandPowerAverages.alpha;
                avgBands.theta += s.bandPowerAverages.theta;
                avgBands.betaH += s.bandPowerAverages.betaH;
                bandCount++;
            }
        }
        if (bandCount > 0) {
            avgBands.alpha /= bandCount;
            avgBands.theta /= bandCount;
            avgBands.betaH /= bandCount;
        }

        // Determine strongest calm signature
        let calmSignature = 'Unknown';
        if (avgBands.alpha > avgBands.theta && avgBands.alpha > avgBands.betaH) {
            calmSignature = 'Strong Alpha + Low Beta-H';
        } else if (avgBands.theta > avgBands.alpha) {
            calmSignature = 'Theta-dominant (Deep relaxation)';
        } else {
            calmSignature = 'Balanced Alpha/Theta';
        }

        return {
            totalSessions: sessions.length,
            totalTime,
            topBestState: topBestState ? formatStateName(topBestState[0]) : 'None',
            topBestStateCount: topBestState ? topBestState[1] : 0,
            bestSustained,
            calmSignature,
        };
    }, [sessions]);

    return (
        <div className={styles.summaryContainer}>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Sessions</span>
                    <span className={styles.summaryValue}>{summary.totalSessions}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Training Time</span>
                    <span className={styles.summaryValue}>{formatTime(summary.totalTime)}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Most Common Best State</span>
                    <span className={styles.summaryValue}>{summary.topBestState}</span>
                    <span className={styles.summarySub}>Achieved {summary.topBestStateCount} times</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Best Sustained Duration (Ever)</span>
                    <span className={styles.summaryValue}>{formatTime(summary.bestSustained.sustainedSec)}</span>
                    <span className={styles.summarySub}>{formatStateName(summary.bestSustained.stateId)}</span>
                </div>
            </div>

            <div className={styles.signatureCard}>
                <span className={styles.signatureLabel}>🧘 Your Strongest Calm Signature</span>
                <span className={styles.signatureValue}>{summary.calmSignature}</span>
            </div>
        </div>
    );
}

// ================================
// HELPERS
// ================================

function formatTime(sec: number): string {
    const mins = Math.floor(sec / 60);
    const secs = Math.round(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatStateName(stateId: string): string {
    return stateId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default Records;
