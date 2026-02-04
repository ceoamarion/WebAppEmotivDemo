/**
 * Emotion Inference Hook
 * 
 * Runs alongside state engine as a READ-ONLY overlay.
 * NEVER triggers state changes directly.
 * 
 * Outputs:
 * - Dimensional axes: valence, arousal, control
 * - Top emotions with confidence
 * - Emotion note explaining inference
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { POWData } from './useEEGStream';

// Emotion label definitions
export type PositiveEmotion =
    | 'joy/happy'
    | 'calm/peace'
    | 'gratitude'
    | 'love/connection'
    | 'curiosity'
    | 'confidence'
    | 'awe';

export type NegativeEmotion =
    | 'anxiety'
    | 'stress'
    | 'fear'
    | 'sadness'
    | 'anger/irritation'
    | 'frustration'
    | 'shame/guilt'
    | 'overwhelm';

export type EmotionLabel = PositiveEmotion | NegativeEmotion | 'neutral';

export interface EmotionAxes {
    valence: number;  // -1.0 (negative) to +1.0 (positive)
    arousal: number;  // 0.0 (low) to 1.0 (high)
    control: number;  // 0.0 (overwhelmed) to 1.0 (composed)
}

export interface TopEmotion {
    label: EmotionLabel;
    confidence: number; // 0-100
}

export interface EmotionResult {
    axes: EmotionAxes;
    topEmotions: TopEmotion[];
    emotionNote: string;
    timestamp: number;
    isTranscendenceUnstable: boolean; // Validation flag for state display
}

export interface METData {
    engagement?: number;
    stress?: number;
    relaxation?: number;
    focus?: number;
}

const EMOTION_INTERVAL = 200; // ~5Hz

// Emotion inference function
function inferEmotions(pow: POWData, met: METData | null): EmotionResult {
    const now = Date.now();

    // Default axes
    let valence = 0;
    let arousal = 0.5;
    let control = 0.5;

    // Emotion scores (will be normalized to top 3)
    const emotionScores: Record<EmotionLabel, number> = {
        'joy/happy': 0,
        'calm/peace': 0,
        'gratitude': 0,
        'love/connection': 0,
        'curiosity': 0,
        'confidence': 0,
        'awe': 0,
        'anxiety': 0,
        'stress': 0,
        'fear': 0,
        'sadness': 0,
        'anger/irritation': 0,
        'frustration': 0,
        'shame/guilt': 0,
        'overwhelm': 0,
        'neutral': 20, // Base neutral score
    };

    const notes: string[] = [];

    // ========================================
    // EEG PATTERN ANALYSIS
    // ========================================

    // High Beta-H + low Alpha → anxious/tense
    if (pow.betaH > 0.5 && pow.alpha < 0.3) {
        emotionScores['anxiety'] += 35;
        emotionScores['stress'] += 25;
        valence -= 0.3;
        arousal += 0.2;
        control -= 0.2;
        notes.push('High Beta-H with suppressed Alpha suggests heightened tension');
    }

    // Strong Alpha + low Beta-H → calm/peace
    if (pow.alpha > 0.5 && pow.betaH < 0.3) {
        emotionScores['calm/peace'] += 40;
        emotionScores['confidence'] += 20;
        valence += 0.35;
        control += 0.25;
        notes.push('Strong Alpha with low Beta-H indicates relaxed awareness');
    }

    // Theta rising + low arousal → dreamlike/meditative
    if (pow.theta > 0.5 && pow.betaH < 0.25) {
        emotionScores['calm/peace'] += 25;
        emotionScores['awe'] += 15;
        valence += 0.2;
        arousal -= 0.15;
        notes.push('Rising Theta suggests meditative or dreamlike state');
    }

    // Gamma bursts + engagement → curiosity/excitement
    if (pow.gamma > 0.4) {
        emotionScores['curiosity'] += 30;
        emotionScores['awe'] += 20;
        arousal += 0.2;
        notes.push('Gamma activity indicates heightened cognitive engagement');
    }

    // High Beta overall → stressed/pressured
    if (pow.betaL > 0.5 && pow.betaH > 0.5) {
        emotionScores['stress'] += 30;
        emotionScores['overwhelm'] += 20;
        valence -= 0.2;
        arousal += 0.25;
        control -= 0.15;
    }

    // ========================================
    // METRICS ANALYSIS (if available)
    // ========================================

    if (met) {
        // Stress metric
        if (met.stress !== undefined && met.stress > 0.6) {
            emotionScores['stress'] += 35;
            emotionScores['anxiety'] += 25;
            emotionScores['overwhelm'] += 20;
            valence -= 0.3;
            arousal += 0.2;
            control -= 0.25;
            notes.push('Elevated stress detected');
        }

        // Relaxation metric
        if (met.relaxation !== undefined && met.relaxation > 0.6) {
            emotionScores['calm/peace'] += 40;
            emotionScores['gratitude'] += 15;
            valence += 0.35;
            control += 0.3;
            notes.push('High relaxation levels');
        }

        // Engagement + Focus patterns
        if (met.engagement !== undefined && met.focus !== undefined) {
            const highEngagement = met.engagement > 0.6;
            const highFocus = met.focus > 0.6;
            const lowStress = (met.stress ?? 0.5) < 0.4;

            if (highEngagement && highFocus && lowStress) {
                emotionScores['curiosity'] += 35;
                emotionScores['confidence'] += 30;
                valence += 0.25;
                control += 0.2;
                notes.push('Engaged and focused without stress - flow-like state');
            } else if (highEngagement && highFocus && !lowStress) {
                emotionScores['stress'] += 25;
                emotionScores['overwhelm'] += 20;
                valence -= 0.15;
                notes.push('High engagement with elevated stress - pressured state');
            }

            if (highFocus && lowStress) {
                emotionScores['confidence'] += 25;
            }
        }
    }

    // ========================================
    // CLAMP AND NORMALIZE
    // ========================================

    valence = Math.max(-1, Math.min(1, valence));
    arousal = Math.max(0, Math.min(1, arousal));
    control = Math.max(0, Math.min(1, control));

    // Valence/Arousal quadrant adjustments
    if (valence < -0.3 && arousal > 0.6) {
        // High arousal + negative valence → anxiety/fear/anger family
        emotionScores['anxiety'] += 20;
        emotionScores['fear'] += 15;
        emotionScores['anger/irritation'] += 10;
    }

    if (valence < -0.3 && arousal < 0.4) {
        // Low arousal + negative valence → sadness/flatness
        emotionScores['sadness'] += 30;
        emotionScores['frustration'] += 15;
    }

    if (valence > 0.3 && arousal > 0.6) {
        // High arousal + positive valence → joy/curiosity
        emotionScores['joy/happy'] += 25;
        emotionScores['curiosity'] += 20;
    }

    if (valence > 0.3 && arousal < 0.4) {
        // Low arousal + positive valence → calm/peace/gratitude
        emotionScores['calm/peace'] += 25;
        emotionScores['gratitude'] += 15;
    }

    // ========================================
    // EXTRACT TOP EMOTIONS
    // ========================================

    const sortedEmotions = Object.entries(emotionScores)
        .map(([label, score]) => ({ label: label as EmotionLabel, confidence: Math.min(100, score) }))
        .filter(e => e.confidence > 10)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

    // Ensure we always have at least one emotion
    if (sortedEmotions.length === 0) {
        sortedEmotions.push({ label: 'neutral', confidence: 50 });
    }

    // ========================================
    // TRANSCENDENCE INSTABILITY CHECK
    // ========================================

    // Check if negative emotions dominate during high Gamma (transcendence-like)
    const isTranscendencePattern = pow.gamma > 0.5 || (pow.theta > 0.5 && pow.gamma > 0.3);
    const negativeEmotionTotal =
        emotionScores['anxiety'] +
        emotionScores['stress'] +
        emotionScores['fear'] +
        emotionScores['overwhelm'];
    const isTranscendenceUnstable = isTranscendencePattern && negativeEmotionTotal > 60;

    // ========================================
    // BUILD EMOTION NOTE
    // ========================================

    let emotionNote = notes.length > 0
        ? notes[0]
        : `Valence ${valence > 0 ? 'positive' : valence < 0 ? 'negative' : 'neutral'} with ${arousal > 0.6 ? 'high' : arousal < 0.4 ? 'low' : 'moderate'} arousal`;

    if (isTranscendenceUnstable) {
        emotionNote += ' — transcendence pattern with emotional instability';
    }

    return {
        axes: { valence, arousal, control },
        topEmotions: sortedEmotions,
        emotionNote,
        timestamp: now,
        isTranscendenceUnstable,
    };
}

// Main hook
export function useEmotionInference(
    pow: POWData | null,
    met: METData | null
): EmotionResult {
    const [result, setResult] = useState<EmotionResult>({
        axes: { valence: 0, arousal: 0.5, control: 0.5 },
        topEmotions: [{ label: 'neutral', confidence: 50 }],
        emotionNote: 'Awaiting data',
        timestamp: 0,
        isTranscendenceUnstable: false,
    });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const powRef = useRef<POWData | null>(null);
    const metRef = useRef<METData | null>(null);

    // Update refs
    useEffect(() => {
        powRef.current = pow;
    }, [pow]);

    useEffect(() => {
        metRef.current = met;
    }, [met]);

    // Run inference at fixed interval
    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            const currentPow = powRef.current;
            const currentMet = metRef.current;

            if (!currentPow) return;

            const newResult = inferEmotions(currentPow, currentMet);
            setResult(newResult);
        }, EMOTION_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    return result;
}
