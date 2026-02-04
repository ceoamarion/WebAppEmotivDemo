/**
 * Consciousness State Validation Engine
 * 
 * A humble, accuracy-focused EEG interpretation system.
 * States must be validated over time before confirmation.
 * 
 * Core Principles:
 * 1. Never declare states from momentary data
 * 2. All states pass through CANDIDATE/TRANSITION first
 * 3. Use time, stability, and variance as validators
 * 4. Downgrade when signals conflict
 */

// ================================
// CONFIGURATION
// ================================

const CONFIG = {
    CONFIRMATION_THRESHOLD: 70,        // Min confidence to confirm
    MIN_SUSTAIN_TIME: 20000,           // 20 seconds minimum
    VARIANCE_WINDOW: 20,               // Samples for variance calculation
    MAX_VARIANCE_FOR_STABLE: 8,        // Max variance for "stable" status
    MOTION_ARTIFACT_THRESHOLD: 0.6,    // Motion level that triggers rejection
    HISTORY_LENGTH: 100,               // ~10 seconds at 10Hz
};

// ================================
// STATE DEFINITIONS
// ================================

export interface ConsciousnessState {
    id: string;
    name: string;
    altNames: string[];
    description: string;
    eegPattern: {
        dominantBands: string[];
        secondaryBands?: string[];
        suppressedBands?: string[];
        coherenceLevel: 'low' | 'medium' | 'high' | 'very_high';
        specialPatterns?: string[];
    };
    emotionalSignatures: string[];   // Expected emotions
    conflictingEmotions: string[];   // Emotions that would downgrade
    color: string;
}

export const CONSCIOUSNESS_STATES: ConsciousnessState[] = [
    {
        id: 'ordinary_waking',
        name: 'Ordinary Waking Awareness',
        altNames: ['normal consciousness', 'egoic awareness'],
        description: 'Standard waking state with analytical thinking',
        eegPattern: {
            dominantBands: ['betaH', 'betaL'],
            coherenceLevel: 'low',
        },
        emotionalSignatures: ['neutral', 'analytical', 'active'],
        conflictingEmotions: [],
        color: '#64748b',
    },
    {
        id: 'relaxed_awareness',
        name: 'Relaxed Awareness',
        altNames: ['calm focus', 'light meditation'],
        description: 'Calm, present state with reduced mental chatter',
        eegPattern: {
            dominantBands: ['alpha'],
            secondaryBands: ['betaL'],
            suppressedBands: ['betaH'],
            coherenceLevel: 'medium',
        },
        emotionalSignatures: ['calm', 'present', 'peaceful'],
        conflictingEmotions: ['stress', 'anxiety', 'excitement'],
        color: '#22c55e',
    },
    {
        id: 'deep_relaxation',
        name: 'Deep Relaxation',
        altNames: ['access concentration', 'alpha meditation'],
        description: 'Deep peace with emerging theta waves',
        eegPattern: {
            dominantBands: ['alpha'],
            secondaryBands: ['theta'],
            suppressedBands: ['betaH'],
            coherenceLevel: 'high',
        },
        emotionalSignatures: ['peace', 'groundedness', 'stillness'],
        conflictingEmotions: ['curiosity', 'excitement', 'cognitive_activity'],
        color: '#14b8a6',
    },
    {
        id: 'inner_sound',
        name: 'Inner Sound',
        altNames: ['nada', 'anahata sound', 'inner tone'],
        description: 'Alpha-theta border with sensory decoupling',
        eegPattern: {
            dominantBands: ['alpha', 'theta'],
            coherenceLevel: 'high',
            specialPatterns: ['alpha_theta_crossover'],
        },
        emotionalSignatures: ['stillness', 'absorption', 'wonder'],
        conflictingEmotions: ['stress', 'cognitive_activity'],
        color: '#8b5cf6',
    },
    {
        id: 'hypnagogic',
        name: 'Hypnagogic State',
        altNames: ['mind-awake body-asleep', 'sleep onset'],
        description: 'Theta dominant with dreamlike imagery',
        eegPattern: {
            dominantBands: ['theta'],
            secondaryBands: ['delta'],
            suppressedBands: ['betaH', 'betaL'],
            coherenceLevel: 'medium',
        },
        emotionalSignatures: ['dreamlike', 'detached', 'floating'],
        conflictingEmotions: ['alertness', 'focus'],
        color: '#6366f1',
    },
    {
        id: 'lucid_dreaming',
        name: 'Lucid Dreaming',
        altNames: ['conscious dreaming'],
        description: 'Theta base with bursty frontal gamma',
        eegPattern: {
            dominantBands: ['theta'],
            secondaryBands: ['gamma'],
            suppressedBands: ['alpha'], // Key differentiator
            coherenceLevel: 'medium',
            specialPatterns: ['bursty_gamma', 'fluctuating_coherence'],
        },
        emotionalSignatures: ['curiosity', 'exploration', 'wonder', 'novelty'],
        conflictingEmotions: ['unity', 'stillness', 'reverence'],
        color: '#ec4899',
    },
    {
        id: 'obe',
        name: 'Out-of-Body Experience',
        altNames: ['astral projection', 'disembodiment'],
        description: 'Theta dominance with body-map disruption',
        eegPattern: {
            dominantBands: ['theta'],
            coherenceLevel: 'low',
            specialPatterns: ['body_map_disruption'],
        },
        emotionalSignatures: ['awe', 'detachment', 'floating'],
        conflictingEmotions: ['grounded', 'embodied'],
        color: '#a855f7',
    },
    {
        id: 'bliss_ecstatic',
        name: 'Bliss / Ecstatic Unity',
        altNames: ['devotional bliss', 'rapture'],
        description: 'Alpha-gamma coupling with sustained coherence',
        eegPattern: {
            dominantBands: ['alpha', 'gamma'],
            suppressedBands: ['betaH'],
            coherenceLevel: 'very_high',
            specialPatterns: ['alpha_gamma_coupling'],
        },
        emotionalSignatures: ['joy', 'love', 'gratitude', 'devotion'],
        conflictingEmotions: ['neutral', 'analytical'],
        color: '#f59e0b',
    },
    {
        id: 'samadhi',
        name: 'Samadhi',
        altNames: ['non-duality', 'unitive consciousness'],
        description: 'High-amplitude coherent gamma, suppressed DMN',
        eegPattern: {
            dominantBands: ['gamma'],
            suppressedBands: ['betaH', 'betaL'],
            coherenceLevel: 'very_high',
            specialPatterns: ['high_amplitude_gamma', 'dmn_suppression'],
        },
        emotionalSignatures: ['stillness', 'infinity', 'clarity', 'emptiness'],
        conflictingEmotions: ['curiosity', 'excitement', 'cognitive_activity'],
        color: '#fbbf24',
    },
    {
        id: 'transcendent_meta',
        name: 'Transcendent Meta-Awareness',
        altNames: ['cosmic consciousness', '5D state'],
        description: 'Sustained global gamma with cross-frequency coupling',
        eegPattern: {
            dominantBands: ['gamma'],
            secondaryBands: ['alpha', 'theta'], // Alpha present is key differentiator
            suppressedBands: ['betaH', 'betaL'],
            coherenceLevel: 'very_high',
            specialPatterns: ['smooth_gamma', 'sustained_coherence', 'coherence_aftereffect'],
        },
        emotionalSignatures: ['unity', 'stillness', 'reverence', 'meaning'],
        conflictingEmotions: ['curiosity', 'excitement', 'novelty', 'cognitive_activity'],
        color: '#ffffff',
    },
];

// ================================
// DATA TYPES
// ================================

export interface BrainwaveData {
    delta: number;
    theta: number;
    alpha: number;
    betaL: number;
    betaH: number;
    gamma: number;

    // Emotiv metrics
    engagement?: number;
    stress?: number;
    relaxation?: number;
    focus?: number;

    // Artifact rejection
    motionLevel?: number;
    facialTension?: number;

    timestamp: number;
}

export type StateStatus = 'candidate' | 'entering' | 'stabilizing' | 'confirmed' | 'exiting';
export type CoherenceQuality = 'low' | 'medium' | 'high';
export type EmotionTone =
    | 'curiosity' | 'exploration' | 'novelty' | 'wonder'
    | 'calm' | 'peace' | 'stillness' | 'unity' | 'reverence'
    | 'joy' | 'love' | 'gratitude'
    | 'neutral' | 'analytical' | 'cognitive_activity'
    | 'stress' | 'anxiety';

export interface ValidationResult {
    state: string;
    stateObject: ConsciousnessState;
    confidence: number;
    status: StateStatus;
    timeSustainedSeconds: number;
    dominantBands: string[];
    coherenceQuality: CoherenceQuality;
    emotion: EmotionTone;
    explanation: string;
    isTransition: boolean;
    rawConfidence: number;
    varianceScore: number;
}

// ================================
// VALIDATION ENGINE
// ================================

export class ConsciousnessValidator {
    private history: BrainwaveData[] = [];
    private confidenceHistory: number[] = [];
    private currentCandidateId: string = 'ordinary_waking';
    private candidateEntryTime: number = Date.now();
    private lastConfirmedState: string = 'ordinary_waking';
    private coherenceBuffer: number[] = [];

    constructor() { }

    /**
     * Process brainwave data and return validated state
     */
    validate(data: BrainwaveData): ValidationResult {
        // Add to history
        this.history.push(data);
        if (this.history.length > CONFIG.HISTORY_LENGTH) {
            this.history.shift();
        }

        // RULE: Reject if high motion artifact
        if (data.motionLevel && data.motionLevel > CONFIG.MOTION_ARTIFACT_THRESHOLD) {
            return this.createTransitionResult(
                'Motion artifact detected - maintaining previous state',
                data
            );
        }

        // Calculate derived metrics
        const enriched = this.enrichData(data);
        const coherence = this.calculateCoherence(enriched);
        const emotion = this.inferEmotion(enriched);

        // Score all states
        const scores = CONSCIOUSNESS_STATES.map(state => ({
            state,
            score: this.scoreState(state, enriched, coherence, emotion),
        }));
        scores.sort((a, b) => b.score - a.score);

        const topCandidate = scores[0];
        const secondCandidate = scores[1];
        const rawConfidence = topCandidate.score;

        // Track confidence history
        this.confidenceHistory.push(rawConfidence);
        if (this.confidenceHistory.length > CONFIG.VARIANCE_WINDOW) {
            this.confidenceHistory.shift();
        }

        // Calculate variance
        const variance = this.calculateVariance(this.confidenceHistory);

        // RULE: Check for Lucid Dreaming vs Transcendent Meta-Awareness conflict
        if (this.isLucidTranscendentConflict(topCandidate.state, secondCandidate?.state, enriched)) {
            return this.createSpecialTransitionResult(
                'Transition between Lucid Dreaming and Meta-Awareness',
                enriched,
                coherence,
                emotion,
                rawConfidence,
                variance
            );
        }

        // Track candidate changes
        if (topCandidate.state.id !== this.currentCandidateId) {
            this.currentCandidateId = topCandidate.state.id;
            this.candidateEntryTime = Date.now();
            this.confidenceHistory = [rawConfidence]; // Reset variance tracking
        }

        const timeSustained = Date.now() - this.candidateEntryTime;
        const timeSustainedSeconds = timeSustained / 1000;

        // RULE: Emotional validation - downgrade if emotions conflict
        if (this.hasEmotionalConflict(topCandidate.state, emotion)) {
            return this.createTransitionResult(
                `Resonance detected - emotional pattern (${emotion}) suggests transition`,
                data,
                topCandidate.state,
                rawConfidence * 0.7,
                timeSustainedSeconds,
                coherence,
                emotion,
                variance
            );
        }

        // RULE: Facial tension validation for high-order states
        if (this.isHighOrderState(topCandidate.state.id) && data.facialTension && data.facialTension > 0.5) {
            return this.createTransitionResult(
                'Approaching state - facial tension suggests incomplete relaxation',
                data,
                topCandidate.state,
                rawConfidence * 0.6,
                timeSustainedSeconds,
                coherence,
                emotion,
                variance
            );
        }

        // Determine status based on validation rules
        const status = this.determineStatus(
            rawConfidence,
            timeSustained,
            variance,
            data.motionLevel || 0
        );

        // Generate humble explanation
        const explanation = this.generateExplanation(
            topCandidate.state,
            status,
            rawConfidence,
            timeSustainedSeconds,
            coherence,
            emotion,
            variance
        );

        // RULE: Only mark as confirmed if all criteria met
        const isConfirmed = status === 'confirmed';
        if (isConfirmed) {
            this.lastConfirmedState = topCandidate.state.id;
        }

        return {
            state: this.formatStateName(topCandidate.state, status),
            stateObject: topCandidate.state,
            confidence: Math.round(this.adjustConfidenceForStatus(rawConfidence, status)),
            status,
            timeSustainedSeconds: Math.round(timeSustainedSeconds),
            dominantBands: this.getDominantBands(enriched),
            coherenceQuality: this.getCoherenceQuality(coherence),
            emotion,
            explanation,
            isTransition: status === 'candidate' || status === 'entering',
            rawConfidence: Math.round(rawConfidence),
            varianceScore: Math.round(variance),
        };
    }

    /**
     * RULE: Check for Lucid Dreaming vs Transcendent Meta-Awareness conflict
     */
    private isLucidTranscendentConflict(
        top: ConsciousnessState,
        second: ConsciousnessState | undefined,
        data: BrainwaveData
    ): boolean {
        const conflictPair = ['lucid_dreaming', 'transcendent_meta'];

        if (!conflictPair.includes(top.id)) return false;
        if (!second || !conflictPair.includes(second.id)) return false;

        // Both are in top 2 - check if they're close in score
        const thetaGammaDominant = data.theta > 0.4 && data.gamma > 0.3;
        if (!thetaGammaDominant) return false;

        // ALPHA TIE-BREAKER: If alpha is ambiguous (0.2-0.4), it's a conflict
        const alphaAmbiguous = data.alpha > 0.2 && data.alpha < 0.45;

        return alphaAmbiguous;
    }

    /**
     * Determine status based on validation criteria
     */
    private determineStatus(
        confidence: number,
        timeSustained: number,
        variance: number,
        motionLevel: number
    ): StateStatus {
        // RULE: Must pass ALL criteria for confirmation
        const confidenceMet = confidence >= CONFIG.CONFIRMATION_THRESHOLD;
        const timeMet = timeSustained >= CONFIG.MIN_SUSTAIN_TIME;
        const varianceMet = variance <= CONFIG.MAX_VARIANCE_FOR_STABLE;
        const motionMet = motionLevel < CONFIG.MOTION_ARTIFACT_THRESHOLD;

        if (confidenceMet && timeMet && varianceMet && motionMet) {
            return 'confirmed';
        }

        if (confidenceMet && timeSustained > CONFIG.MIN_SUSTAIN_TIME * 0.75) {
            return 'stabilizing';
        }

        if (confidence > 50 && timeSustained > 5000) {
            return 'entering';
        }

        if (confidence < 40 && timeSustained > 3000) {
            return 'exiting';
        }

        return 'candidate';
    }

    /**
     * Check for emotional conflict with state
     */
    private hasEmotionalConflict(state: ConsciousnessState, emotion: EmotionTone): boolean {
        return state.conflictingEmotions.includes(emotion);
    }

    /**
     * Check if state is high-order (requires more validation)
     */
    private isHighOrderState(stateId: string): boolean {
        const highOrderStates = ['samadhi', 'transcendent_meta', 'bliss_ecstatic', 'obe'];
        return highOrderStates.includes(stateId);
    }

    /**
     * Score a state based on current data
     */
    private scoreState(
        state: ConsciousnessState,
        data: BrainwaveData,
        coherence: number,
        emotion: EmotionTone
    ): number {
        let score = 0;

        const bands: Record<string, number> = {
            delta: data.delta,
            theta: data.theta,
            alpha: data.alpha,
            betaL: data.betaL,
            betaH: data.betaH,
            gamma: data.gamma,
        };

        // Dominant band scoring (40 points max)
        const sortedBands = Object.entries(bands).sort((a, b) => b[1] - a[1]);
        const topBandNames = sortedBands.slice(0, 2).map(b => b[0]);

        for (const dominant of state.eegPattern.dominantBands) {
            if (topBandNames.includes(dominant)) {
                score += 20 * bands[dominant];
            }
        }

        // Secondary band scoring (15 points max)
        if (state.eegPattern.secondaryBands) {
            for (const secondary of state.eegPattern.secondaryBands) {
                if (bands[secondary] > 0.25) {
                    score += 7.5 * bands[secondary];
                }
            }
        }

        // Suppressed band scoring (15 points max - bonus for low values)
        if (state.eegPattern.suppressedBands) {
            for (const suppressed of state.eegPattern.suppressedBands) {
                if (bands[suppressed] < 0.3) {
                    score += 7.5 * (1 - bands[suppressed]);
                }
            }
        }

        // Coherence scoring (15 points)
        const coherenceMap = { low: 0.25, medium: 0.5, high: 0.75, very_high: 0.9 };
        const expectedCoherence = coherenceMap[state.eegPattern.coherenceLevel];
        const coherenceMatch = 1 - Math.abs(coherence - expectedCoherence);
        score += 15 * coherenceMatch;

        // Emotional agreement scoring (15 points)
        if (state.emotionalSignatures.includes(emotion)) {
            score += 15;
        } else if (state.conflictingEmotions.includes(emotion)) {
            score -= 10; // Penalty for conflict
        }

        // Special pattern scoring for Lucid vs Transcendent
        if (state.id === 'lucid_dreaming') {
            // Prefer when alpha is LOW
            if (data.alpha < 0.25) score += 10;
            // Prefer bursty gamma (high variance in gamma history)
            const gammaVariance = this.getRecentGammaVariance();
            if (gammaVariance > 0.1) score += 5;
        }

        if (state.id === 'transcendent_meta') {
            // Prefer when alpha is PRESENT
            if (data.alpha > 0.3) score += 10;
            // Prefer smooth gamma (low variance)
            const gammaVariance = this.getRecentGammaVariance();
            if (gammaVariance < 0.05) score += 5;
            // Prefer sustained coherence
            if (this.hasCoherenceAftereffect()) score += 5;
        }

        return Math.min(100, Math.max(0, score));
    }

    private getRecentGammaVariance(): number {
        if (this.history.length < 5) return 0;
        const recentGamma = this.history.slice(-10).map(h => h.gamma);
        return this.calculateVariance(recentGamma);
    }

    private hasCoherenceAftereffect(): boolean {
        if (this.coherenceBuffer.length < 10) return false;
        const recent = this.coherenceBuffer.slice(-5);
        const earlier = this.coherenceBuffer.slice(-10, -5);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
        // Coherence persists or increases after peak
        return recentAvg >= earlierAvg * 0.9;
    }

    /**
     * Enrich data with derived metrics
     */
    private enrichData(data: BrainwaveData): BrainwaveData {
        return { ...data };
    }

    /**
     * Calculate coherence estimate
     */
    private calculateCoherence(data: BrainwaveData): number {
        // Use relaxation + focus as coherence proxy
        let coherence = 0.5;

        if (data.relaxation !== undefined && data.focus !== undefined) {
            coherence = (data.relaxation * 0.4 + data.focus * 0.4 + 0.2);
        } else {
            // Estimate from band balance
            const bands = [data.theta, data.alpha, data.gamma];
            const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
            const variance = this.calculateVariance(bands);
            coherence = avg * (1 - variance);
        }

        this.coherenceBuffer.push(coherence);
        if (this.coherenceBuffer.length > 30) {
            this.coherenceBuffer.shift();
        }

        return Math.min(1, Math.max(0, coherence));
    }

    /**
     * Infer emotional tone from metrics
     */
    private inferEmotion(data: BrainwaveData): EmotionTone {
        // Use Emotiv metrics if available
        if (data.stress !== undefined && data.relaxation !== undefined) {
            if (data.stress > 0.6) return 'stress';
            if (data.relaxation > 0.7 && data.focus && data.focus > 0.6) return 'stillness';
            if (data.relaxation > 0.6) return 'calm';
            if (data.engagement && data.engagement > 0.7) return 'curiosity';
        }

        // Infer from band patterns
        if (data.gamma > 0.5 && data.alpha > 0.4) return 'unity';
        if (data.gamma > 0.4 && data.theta > 0.4 && data.alpha < 0.3) return 'curiosity';
        if (data.alpha > 0.5 && data.betaH < 0.3) return 'peace';
        if (data.theta > 0.5) return 'wonder';
        if (data.betaH > 0.5) return 'cognitive_activity';

        return 'neutral';
    }

    /**
     * Get dominant bands from data
     */
    private getDominantBands(data: BrainwaveData): string[] {
        const bands = [
            { name: 'Delta', value: data.delta },
            { name: 'Theta', value: data.theta },
            { name: 'Alpha', value: data.alpha },
            { name: 'Beta-L', value: data.betaL },
            { name: 'Beta-H', value: data.betaH },
            { name: 'Gamma', value: data.gamma },
        ];
        bands.sort((a, b) => b.value - a.value);
        return bands.slice(0, 2).map(b => b.name);
    }

    /**
     * Get coherence quality label
     */
    private getCoherenceQuality(coherence: number): CoherenceQuality {
        if (coherence > 0.7) return 'high';
        if (coherence > 0.4) return 'medium';
        return 'low';
    }

    /**
     * Calculate variance of values
     */
    private calculateVariance(values: number[]): number {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }

    /**
     * Adjust displayed confidence based on status
     */
    private adjustConfidenceForStatus(rawConfidence: number, status: StateStatus): number {
        switch (status) {
            case 'candidate': return rawConfidence * 0.6;
            case 'entering': return rawConfidence * 0.8;
            case 'stabilizing': return rawConfidence * 0.9;
            case 'confirmed': return rawConfidence;
            case 'exiting': return rawConfidence * 0.7;
            default: return rawConfidence;
        }
    }

    /**
     * Format state name with humble prefix based on status
     */
    private formatStateName(state: ConsciousnessState, status: StateStatus): string {
        const baseName = state.name.split('/')[0].trim();

        switch (status) {
            case 'candidate':
                return `Resonance: ${baseName}`;
            case 'entering':
                return `Approaching ${baseName}`;
            case 'stabilizing':
                return `Transitioning toward ${baseName}`;
            case 'confirmed':
                return baseName;
            case 'exiting':
                return `Exiting ${baseName}`;
            default:
                return baseName;
        }
    }

    /**
     * Generate humble explanation
     */
    private generateExplanation(
        state: ConsciousnessState,
        status: StateStatus,
        confidence: number,
        timeSeconds: number,
        coherence: number,
        emotion: EmotionTone,
        variance: number
    ): string {
        const coherenceLabel = this.getCoherenceQuality(coherence);

        let explanation = '';

        switch (status) {
            case 'candidate':
                explanation = `Pattern resonance detected. ${coherenceLabel} coherence with ${emotion} tone. `;
                explanation += `Observing for stability (${timeSeconds}s / 20s required).`;
                break;

            case 'entering':
                explanation = `Beginning to approach ${state.name.split('/')[0].trim()}. `;
                explanation += `Confidence ${confidence.toFixed(0)}% with ${coherenceLabel} coherence. `;
                explanation += `Awaiting stabilization.`;
                break;

            case 'stabilizing':
                explanation = `Pattern stabilizing toward ${state.name.split('/')[0].trim()}. `;
                explanation += `Sustained ${timeSeconds}s with reducing variance. `;
                explanation += `Emotional tone: ${emotion}.`;
                break;

            case 'confirmed':
                explanation = `State validated: ${coherenceLabel} coherence, stable pattern, `;
                explanation += `${emotion} emotional alignment. Sustained ${timeSeconds}s.`;
                break;

            case 'exiting':
                explanation = `Transitioning out. Pattern dissolving (variance: ${variance.toFixed(1)}). `;
                explanation += `Returning toward baseline awareness.`;
                break;
        }

        return explanation;
    }

    /**
     * Create transition result for artifacts/conflicts
     */
    private createTransitionResult(
        explanation: string,
        data: BrainwaveData,
        state?: ConsciousnessState,
        confidence?: number,
        timeSeconds?: number,
        coherence?: number,
        emotion?: EmotionTone,
        variance?: number
    ): ValidationResult {
        const fallbackState = state || CONSCIOUSNESS_STATES[0];
        return {
            state: 'Transition',
            stateObject: fallbackState,
            confidence: Math.round(confidence || 30),
            status: 'candidate',
            timeSustainedSeconds: Math.round(timeSeconds || 0),
            dominantBands: this.getDominantBands(data),
            coherenceQuality: 'low',
            emotion: emotion || 'neutral',
            explanation,
            isTransition: true,
            rawConfidence: Math.round(confidence || 30),
            varianceScore: Math.round(variance || 0),
        };
    }

    /**
     * Create special transition for Lucid/Transcendent conflict
     */
    private createSpecialTransitionResult(
        stateName: string,
        data: BrainwaveData,
        coherence: number,
        emotion: EmotionTone,
        confidence: number,
        variance: number
    ): ValidationResult {
        return {
            state: stateName,
            stateObject: CONSCIOUSNESS_STATES.find(s => s.id === 'lucid_dreaming')!,
            confidence: Math.round(confidence * 0.7),
            status: 'candidate',
            timeSustainedSeconds: 0,
            dominantBands: this.getDominantBands(data),
            coherenceQuality: this.getCoherenceQuality(coherence),
            emotion,
            explanation: `Theta-Gamma pattern with ambiguous Alpha. Cannot differentiate between Lucid Dreaming and Meta-Awareness. Observing pattern evolution.`,
            isTransition: true,
            rawConfidence: Math.round(confidence),
            varianceScore: Math.round(variance),
        };
    }

    /**
     * Reset the validator
     */
    reset() {
        this.history = [];
        this.confidenceHistory = [];
        this.currentCandidateId = 'ordinary_waking';
        this.candidateEntryTime = Date.now();
        this.coherenceBuffer = [];
    }
}

// Export singleton
export const consciousnessValidator = new ConsciousnessValidator();
