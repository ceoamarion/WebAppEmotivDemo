/**
 * Cinematic Neural Environment Types
 * Premium AAA sci-fi meditation UI visual system
 */

// ================================
// INPUT TYPES
// ================================

export interface NeuralInput {
    currentStateId: string;
    currentConfidence: number;
    challengerStateId: string | null;
    challengerConfidence: number | null;
    transitionStatus: 'stabilizing' | 'candidate' | 'confirmed' | 'locked' | 'transitioning';

    bandPowers: {
        theta: number;
        alpha: number;
        betaL: number;
        betaH: number;
        gamma: number;
    };

    emotionAxes: {
        valence: number;  // -1 to +1
        arousal: number;  // 0 to 1
        control: number;  // 0 to 1
    };

    isEmotionallyStable: boolean;
    tickMs: number;
}

// ================================
// CINEMATIC VISUAL STATE
// ================================

export interface CinematicVisualState {
    // === ORB CORE ===
    orbRadius: number;
    orbBreathPhase: number;          // For breathing animation
    coreGlowIntensity: number;       // 0-1
    coreHue: number;
    coreSaturation: number;
    coreLightness: number;

    // === ORB LAYERS ===
    shellNoiseSpeed: number;         // Mid shell shimmer
    shellNoiseIntensity: number;
    rimLightIntensity: number;       // Fresnel-like edge
    haloRotation: number;            // Ring rotation angle
    haloOpacity: number;

    // === COHERENCE / STABILITY ===
    coherenceLevel: number;          // 0 = turbulent, 1 = smooth/symmetrical
    turbulenceAmount: number;        // Inverse of coherence

    // === BLOOM ===
    bloomIntensity: number;
    bloomRadius: number;
    chromaticAberration: number;     // Edge color separation

    // === BACKGROUND FIELD ===
    nebulaHue: number;
    nebulaDriftX: number;
    nebulaDriftY: number;
    nebulaTurbulence: number;
    auroraIntensity: number;
    auroraPhase: number;
    starfieldSpeed: number;

    // === PARALLAX LAYERS ===
    parallaxOffset: { x: number; y: number };
    cameraDrift: { x: number; y: number };

    // === CINEMATIC POST ===
    vignetteIntensity: number;
    vignetteBreathing: number;
    filmGrain: number;
    lightWellIntensity: number;      // Spotlight behind orb

    // === REALM EFFECTS ===
    radialRaysEnabled: boolean;
    radialRaysIntensity: number;
    spiralParticlesEnabled: boolean;
    hazeIntensity: number;           // Dreamlike haze

    // === PALETTE ===
    palette: CinematicPalette;
    paletteBlend: number;            // 0-1 transition progress

    // === META ===
    cinematicIntensity: number;      // User preference 0-1
    reducedMotion: boolean;
    performanceMode: boolean;        // Auto-enabled if FPS drops
    tickMs: number;
}

export interface CinematicPalette {
    coreCenter: string;
    coreEdge: string;
    glow: string;
    rim: string;
    nebulaPrimary: string;
    nebulaSecondary: string;
    aurora: string;
    particles: string;
    background: string;
    accent: string;
}

// ================================
// STATE PALETTES
// ================================

export const CINEMATIC_PALETTES: Record<string, CinematicPalette> = {
    ordinary_waking: {
        coreCenter: 'hsl(210, 60%, 75%)',
        coreEdge: 'hsl(220, 70%, 35%)',
        glow: 'hsl(215, 80%, 50%)',
        rim: 'hsl(200, 90%, 70%)',
        nebulaPrimary: 'hsl(225, 60%, 15%)',
        nebulaSecondary: 'hsl(240, 50%, 8%)',
        aurora: 'hsl(200, 70%, 45%)',
        particles: 'hsl(210, 50%, 60%)',
        background: 'hsl(230, 30%, 4%)',
        accent: 'hsl(195, 80%, 55%)',
    },
    deep_relaxation: {
        coreCenter: 'hsl(170, 55%, 70%)',
        coreEdge: 'hsl(175, 65%, 30%)',
        glow: 'hsl(168, 75%, 40%)',
        rim: 'hsl(165, 85%, 60%)',
        nebulaPrimary: 'hsl(175, 55%, 12%)',
        nebulaSecondary: 'hsl(180, 45%, 6%)',
        aurora: 'hsl(160, 65%, 40%)',
        particles: 'hsl(170, 45%, 55%)',
        background: 'hsl(178, 35%, 3%)',
        accent: 'hsl(158, 75%, 50%)',
    },
    focused_concentration: {
        coreCenter: 'hsl(220, 65%, 75%)',
        coreEdge: 'hsl(230, 75%, 40%)',
        glow: 'hsl(225, 85%, 55%)',
        rim: 'hsl(210, 95%, 70%)',
        nebulaPrimary: 'hsl(230, 60%, 15%)',
        nebulaSecondary: 'hsl(245, 55%, 8%)',
        aurora: 'hsl(215, 75%, 50%)',
        particles: 'hsl(220, 55%, 65%)',
        background: 'hsl(235, 35%, 4%)',
        accent: 'hsl(205, 85%, 60%)',
    },
    creative_flow: {
        coreCenter: 'hsl(280, 55%, 75%)',
        coreEdge: 'hsl(270, 65%, 40%)',
        glow: 'hsl(275, 75%, 50%)',
        rim: 'hsl(290, 85%, 65%)',
        nebulaPrimary: 'hsl(275, 55%, 15%)',
        nebulaSecondary: 'hsl(265, 50%, 8%)',
        aurora: 'hsl(285, 65%, 45%)',
        particles: 'hsl(280, 50%, 60%)',
        background: 'hsl(270, 40%, 4%)',
        accent: 'hsl(295, 75%, 55%)',
    },
    dreamlike_awareness: {
        coreCenter: 'hsl(300, 45%, 70%)',
        coreEdge: 'hsl(290, 55%, 35%)',
        glow: 'hsl(295, 65%, 45%)',
        rim: 'hsl(310, 75%, 60%)',
        nebulaPrimary: 'hsl(295, 50%, 12%)',
        nebulaSecondary: 'hsl(285, 45%, 6%)',
        aurora: 'hsl(305, 55%, 40%)',
        particles: 'hsl(300, 45%, 55%)',
        background: 'hsl(290, 35%, 3%)',
        accent: 'hsl(315, 65%, 50%)',
    },
    lucid_dreaming: {
        coreCenter: 'hsl(310, 50%, 75%)',
        coreEdge: 'hsl(300, 60%, 40%)',
        glow: 'hsl(305, 70%, 50%)',
        rim: 'hsl(320, 80%, 65%)',
        nebulaPrimary: 'hsl(305, 55%, 14%)',
        nebulaSecondary: 'hsl(295, 50%, 7%)',
        aurora: 'hsl(315, 60%, 45%)',
        particles: 'hsl(310, 50%, 60%)',
        background: 'hsl(300, 40%, 4%)',
        accent: 'hsl(325, 70%, 55%)',
    },
    out_of_body: {
        coreCenter: 'hsl(250, 45%, 80%)',
        coreEdge: 'hsl(260, 55%, 45%)',
        glow: 'hsl(255, 65%, 55%)',
        rim: 'hsl(240, 75%, 75%)',
        nebulaPrimary: 'hsl(255, 50%, 15%)',
        nebulaSecondary: 'hsl(265, 45%, 8%)',
        aurora: 'hsl(245, 55%, 50%)',
        particles: 'hsl(250, 45%, 65%)',
        background: 'hsl(260, 35%, 4%)',
        accent: 'hsl(235, 70%, 60%)',
    },
    mystical_unity: {
        coreCenter: 'hsl(190, 55%, 75%)',
        coreEdge: 'hsl(195, 65%, 40%)',
        glow: 'hsl(192, 75%, 50%)',
        rim: 'hsl(185, 85%, 65%)',
        nebulaPrimary: 'hsl(195, 55%, 14%)',
        nebulaSecondary: 'hsl(200, 50%, 7%)',
        aurora: 'hsl(188, 65%, 45%)',
        particles: 'hsl(190, 50%, 60%)',
        background: 'hsl(198, 40%, 4%)',
        accent: 'hsl(182, 75%, 55%)',
    },
    bliss: {
        coreCenter: 'hsl(45, 75%, 80%)',
        coreEdge: 'hsl(35, 85%, 45%)',
        glow: 'hsl(40, 90%, 55%)',
        rim: 'hsl(50, 95%, 70%)',
        nebulaPrimary: 'hsl(35, 65%, 15%)',
        nebulaSecondary: 'hsl(25, 55%, 8%)',
        aurora: 'hsl(45, 75%, 50%)',
        particles: 'hsl(40, 65%, 65%)',
        background: 'hsl(30, 45%, 4%)',
        accent: 'hsl(55, 85%, 60%)',
    },
    transcendent: {
        coreCenter: 'hsl(45, 25%, 95%)',
        coreEdge: 'hsl(40, 35%, 70%)',
        glow: 'hsl(42, 45%, 80%)',
        rim: 'hsl(48, 55%, 90%)',
        nebulaPrimary: 'hsl(45, 20%, 18%)',
        nebulaSecondary: 'hsl(40, 15%, 10%)',
        aurora: 'hsl(50, 35%, 65%)',
        particles: 'hsl(45, 30%, 80%)',
        background: 'hsl(40, 20%, 5%)',
        accent: 'hsl(55, 45%, 75%)',
    },
    samadhi: {
        coreCenter: 'hsl(50, 20%, 98%)',
        coreEdge: 'hsl(45, 30%, 80%)',
        glow: 'hsl(48, 35%, 90%)',
        rim: 'hsl(52, 40%, 95%)',
        nebulaPrimary: 'hsl(48, 15%, 20%)',
        nebulaSecondary: 'hsl(45, 12%, 12%)',
        aurora: 'hsl(50, 25%, 70%)',
        particles: 'hsl(48, 22%, 85%)',
        background: 'hsl(45, 18%, 5%)',
        accent: 'hsl(55, 35%, 80%)',
    },
};

export const DEFAULT_CINEMATIC_PALETTE = CINEMATIC_PALETTES.ordinary_waking;

// ================================
// RATE LIMITING CONFIG
// ================================

export interface RateLimitConfig {
    hueMaxDeltaPerSec: number;        // degrees
    brightnessMaxDeltaPerSec: number; // 0-1
    bloomMaxDeltaPerSec: number;
    turbulenceMaxDeltaPerSec: number;
    driftMaxDeltaPerSec: number;
    paletteCrossfadeSec: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
    hueMaxDeltaPerSec: 0.02 * 360,      // 7.2 degrees/sec
    brightnessMaxDeltaPerSec: 0.08,
    bloomMaxDeltaPerSec: 0.10,
    turbulenceMaxDeltaPerSec: 0.06,
    driftMaxDeltaPerSec: 0.02,
    paletteCrossfadeSec: 3.5,
};

// ================================
// REALM CONFIGURATIONS
// ================================

export type RealmType = 'ordinary' | 'relaxed' | 'dreamlike' | 'transcendent' | 'active';

export interface RealmConfig {
    bloomMultiplier: number;
    vignetteMultiplier: number;
    turbulenceMultiplier: number;
    driftMultiplier: number;
    hazeAmount: number;
    radialRays: boolean;
    spiralParticles: boolean;
    colorSeparation: number;
}

export const REALM_CONFIGS: Record<RealmType, RealmConfig> = {
    ordinary: {
        bloomMultiplier: 1.0,
        vignetteMultiplier: 1.0,
        turbulenceMultiplier: 1.0,
        driftMultiplier: 1.0,
        hazeAmount: 0,
        radialRays: false,
        spiralParticles: false,
        colorSeparation: 0,
    },
    relaxed: {
        bloomMultiplier: 0.7,
        vignetteMultiplier: 1.4,
        turbulenceMultiplier: 0.5,
        driftMultiplier: 0.6,
        hazeAmount: 0,
        radialRays: false,
        spiralParticles: false,
        colorSeparation: 0,
    },
    dreamlike: {
        bloomMultiplier: 1.2,
        vignetteMultiplier: 1.2,
        turbulenceMultiplier: 0.7,
        driftMultiplier: 0.8,
        hazeAmount: 0.3,
        radialRays: false,
        spiralParticles: false,
        colorSeparation: 0.15,
    },
    transcendent: {
        bloomMultiplier: 1.5,
        vignetteMultiplier: 0.8,
        turbulenceMultiplier: 0.3,
        driftMultiplier: 0.4,
        hazeAmount: 0.1,
        radialRays: true,
        spiralParticles: true,
        colorSeparation: 0.05,
    },
    active: {
        bloomMultiplier: 1.1,
        vignetteMultiplier: 0.9,
        turbulenceMultiplier: 1.3,
        driftMultiplier: 1.4,
        hazeAmount: 0,
        radialRays: false,
        spiralParticles: false,
        colorSeparation: 0,
    },
};

// ================================
// UTILITIES
// ================================

export function getRealmType(stateId: string): RealmType {
    if (['transcendent', 'samadhi', 'bliss', 'mystical_unity'].includes(stateId)) {
        return 'transcendent';
    }
    if (['deep_relaxation'].includes(stateId)) {
        return 'relaxed';
    }
    if (['dreamlike_awareness', 'lucid_dreaming', 'out_of_body'].includes(stateId)) {
        return 'dreamlike';
    }
    if (['focused_concentration', 'creative_flow'].includes(stateId)) {
        return 'active';
    }
    return 'ordinary';
}
