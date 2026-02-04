/**
 * useCinematicVisuals Hook
 * 
 * Ultra-smooth visual state management for cinematic effects:
 * - 4Hz tick rate with 60fps interpolation
 * - Hard rate limiting on ALL visual parameters
 * - EMA smoothing for input values
 * - Palette crossfading over 3.5 seconds
 * - Performance mode auto-detection
 */

'use client';

import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import {
    NeuralInput,
    CinematicVisualState,
    CinematicPalette,
    RateLimitConfig,
    RealmConfig,
    CINEMATIC_PALETTES,
    DEFAULT_CINEMATIC_PALETTE,
    DEFAULT_RATE_LIMITS,
    REALM_CONFIGS,
    getRealmType,
} from './types';

// ================================
// UTILITIES
// ================================

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

function ema(current: number, target: number, alpha: number): number {
    return current + alpha * (target - current);
}

function rateLimited(current: number, target: number, maxDelta: number): number {
    const delta = target - current;
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
}

// Circular hue interpolation (shortest path)
function lerpHue(a: number, b: number, t: number): number {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (a + diff * t + 360) % 360;
}

// Parse HSL string
function parseHSL(hsl: string): { h: number; s: number; l: number } {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return { h: 0, s: 50, l: 50 };
    return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

// Interpolate palettes
function lerpPalette(a: CinematicPalette, b: CinematicPalette, t: number): CinematicPalette {
    const lerpColor = (c1: string, c2: string): string => {
        const h1 = parseHSL(c1);
        const h2 = parseHSL(c2);
        const h = lerpHue(h1.h, h2.h, t);
        const s = lerp(h1.s, h2.s, t);
        const l = lerp(h1.l, h2.l, t);
        return `hsl(${h}, ${s}%, ${l}%)`;
    };

    return {
        coreCenter: lerpColor(a.coreCenter, b.coreCenter),
        coreEdge: lerpColor(a.coreEdge, b.coreEdge),
        glow: lerpColor(a.glow, b.glow),
        rim: lerpColor(a.rim, b.rim),
        nebulaPrimary: lerpColor(a.nebulaPrimary, b.nebulaPrimary),
        nebulaSecondary: lerpColor(a.nebulaSecondary, b.nebulaSecondary),
        aurora: lerpColor(a.aurora, b.aurora),
        particles: lerpColor(a.particles, b.particles),
        background: lerpColor(a.background, b.background),
        accent: lerpColor(a.accent, b.accent),
    };
}

// ================================
// INTERNAL STATE
// ================================

interface InternalState {
    // Smoothed input values
    arousal: number;
    control: number;
    valence: number;
    theta: number;
    alpha: number;
    betaL: number;
    betaH: number;
    gamma: number;
    confidence: number;
    stability: number;

    // Visual parameters
    orbRadius: number;
    orbBreathPhase: number;
    coreGlowIntensity: number;
    coreHue: number;
    coreSaturation: number;
    coreLightness: number;
    shellNoiseSpeed: number;
    shellNoiseIntensity: number;
    rimLightIntensity: number;
    haloRotation: number;
    haloOpacity: number;
    coherenceLevel: number;
    turbulenceAmount: number;
    bloomIntensity: number;
    bloomRadius: number;
    chromaticAberration: number;
    nebulaHue: number;
    nebulaDriftX: number;
    nebulaDriftY: number;
    nebulaTurbulence: number;
    auroraIntensity: number;
    auroraPhase: number;
    starfieldSpeed: number;
    parallaxX: number;
    parallaxY: number;
    cameraDriftX: number;
    cameraDriftY: number;
    vignetteIntensity: number;
    vignetteBreathing: number;
    filmGrain: number;
    lightWellIntensity: number;
    radialRaysIntensity: number;
    hazeIntensity: number;

    // Palette state
    prevPalette: CinematicPalette;
    targetPalette: CinematicPalette;
    paletteTransitionStart: number;
    prevStateId: string;
    prevRealmType: string;
    realmTransitionStart: number;

    // Timing
    lastTickMs: number;
    lastUpdateMs: number;
}

function createInitialState(): InternalState {
    return {
        arousal: 0.5,
        control: 0.5,
        valence: 0,
        theta: 0.2,
        alpha: 0.3,
        betaL: 0.2,
        betaH: 0.15,
        gamma: 0.15,
        confidence: 50,
        stability: 0.5,

        orbRadius: 55,
        orbBreathPhase: 0,
        coreGlowIntensity: 0.5,
        coreHue: 210,
        coreSaturation: 60,
        coreLightness: 55,
        shellNoiseSpeed: 0.3,
        shellNoiseIntensity: 0.4,
        rimLightIntensity: 0.5,
        haloRotation: 0,
        haloOpacity: 0.4,
        coherenceLevel: 0.5,
        turbulenceAmount: 0.3,
        bloomIntensity: 0.4,
        bloomRadius: 1.5,
        chromaticAberration: 0,
        nebulaHue: 220,
        nebulaDriftX: 0,
        nebulaDriftY: -0.02,
        nebulaTurbulence: 0.3,
        auroraIntensity: 0.3,
        auroraPhase: 0,
        starfieldSpeed: 0.1,
        parallaxX: 0,
        parallaxY: 0,
        cameraDriftX: 0,
        cameraDriftY: 0,
        vignetteIntensity: 0.5,
        vignetteBreathing: 0,
        filmGrain: 0.03,
        lightWellIntensity: 0.4,
        radialRaysIntensity: 0,
        hazeIntensity: 0,

        prevPalette: DEFAULT_CINEMATIC_PALETTE,
        targetPalette: DEFAULT_CINEMATIC_PALETTE,
        paletteTransitionStart: 0,
        prevStateId: 'ordinary_waking',
        prevRealmType: 'ordinary',
        realmTransitionStart: 0,
        lastTickMs: Date.now(),
        lastUpdateMs: Date.now(),
    };
}

// ================================
// HOOK OPTIONS
// ================================

export interface UseCinematicVisualsOptions {
    cinematicIntensity?: number;  // 0-1, default 0.55
    reducedMotion?: boolean;
    rateLimits?: Partial<RateLimitConfig>;
}

// ================================
// MAIN HOOK
// ================================

export function useCinematicVisuals(
    input: NeuralInput,
    options: UseCinematicVisualsOptions = {}
): CinematicVisualState {
    const {
        cinematicIntensity = 0.55,
        reducedMotion = false,
        rateLimits = {},
    } = options;

    const limits = useMemo(() => ({
        ...DEFAULT_RATE_LIMITS,
        ...rateLimits,
    }), [rateLimits]);

    const stateRef = useRef<InternalState>(createInitialState());
    const [performanceMode, setPerformanceMode] = useState(false);
    const fpsHistoryRef = useRef<number[]>([]);

    // Performance monitoring
    useEffect(() => {
        let frameCount = 0;
        let lastCheck = Date.now();

        const checkFPS = () => {
            frameCount++;
            const now = Date.now();
            if (now - lastCheck >= 1000) {
                const fps = frameCount;
                frameCount = 0;
                lastCheck = now;

                fpsHistoryRef.current.push(fps);
                if (fpsHistoryRef.current.length > 3) {
                    fpsHistoryRef.current.shift();
                }

                // Check for sustained low FPS
                if (fpsHistoryRef.current.length >= 3) {
                    const avg = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / 3;
                    if (avg < 45 && !performanceMode) {
                        setPerformanceMode(true);
                    } else if (avg > 55 && performanceMode) {
                        setPerformanceMode(false);
                    }
                }
            }
        };

        const interval = setInterval(checkFPS, 16);
        return () => clearInterval(interval);
    }, [performanceMode]);

    // Compute visual state (called at ~4Hz via memo deps)
    const visualState = useMemo(() => {
        const s = stateRef.current;
        const now = input.tickMs || Date.now();
        const dt = Math.min(0.3, (now - s.lastTickMs) / 1000);
        s.lastTickMs = now;

        const motionScale = reducedMotion ? 0.3 : 1.0;
        const intensityScale = performanceMode ? cinematicIntensity * 0.75 : cinematicIntensity;

        // === SMOOTH INPUT VALUES ===
        const emaAlpha = 0.08; // Very slow for smoothness
        s.arousal = ema(s.arousal, input.emotionAxes.arousal, emaAlpha);
        s.control = ema(s.control, input.emotionAxes.control, emaAlpha);
        s.valence = ema(s.valence, input.emotionAxes.valence, emaAlpha);
        s.theta = ema(s.theta, input.bandPowers.theta, emaAlpha);
        s.alpha = ema(s.alpha, input.bandPowers.alpha, emaAlpha);
        s.betaL = ema(s.betaL, input.bandPowers.betaL, emaAlpha);
        s.betaH = ema(s.betaH, input.bandPowers.betaH, emaAlpha);
        s.gamma = ema(s.gamma, input.bandPowers.gamma, emaAlpha);
        s.confidence = ema(s.confidence, input.currentConfidence, emaAlpha);
        s.stability = ema(s.stability, input.isEmotionallyStable ? 1 : 0, emaAlpha * 0.5);

        // === PALETTE CROSSFADE ===
        if (input.currentStateId !== s.prevStateId) {
            s.prevPalette = lerpPalette(s.prevPalette, s.targetPalette,
                clamp((now - s.paletteTransitionStart) / (limits.paletteCrossfadeSec * 1000), 0, 1));
            s.targetPalette = CINEMATIC_PALETTES[input.currentStateId] || DEFAULT_CINEMATIC_PALETTE;
            s.paletteTransitionStart = now;
            s.prevStateId = input.currentStateId;
        }

        const paletteProgress = clamp((now - s.paletteTransitionStart) / (limits.paletteCrossfadeSec * 1000), 0, 1);
        const currentPalette = lerpPalette(s.prevPalette, s.targetPalette, paletteProgress);

        // === REALM CONFIGURATION ===
        const realmType = getRealmType(input.currentStateId);
        const realm = REALM_CONFIGS[realmType];

        // === ORB CALCULATIONS ===

        // Breathing phase (continuous)
        const breathSpeed = 0.3 + (s.alpha + s.theta) * 0.4 * motionScale;
        s.orbBreathPhase += dt * breathSpeed;

        // Radius with breathing
        const targetRadius = 50 + (s.alpha + s.theta) * 20 + s.confidence * 0.08;
        s.orbRadius = ema(s.orbRadius, targetRadius, emaAlpha);

        // Core glow from arousal + control moderation
        const rawGlow = s.arousal * 0.6 + (1 - s.control) * 0.25 + 0.15;
        const targetGlow = clamp(rawGlow * realm.bloomMultiplier, 0.2, 0.95);
        s.coreGlowIntensity = rateLimited(s.coreGlowIntensity, targetGlow, limits.brightnessMaxDeltaPerSec * dt);

        // Core color from palette + valence shift
        const coreColorHSL = parseHSL(currentPalette.coreCenter);
        const targetHue = coreColorHSL.h + s.valence * 15; // ±15 degrees
        s.coreHue = rateLimited(s.coreHue, targetHue, limits.hueMaxDeltaPerSec * dt);
        s.coreSaturation = ema(s.coreSaturation, coreColorHSL.s, emaAlpha);
        s.coreLightness = ema(s.coreLightness, coreColorHSL.l, emaAlpha);

        // Shell shimmer from betaH + gamma
        const targetNoiseSpeed = 0.1 + (s.betaH + s.gamma) * 0.35 * motionScale;
        s.shellNoiseSpeed = ema(s.shellNoiseSpeed, targetNoiseSpeed, emaAlpha);
        s.shellNoiseIntensity = ema(s.shellNoiseIntensity, 0.3 + s.gamma * 0.4, emaAlpha);

        // Rim light (Fresnel)
        s.rimLightIntensity = ema(s.rimLightIntensity, 0.4 + s.confidence * 0.004 + s.stability * 0.2, emaAlpha);

        // Halo rotation
        s.haloRotation += dt * (0.1 + (s.gamma + s.betaH) * 0.15) * motionScale;
        s.haloOpacity = ema(s.haloOpacity, 0.3 + s.confidence * 0.003, emaAlpha);

        // Coherence
        const targetCoherence = s.stability * 0.5 + (input.transitionStatus === 'locked' ? 0.3 : 0) + s.confidence * 0.002;
        s.coherenceLevel = ema(s.coherenceLevel, clamp(targetCoherence, 0, 1), emaAlpha * 0.5);
        s.turbulenceAmount = rateLimited(
            s.turbulenceAmount,
            (1 - s.coherenceLevel) * realm.turbulenceMultiplier,
            limits.turbulenceMaxDeltaPerSec * dt
        );

        // === BLOOM ===
        const targetBloom = (0.3 + s.coreGlowIntensity * 0.5) * realm.bloomMultiplier * intensityScale;
        s.bloomIntensity = rateLimited(s.bloomIntensity, clamp(targetBloom, 0.1, 0.9), limits.bloomMaxDeltaPerSec * dt);
        s.bloomRadius = ema(s.bloomRadius, 1.2 + s.bloomIntensity * 0.8, emaAlpha);
        s.chromaticAberration = ema(s.chromaticAberration, realm.colorSeparation * intensityScale, emaAlpha);

        // === BACKGROUND ===

        // Nebula
        const nebulaHSL = parseHSL(currentPalette.nebulaPrimary);
        s.nebulaHue = rateLimited(s.nebulaHue, nebulaHSL.h + s.valence * 10, limits.hueMaxDeltaPerSec * dt);

        const targetDriftX = s.arousal * 0.015 * realm.driftMultiplier * motionScale;
        const targetDriftY = -0.02 - s.arousal * 0.01 * realm.driftMultiplier * motionScale;
        s.nebulaDriftX = rateLimited(s.nebulaDriftX, targetDriftX, limits.driftMaxDeltaPerSec * dt);
        s.nebulaDriftY = rateLimited(s.nebulaDriftY, targetDriftY, limits.driftMaxDeltaPerSec * dt);

        const targetNebulaTurbulence = (0.2 + (1 - s.control) * 0.3) * realm.turbulenceMultiplier;
        s.nebulaTurbulence = rateLimited(s.nebulaTurbulence, targetNebulaTurbulence, limits.turbulenceMaxDeltaPerSec * dt);

        // Aurora
        s.auroraPhase += dt * 0.15 * motionScale;
        s.auroraIntensity = ema(s.auroraIntensity, 0.2 + s.alpha * 0.3, emaAlpha);

        // Starfield
        s.starfieldSpeed = ema(s.starfieldSpeed, 0.05 + s.arousal * 0.1, emaAlpha);

        // === CAMERA SIMULATION ===

        // Parallax (slow wave)
        const parallaxTime = now * 0.0001 * motionScale;
        const targetParallaxX = Math.sin(parallaxTime) * 0.01 * intensityScale;
        const targetParallaxY = Math.cos(parallaxTime * 1.3) * 0.008 * intensityScale;
        s.parallaxX = ema(s.parallaxX, targetParallaxX, emaAlpha * 0.5);
        s.parallaxY = ema(s.parallaxY, targetParallaxY, emaAlpha * 0.5);

        // Camera drift (very subtle)
        const driftTime = now * 0.00005 * motionScale;
        s.cameraDriftX = ema(s.cameraDriftX, Math.sin(driftTime * 1.7) * 2 * intensityScale, emaAlpha * 0.3);
        s.cameraDriftY = ema(s.cameraDriftY, Math.cos(driftTime * 1.3) * 1.5 * intensityScale, emaAlpha * 0.3);

        // === POST EFFECTS ===

        // Vignette
        const targetVignette = (0.4 + (1 - s.alpha) * 0.2) * realm.vignetteMultiplier;
        s.vignetteIntensity = ema(s.vignetteIntensity, clamp(targetVignette, 0.2, 0.8), emaAlpha);
        s.vignetteBreathing = s.alpha * 0.15;

        // Film grain (very subtle)
        s.filmGrain = 0.02 + intensityScale * 0.03;

        // Light well behind orb
        s.lightWellIntensity = ema(s.lightWellIntensity, 0.3 + s.coreGlowIntensity * 0.3, emaAlpha);

        // === REALM EFFECTS ===

        // Radial rays (transcendent states)
        const targetRays = realm.radialRays && input.transitionStatus === 'locked' ? 0.5 + s.confidence * 0.003 : 0;
        s.radialRaysIntensity = ema(s.radialRaysIntensity, targetRays * intensityScale, emaAlpha * 0.3);

        // Haze (dreamlike)
        s.hazeIntensity = ema(s.hazeIntensity, realm.hazeAmount * intensityScale, emaAlpha * 0.5);

        // Build output
        const visualState: CinematicVisualState = {
            orbRadius: s.orbRadius,
            orbBreathPhase: s.orbBreathPhase,
            coreGlowIntensity: s.coreGlowIntensity,
            coreHue: s.coreHue,
            coreSaturation: s.coreSaturation,
            coreLightness: s.coreLightness,
            shellNoiseSpeed: s.shellNoiseSpeed,
            shellNoiseIntensity: s.shellNoiseIntensity,
            rimLightIntensity: s.rimLightIntensity,
            haloRotation: s.haloRotation,
            haloOpacity: s.haloOpacity,
            coherenceLevel: s.coherenceLevel,
            turbulenceAmount: s.turbulenceAmount,
            bloomIntensity: s.bloomIntensity,
            bloomRadius: s.bloomRadius,
            chromaticAberration: s.chromaticAberration,
            nebulaHue: s.nebulaHue,
            nebulaDriftX: s.nebulaDriftX,
            nebulaDriftY: s.nebulaDriftY,
            nebulaTurbulence: s.nebulaTurbulence,
            auroraIntensity: s.auroraIntensity,
            auroraPhase: s.auroraPhase,
            starfieldSpeed: s.starfieldSpeed,
            parallaxOffset: { x: s.parallaxX, y: s.parallaxY },
            cameraDrift: { x: s.cameraDriftX, y: s.cameraDriftY },
            vignetteIntensity: s.vignetteIntensity,
            vignetteBreathing: s.vignetteBreathing,
            filmGrain: s.filmGrain,
            lightWellIntensity: s.lightWellIntensity,
            radialRaysEnabled: s.radialRaysIntensity > 0.05,
            radialRaysIntensity: s.radialRaysIntensity,
            spiralParticlesEnabled: realm.spiralParticles && s.radialRaysIntensity > 0.1,
            hazeIntensity: s.hazeIntensity,
            palette: currentPalette,
            paletteBlend: paletteProgress,
            cinematicIntensity: intensityScale,
            reducedMotion,
            performanceMode,
            tickMs: now,
        };

        return visualState;
    }, [input, cinematicIntensity, reducedMotion, performanceMode, limits]);

    return visualState;
}

// ================================
// INTENSITY PERSISTENCE
// ================================

const INTENSITY_KEY = 'cinematic-intensity';

export function loadCinematicIntensity(): number {
    if (typeof localStorage === 'undefined') return 0.55;
    const stored = localStorage.getItem(INTENSITY_KEY);
    if (!stored) return 0.55;
    const val = parseFloat(stored);
    return isNaN(val) ? 0.55 : clamp(val, 0, 1);
}

export function saveCinematicIntensity(value: number): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(INTENSITY_KEY, String(clamp(value, 0, 1)));
}

export function useReducedMotionPreference(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return reduced;
}
