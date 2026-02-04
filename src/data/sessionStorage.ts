/**
 * Session Recording Types + Storage
 * 
 * Stores session data for Records page and analytics.
 * Uses localStorage for persistence.
 */

// ================================
// SESSION RECORD TYPE
// ================================

export interface SessionRecord {
    id: string;
    startedAt: string; // ISO string
    endedAt: string;   // ISO string
    durationSec: number;

    // Mind states timeline
    stateTimeline: Array<{
        t: number;        // ms since session start
        stateId: string;
        confidence: number;
        status: 'candidate' | 'confirmed' | 'locked';
    }>;
    timeByState: Record<string, number>; // seconds
    bestState: {
        stateId: string;
        sustainedSec: number;
        maxConfidence: number;
    };

    // Emotion timeline
    emotionTimeline: Array<{
        t: number;
        valence: number;
        arousal: number;
        control: number;
        topEmotions: Array<{ label: string; confidence: number }>;
    }>;
    emotionAverages: {
        valence: number;
        arousal: number;
        control: number;
    };
    mostCommonEmotions: Array<{ label: string; percent: number }>;

    // Band power timeline
    bandPowerTimeline: Array<{
        t: number;
        theta: number;
        alpha: number;
        betaL: number;
        betaH: number;
        gamma: number;
    }>;
    bandPowerAverages: {
        theta: number;
        alpha: number;
        betaL: number;
        betaH: number;
        gamma: number;
    };

    // Quality metrics
    artifactPct: number;
    stabilityPct: number;

    // EEG Quality metrics (from dev stream)
    // These are separate metrics - do NOT mix them
    eegQuality?: {
        // A) EEG Quality Percent - from Emotiv's stream
        avgEEGQualityPercent: number | null;
        minEEGQualityPercent: number | null;
        maxEEGQualityPercent: number | null;
        // B) Sensor contact quality - derived from per-sensor data
        avgBadSensors: number | null;
        worstBadSensors: number | null;
        timeBadSensorsPct: number | null; // % of time badSensorsCount > 0
        frequentlyBadSensors: Array<{ name: string; badPct: number }>;
        samples: number;
    };

    // User notes
    notes?: string;
}

// ================================
// SESSION COLLECTOR (in-memory during session)
// ================================

export interface SessionCollector {
    sessionId: string;
    startedAt: Date;

    // Raw samples
    stateSamples: Array<{
        t: number;
        stateId: string;
        confidence: number;
        status: 'candidate' | 'confirmed' | 'locked';
    }>;

    emotionSamples: Array<{
        t: number;
        valence: number;
        arousal: number;
        control: number;
        topEmotions: Array<{ label: string; confidence: number }>;
    }>;

    bandPowerSamples: Array<{
        t: number;
        theta: number;
        alpha: number;
        betaL: number;
        betaH: number;
        gamma: number;
    }>;

    // Quality tracking
    artifactSamples: number;
    totalSamples: number;

    // EEG Quality tracking - separate metrics
    eegQualitySamples: Array<{
        t: number;
        eegQualityPercent: number | null;  // From Emotiv stream
        badSensorsCount: number | null;     // From per-sensor data
        perSensorBad: string[];             // Names of bad sensors
    }>;
}

export function createSessionCollector(): SessionCollector {
    return {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startedAt: new Date(),
        stateSamples: [],
        emotionSamples: [],
        bandPowerSamples: [],
        artifactSamples: 0,
        totalSamples: 0,
        eegQualitySamples: [],
    };
}

export function addStateSample(
    collector: SessionCollector,
    stateId: string,
    confidence: number,
    status: 'candidate' | 'confirmed' | 'locked'
): void {
    const t = Date.now() - collector.startedAt.getTime();
    collector.stateSamples.push({ t, stateId, confidence, status });
}

export function addEmotionSample(
    collector: SessionCollector,
    valence: number,
    arousal: number,
    control: number,
    topEmotions: Array<{ label: string; confidence: number }>
): void {
    const t = Date.now() - collector.startedAt.getTime();
    collector.emotionSamples.push({ t, valence, arousal, control, topEmotions });
}

export function addBandPowerSample(
    collector: SessionCollector,
    theta: number,
    alpha: number,
    betaL: number,
    betaH: number,
    gamma: number
): void {
    const t = Date.now() - collector.startedAt.getTime();
    collector.bandPowerSamples.push({ t, theta, alpha, betaL, betaH, gamma });
    collector.totalSamples++;
}

export function markArtifact(collector: SessionCollector): void {
    collector.artifactSamples++;
}

export function addEEGQualitySample(
    collector: SessionCollector,
    eegQualityPercent: number | null,
    badSensorsCount: number | null,
    badSensorNames: string[]
): void {
    const t = Date.now() - collector.startedAt.getTime();
    collector.eegQualitySamples.push({
        t,
        eegQualityPercent,
        badSensorsCount,
        perSensorBad: badSensorNames,
    });
}

// ================================
// FINALIZE SESSION
// ================================

export function finalizeSession(collector: SessionCollector): SessionRecord {
    const endedAt = new Date();
    const durationSec = Math.round((endedAt.getTime() - collector.startedAt.getTime()) / 1000);

    // Calculate time by state
    const timeByState: Record<string, number> = {};
    let prevT = 0;
    let prevStateId = 'ordinary_waking';

    for (const sample of collector.stateSamples) {
        const deltaMs = sample.t - prevT;
        timeByState[prevStateId] = (timeByState[prevStateId] || 0) + deltaMs / 1000;
        prevT = sample.t;
        prevStateId = sample.stateId;
    }
    // Add remaining time
    const remainingMs = durationSec * 1000 - prevT;
    if (remainingMs > 0) {
        timeByState[prevStateId] = (timeByState[prevStateId] || 0) + remainingMs / 1000;
    }

    // Find best state
    let bestState = { stateId: 'ordinary_waking', sustainedSec: 0, maxConfidence: 0 };
    const higherStates = ['transcendent', 'samadhi', 'bliss', 'mystical_unity', 'out_of_body', 'lucid_dreaming'];

    for (const stateId of higherStates) {
        const time = timeByState[stateId] || 0;
        if (time > bestState.sustainedSec) {
            const maxConf = Math.max(
                ...collector.stateSamples
                    .filter(s => s.stateId === stateId)
                    .map(s => s.confidence),
                0
            );
            bestState = { stateId, sustainedSec: Math.round(time), maxConfidence: Math.round(maxConf) };
        }
    }

    // Emotion averages
    const emotionAverages = {
        valence: avg(collector.emotionSamples.map(s => s.valence)),
        arousal: avg(collector.emotionSamples.map(s => s.arousal)),
        control: avg(collector.emotionSamples.map(s => s.control)),
    };

    // Most common emotions
    const emotionCounts: Record<string, number> = {};
    for (const sample of collector.emotionSamples) {
        for (const em of sample.topEmotions) {
            emotionCounts[em.label] = (emotionCounts[em.label] || 0) + 1;
        }
    }
    const totalEmotionSamples = collector.emotionSamples.length || 1;
    const mostCommonEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({
            label,
            percent: Math.round((count / totalEmotionSamples) * 100),
        }));

    // Band power averages
    const bandPowerAverages = {
        theta: avg(collector.bandPowerSamples.map(s => s.theta)),
        alpha: avg(collector.bandPowerSamples.map(s => s.alpha)),
        betaL: avg(collector.bandPowerSamples.map(s => s.betaL)),
        betaH: avg(collector.bandPowerSamples.map(s => s.betaH)),
        gamma: avg(collector.bandPowerSamples.map(s => s.gamma)),
    };

    // Quality
    const artifactPct = collector.totalSamples > 0
        ? Math.round((collector.artifactSamples / collector.totalSamples) * 100)
        : 0;

    const lockedSamples = collector.stateSamples.filter(s => s.status === 'locked').length;
    const stabilityPct = collector.stateSamples.length > 0
        ? Math.round((lockedSamples / collector.stateSamples.length) * 100)
        : 0;

    // EEG Quality metrics - keep separate values
    let eegQuality: SessionRecord['eegQuality'];
    if (collector.eegQualitySamples.length > 0) {
        const totalQualitySamples = collector.eegQualitySamples.length;

        // A) EEG Quality Percent (from stream)
        const eegQualitySamples = collector.eegQualitySamples.filter(s => s.eegQualityPercent !== null);
        let avgEEGQualityPercent: number | null = null;
        let minEEGQualityPercent: number | null = null;
        let maxEEGQualityPercent: number | null = null;

        if (eegQualitySamples.length > 0) {
            const pcts = eegQualitySamples.map(s => s.eegQualityPercent as number);
            avgEEGQualityPercent = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
            minEEGQualityPercent = Math.min(...pcts);
            maxEEGQualityPercent = Math.max(...pcts);
        }

        // B) Sensor contact quality (from per-sensor data)
        const sensorSamples = collector.eegQualitySamples.filter(s => s.badSensorsCount !== null);
        let avgBadSensors: number | null = null;
        let worstBadSensors: number | null = null;
        let timeBadSensorsPct: number | null = null;

        if (sensorSamples.length > 0) {
            const badCounts = sensorSamples.map(s => s.badSensorsCount as number);
            avgBadSensors = Math.round((badCounts.reduce((a, b) => a + b, 0) / badCounts.length) * 10) / 10;
            worstBadSensors = Math.max(...badCounts);
            const timeBadCount = badCounts.filter(c => c > 0).length;
            timeBadSensorsPct = Math.round((timeBadCount / sensorSamples.length) * 100);
        }

        // Count bad occurrences per sensor
        const sensorBadCounts: Record<string, number> = {};
        for (const sample of collector.eegQualitySamples) {
            for (const name of sample.perSensorBad) {
                sensorBadCounts[name] = (sensorBadCounts[name] || 0) + 1;
            }
        }

        eegQuality = {
            avgEEGQualityPercent,
            minEEGQualityPercent,
            maxEEGQualityPercent,
            avgBadSensors,
            worstBadSensors,
            timeBadSensorsPct,
            frequentlyBadSensors: Object.entries(sensorBadCounts)
                .map(([name, count]) => ({
                    name,
                    badPct: Math.round((count / totalQualitySamples) * 100),
                }))
                .sort((a, b) => b.badPct - a.badPct)
                .slice(0, 3),
            samples: totalQualitySamples,
        };
    }

    return {
        id: collector.sessionId,
        startedAt: collector.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSec,
        stateTimeline: collector.stateSamples,
        timeByState,
        bestState,
        emotionTimeline: collector.emotionSamples,
        emotionAverages,
        mostCommonEmotions,
        bandPowerTimeline: collector.bandPowerSamples,
        bandPowerAverages,
        artifactPct,
        stabilityPct,
        eegQuality,
    };
}

function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// ================================
// STORAGE
// ================================

const STORAGE_KEY = 'consciousness_explorer_sessions';

export function saveSession(record: SessionRecord): void {
    if (typeof localStorage === 'undefined') return;

    const existing = loadAllSessions();
    existing.unshift(record); // newest first

    // Keep max 100 sessions
    const trimmed = existing.slice(0, 100);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function loadAllSessions(): SessionRecord[] {
    if (typeof localStorage === 'undefined') return [];

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    try {
        return JSON.parse(stored) as SessionRecord[];
    } catch {
        return [];
    }
}

export function deleteSession(sessionId: string): void {
    if (typeof localStorage === 'undefined') return;

    const existing = loadAllSessions();
    const filtered = existing.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function exportSessionsJSON(): string {
    const sessions = loadAllSessions();
    return JSON.stringify(sessions, null, 2);
}
