/**
 * OrbCanvas - Cinematic Multi-Layer Orb
 * 
 * Premium AAA visualization with:
 * A) Core glow (soft radial gradient)
 * B) Mid shell (animated noise shimmer)
 * C) Rim light (Fresnel-like edge highlight)
 * D) Halo rings (slow, elegant)
 * E) Bloom buffer (soft glow with chromatic aberration)
 * F) Coherence visualization
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { CinematicVisualState } from './types';

interface OrbCanvasProps {
    visualState: CinematicVisualState;
    width: number;
    height: number;
}

// ================================
// NOISE FUNCTIONS
// ================================

function simplex2D(x: number, y: number): number {
    // Approximate simplex noise using sin combinations
    return (
        Math.sin(x * 1.2 + y * 0.8) * 0.25 +
        Math.sin(x * 2.4 - y * 1.6) * 0.15 +
        Math.sin(x * 0.6 + y * 2.2) * 0.20 +
        Math.sin(x * 3.1 + y * 0.3) * 0.10 +
        Math.sin(x * 0.4 - y * 3.0) * 0.30
    );
}

function turbulence(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += Math.abs(simplex2D(x * frequency, y * frequency)) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

// ================================
// COMPONENT
// ================================

const OrbCanvas: React.FC<OrbCanvasProps> = ({ visualState, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bloomCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number>(0);
    const timeRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(Date.now());

    // Create offscreen bloom buffer
    useEffect(() => {
        bloomCanvasRef.current = document.createElement('canvas');
        bloomCanvasRef.current.width = Math.floor(width / 2);
        bloomCanvasRef.current.height = Math.floor(height / 2);
    }, [width, height]);

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const bloomCanvas = bloomCanvasRef.current;
        if (!canvas || !bloomCanvas) return;

        const ctx = canvas.getContext('2d');
        const bloomCtx = bloomCanvas.getContext('2d');
        if (!ctx || !bloomCtx) return;

        const now = Date.now();
        const dt = Math.min(50, now - lastFrameRef.current) / 1000;
        lastFrameRef.current = now;
        timeRef.current += dt * 1000;

        const time = timeRef.current;
        const cx = width / 2 + visualState.cameraDrift.x;
        const cy = height / 2 + visualState.cameraDrift.y;

        const {
            orbRadius,
            orbBreathPhase,
            coreGlowIntensity,
            coreHue,
            coreSaturation,
            coreLightness,
            shellNoiseSpeed,
            shellNoiseIntensity,
            rimLightIntensity,
            haloRotation,
            haloOpacity,
            coherenceLevel,
            turbulenceAmount,
            bloomIntensity,
            bloomRadius,
            chromaticAberration,
            palette,
            reducedMotion,
            performanceMode,
        } = visualState;

        const motionScale = reducedMotion ? 0.3 : 1.0;

        // Clear main canvas
        ctx.clearRect(0, 0, width, height);

        // === BREATHING ANIMATION ===
        const breathAmount = Math.sin(orbBreathPhase) * 0.06;
        const currentRadius = orbRadius * (1 + breathAmount);

        // === LIGHT WELL (BEHIND ORB) ===
        const lightWellRadius = currentRadius * 3;
        const lightWellGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, lightWellRadius);
        lightWellGradient.addColorStop(0, `hsla(${coreHue}, ${coreSaturation * 0.5}%, ${coreLightness + 20}%, ${visualState.lightWellIntensity * 0.3})`);
        lightWellGradient.addColorStop(0.4, `hsla(${coreHue}, ${coreSaturation * 0.3}%, ${coreLightness}%, ${visualState.lightWellIntensity * 0.15})`);
        lightWellGradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(cx, cy, lightWellRadius, 0, Math.PI * 2);
        ctx.fillStyle = lightWellGradient;
        ctx.fill();

        // === RADIAL RAYS (TRANSCENDENT STATES) ===
        if (visualState.radialRaysEnabled && !performanceMode) {
            drawRadialRays(ctx, cx, cy, currentRadius, time, visualState, motionScale);
        }

        // === HALO RINGS ===
        if (!performanceMode) {
            drawHaloRings(ctx, cx, cy, currentRadius, haloRotation, haloOpacity, palette, coherenceLevel, motionScale);
        }

        // === OUTER GLOW LAYERS ===
        const glowLayers = performanceMode ? 3 : 5;
        for (let i = glowLayers; i > 0; i--) {
            const layerRadius = currentRadius * (1 + i * 0.3 * bloomRadius);
            const alpha = (coreGlowIntensity * 0.12) / i;

            const gradient = ctx.createRadialGradient(cx, cy, currentRadius * 0.5, cx, cy, layerRadius);
            gradient.addColorStop(0, `hsla(${coreHue}, ${coreSaturation}%, ${coreLightness + 15}%, ${alpha})`);
            gradient.addColorStop(0.5, `hsla(${coreHue + 5}, ${coreSaturation - 10}%, ${coreLightness}%, ${alpha * 0.6})`);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(cx, cy, layerRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // === CHROMATIC ABERRATION ON BLOOM ===
        if (chromaticAberration > 0.01 && !performanceMode) {
            drawChromaticAberration(ctx, cx, cy, currentRadius, coreHue, chromaticAberration, coreGlowIntensity);
        }

        // === MID SHELL (NOISE SHIMMER) ===
        if (!performanceMode) {
            drawShellShimmer(ctx, cx, cy, currentRadius, time, shellNoiseSpeed, shellNoiseIntensity, coreHue, coreSaturation, turbulenceAmount, coherenceLevel, motionScale);
        }

        // === ORB CORE ===
        drawOrbCore(ctx, cx, cy, currentRadius, coreHue, coreSaturation, coreLightness, coreGlowIntensity, coherenceLevel);

        // === RIM LIGHT (FRESNEL) ===
        drawRimLight(ctx, cx, cy, currentRadius, coreHue, rimLightIntensity, palette);

        // === INNER HIGHLIGHT ===
        drawInnerHighlight(ctx, cx, cy, currentRadius, coreHue, coreGlowIntensity);

        // === SPIRAL PARTICLES (TRANSCENDENT) ===
        if (visualState.spiralParticlesEnabled && !performanceMode) {
            drawSpiralParticles(ctx, cx, cy, currentRadius, time, palette, visualState.radialRaysIntensity, motionScale);
        }

        animationRef.current = requestAnimationFrame(animate);
    }, [visualState, width, height]);

    useEffect(() => {
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [animate]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                pointerEvents: 'none',
            }}
        />
    );
};

// ================================
// DRAWING FUNCTIONS
// ================================

function drawOrbCore(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    hue: number, saturation: number, lightness: number,
    glowIntensity: number, coherence: number
) {
    // Multi-stop gradient for depth
    const gradient = ctx.createRadialGradient(
        cx - radius * 0.15,
        cy - radius * 0.15,
        0,
        cx,
        cy,
        radius
    );

    // More coherent = smoother gradient stops
    const stops = coherence > 0.6 ? 4 : 3;

    gradient.addColorStop(0, `hsla(${hue}, ${saturation - 15}%, ${lightness + 30}%, 1)`);
    gradient.addColorStop(0.3, `hsla(${hue}, ${saturation}%, ${lightness + 15}%, 0.98)`);
    gradient.addColorStop(0.6, `hsla(${hue + 5}, ${saturation + 5}%, ${lightness}%, 0.95)`);
    gradient.addColorStop(1, `hsla(${hue + 10}, ${saturation - 10}%, ${lightness - 20}%, 0.8)`);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawRimLight(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    hue: number, intensity: number,
    palette: CinematicVisualState['palette']
) {
    // Fresnel-like edge glow
    const rimGradient = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.05);
    rimGradient.addColorStop(0, 'transparent');
    rimGradient.addColorStop(0.7, `hsla(${hue - 10}, 80%, 75%, ${intensity * 0.3})`);
    rimGradient.addColorStop(1, palette.rim);

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = rimGradient;
    ctx.fill();
}

function drawInnerHighlight(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    hue: number, glowIntensity: number
) {
    const highlightRadius = radius * 0.35;
    const offsetX = -radius * 0.3;
    const offsetY = -radius * 0.3;

    const gradient = ctx.createRadialGradient(
        cx + offsetX, cy + offsetY, 0,
        cx + offsetX, cy + offsetY, highlightRadius
    );

    gradient.addColorStop(0, `hsla(${hue}, 20%, 98%, ${0.4 + glowIntensity * 0.2})`);
    gradient.addColorStop(0.4, `hsla(${hue}, 30%, 90%, ${0.2 + glowIntensity * 0.1})`);
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(cx + offsetX, cy + offsetY, highlightRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawShellShimmer(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    time: number, noiseSpeed: number, noiseIntensity: number,
    hue: number, saturation: number, turbulenceAmt: number, coherence: number, motionScale: number
) {
    const t = time * noiseSpeed * 0.001 * motionScale;
    const segments = 48;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const noise = turbulence(Math.cos(angle) * 2 + t, Math.sin(angle) * 2 + t * 0.7, 2);

        // Coherence reduces noise variance
        const variance = noise * noiseIntensity * (1 - coherence * 0.5);
        const r = radius * (0.92 + variance * 0.15);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        const size = 1.5 + noise * 2;
        const alpha = 0.15 + variance * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue + noise * 20}, ${saturation}%, 75%, ${alpha})`;
        ctx.fill();
    }

    ctx.restore();
}

function drawHaloRings(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    rotation: number, opacity: number,
    palette: CinematicVisualState['palette'],
    coherence: number, motionScale: number
) {
    const ringCount = 2;

    for (let ring = 0; ring < ringCount; ring++) {
        const ringRadius = radius * (1.4 + ring * 0.25);
        const ringRotation = rotation * (ring === 0 ? 1 : -0.6);
        const segments = coherence > 0.5 ? 4 : 3;
        const segmentArc = Math.PI * (0.3 + coherence * 0.15);
        const gap = (Math.PI * 2 - segmentArc * segments) / segments;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ringRotation);

        ctx.lineWidth = 2 + coherence * 2;
        ctx.lineCap = 'round';

        for (let s = 0; s < segments; s++) {
            const startAngle = s * (segmentArc + gap);
            const endAngle = startAngle + segmentArc;

            const gradient = ctx.createLinearGradient(
                Math.cos(startAngle) * ringRadius,
                Math.sin(startAngle) * ringRadius,
                Math.cos(endAngle) * ringRadius,
                Math.sin(endAngle) * ringRadius
            );

            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.3, palette.accent);
            gradient.addColorStop(0.7, palette.glow);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(0, 0, ringRadius, startAngle, endAngle);
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = opacity * (1 - ring * 0.3);
            ctx.stroke();
        }

        ctx.restore();
    }

    ctx.globalAlpha = 1;
}

function drawRadialRays(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    time: number, visualState: CinematicVisualState, motionScale: number
) {
    const rayCount = 16;
    const intensity = visualState.radialRaysIntensity;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.00002 * motionScale);

    for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const pulse = Math.sin(time * 0.0005 * motionScale + i * 0.4) * 0.3 + 0.7;
        const length = radius * (2 + pulse * 1.5);
        const alpha = intensity * 0.08 * pulse;

        const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
        gradient.addColorStop(0, `hsla(${visualState.coreHue}, 50%, 80%, ${alpha})`);
        gradient.addColorStop(0.3, `hsla(${visualState.coreHue + 10}, 40%, 70%, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 + pulse * 2;
        ctx.stroke();
    }

    ctx.restore();
}

function drawChromaticAberration(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    hue: number, amount: number, glow: number
) {
    const offset = amount * 8;
    const glowRadius = radius * 1.8;

    // Red channel offset
    ctx.beginPath();
    ctx.arc(cx - offset, cy, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue + 30}, 80%, 60%, ${glow * 0.08})`;
    ctx.fill();

    // Blue channel offset
    ctx.beginPath();
    ctx.arc(cx + offset, cy, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue - 30}, 80%, 60%, ${glow * 0.08})`;
    ctx.fill();
}

function drawSpiralParticles(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    time: number, palette: CinematicVisualState['palette'],
    intensity: number, motionScale: number
) {
    const particleCount = 20;
    const t = time * 0.0002 * motionScale;

    for (let i = 0; i < particleCount; i++) {
        const progress = ((t + i / particleCount) % 1);
        const spiralRadius = radius * (3 - progress * 2.5);
        const angle = progress * Math.PI * 6 + i * 0.3;

        const x = cx + Math.cos(angle) * spiralRadius;
        const y = cy + Math.sin(angle) * spiralRadius;
        const size = 1.5 + (1 - progress) * 2;
        const alpha = (1 - progress) * intensity * 0.5;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${parseInt(palette.accent.match(/\d+/)?.[0] || '50')}, 70%, 80%, ${alpha})`;
        ctx.fill();
    }
}

export default OrbCanvas;
