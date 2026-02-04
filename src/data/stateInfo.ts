/**
 * State Info Map v2
 * 
 * Contains detailed information for each consciousness state
 * including aliases, dominant bands, descriptions, and awake/sleep variants.
 */

export interface StateInfo {
    id: string;
    name: string;
    aliases: string[];
    dominantBands: string[];
    description: string;
    gatingHint: string;
    color: string;
    requiresSleepContext?: boolean;
    awakeVariant?: {
        name: string;
        description: string;
    };
}

export const STATE_INFO: Record<string, StateInfo> = {
    ordinary_waking: {
        id: 'ordinary_waking',
        name: 'Ordinary Waking Awareness',
        aliases: ['Normal consciousness', 'Default mode', 'Egoic awareness'],
        dominantBands: ['Beta-H', 'Beta-L'],
        description: 'Standard waking state characterized by analytical thinking, external focus, and continuous mental chatter.',
        gatingHint: 'Default state, no special conditions',
        color: '#64748b',
    },
    relaxed_awareness: {
        id: 'relaxed_awareness',
        name: 'Relaxed Awareness',
        aliases: ['Calm focus', 'Light meditation', 'Alpha state'],
        dominantBands: ['Alpha'],
        description: 'Calm, present state with reduced mental chatter. Eyes may be closed, body relaxed, mind quiet but alert.',
        gatingHint: 'Alpha dominance with suppressed high Beta',
        color: '#22c55e',
    },
    deep_relaxation: {
        id: 'deep_relaxation',
        name: 'Deep Relaxation',
        aliases: ['Access concentration', 'Alpha-Theta border', 'Pre-sleep awareness'],
        dominantBands: ['Alpha', 'Theta'],
        description: 'Deep peace with emerging theta waves. Body deeply relaxed, mind quiet, sensory withdrawal beginning.',
        gatingHint: 'Strong Alpha + emerging Theta, suppressed Beta',
        color: '#14b8a6',
    },
    inner_sound: {
        id: 'inner_sound',
        name: 'Inner Sound',
        aliases: ['Nada', 'Anahata sound', 'Unstruck sound', 'Inner tone'],
        dominantBands: ['Alpha', 'Theta', 'Gamma'],
        description: 'Perception of subtle inner sounds at the alpha-theta boundary. Often described as high-pitched tones, humming, or celestial music.',
        gatingHint: 'Alpha-Theta crossover with Gamma bursts',
        color: '#8b5cf6',
    },
    hypnagogic: {
        id: 'hypnagogic',
        name: 'Hypnagogic State',
        aliases: ['Mind-awake body-asleep', 'Sleep onset', 'Threshold consciousness'],
        dominantBands: ['Theta'],
        description: 'Transitional state between waking and sleep. Characterized by dreamlike imagery, floating sensations, and altered body awareness.',
        gatingHint: 'Theta dominant, suppressed Alpha and Beta',
        color: '#6366f1',
    },
    obe: {
        id: 'obe',
        name: 'Out-of-Body Experience',
        aliases: ['Astral projection', 'Disembodiment', 'Etheric travel'],
        dominantBands: ['Theta'],
        description: 'Sensation of consciousness separating from the physical body. Often accompanied by vibrations, floating, and altered spatial perception.',
        gatingHint: 'Theta dominant with disrupted body-map coherence',
        color: '#a855f7',
    },
    // LUCID DREAMING - Requires sleep context
    lucid_dreaming: {
        id: 'lucid_dreaming',
        name: 'Lucid Dreaming',
        aliases: ['Conscious dreaming', 'Dream awareness', 'Oneironaut state'],
        dominantBands: ['Theta', 'Gamma'],
        description: 'Awareness within the dream state. Theta base with characteristic frontal gamma bursts indicating metacognitive awareness.',
        gatingHint: 'Theta + bursty Gamma, LOW Alpha (requires sleep context)',
        color: '#ec4899',
        requiresSleepContext: true,
        awakeVariant: {
            name: 'Dreamlike Awareness',
            description: 'This pattern resembles lucid dreaming EEG signatures, but you are awake. This indicates dreamlike internal awareness with retained waking consciousness — sometimes called oneiric meta-awareness.',
        },
    },
    // LUCID-LIKE AWAKE STATE (shown when awake but lucid pattern detected)
    lucid_like_awake: {
        id: 'lucid_like_awake',
        name: 'Dreamlike Awareness',
        aliases: ['Lucid-like awareness', 'Oneiric meta-awareness', 'Waking dream state'],
        dominantBands: ['Theta', 'Gamma'],
        description: 'This pattern resembles lucid dreaming EEG signatures, but you are awake. This indicates dreamlike internal awareness with retained waking consciousness.',
        gatingHint: 'Theta + Gamma coupling with some Beta present (awake)',
        color: '#f472b6',
    },
    bliss_ecstatic: {
        id: 'bliss_ecstatic',
        name: 'Bliss / Ecstatic Unity',
        aliases: ['Devotional bliss', 'Rapture', 'Jhana', 'Ananda'],
        dominantBands: ['Alpha', 'Gamma'],
        description: 'Intense positive affect with feelings of love, joy, and unity. Alpha-gamma coupling creates sustained blissful absorption.',
        gatingHint: 'Alpha-Gamma coupling, strong positive emotion',
        color: '#f59e0b',
    },
    samadhi: {
        id: 'samadhi',
        name: 'Samadhi',
        aliases: ['Non-duality', 'Unitive consciousness', 'Absorption', 'Turiya'],
        dominantBands: ['Gamma'],
        description: 'Deep meditative absorption with high-amplitude coherent gamma. DMN suppression, subject-object boundary dissolution.',
        gatingHint: 'High-amplitude Gamma, suppressed DMN activity',
        color: '#fbbf24',
    },
    transcendent_meta: {
        id: 'transcendent_meta',
        name: 'Transcendent Meta-Awareness',
        aliases: ['Cosmic consciousness', '5D state', 'Witness consciousness', 'Pure awareness'],
        dominantBands: ['Gamma', 'Alpha', 'Theta'],
        description: 'Sustained global gamma coherence with preserved Alpha. Awareness of awareness itself, timeless presence, profound meaning.',
        gatingHint: 'Smooth Gamma + Alpha present, sustained coherence',
        color: '#ffffff',
    },
};

// Helper to get state info by ID
export function getStateInfo(id: string): StateInfo {
    return STATE_INFO[id] || STATE_INFO.ordinary_waking;
}

// Get appropriate state info considering sleep context
export function getContextualStateInfo(id: string, isSleepMode: boolean): StateInfo {
    const info = STATE_INFO[id];
    if (!info) return STATE_INFO.ordinary_waking;

    // If this state requires sleep context but user is awake, use awake variant
    if (info.requiresSleepContext && !isSleepMode) {
        // Return the lucid_like_awake state instead
        return STATE_INFO.lucid_like_awake;
    }

    return info;
}
