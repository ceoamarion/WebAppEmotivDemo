/**
 * FieldCanvas - Cinematic Nebula Background
 * 
 * Premium AAA deep-space visualization with:
 * - 3-layer parallax starfield
 * - Volumetric nebula haze (procedural)
 * - Aurora ribbon flow
 * - Breathing vignette
 * - Film grain overlay
 * - Dreamlike haze effects
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { CinematicVisualState } from './types';

interface FieldCanvasProps {
    visualState: CinematicVisualState;
    width: number;
    height: number;
}

interface Star {
    x: number;
    y: number;
    z: number; // Parallax layer (0=far, 1=near)
    size: number;
    brightness: number;
    twinklePhase: number;
    twinkleSpeed: number;
}

interface NebulaPoint {
    x: number;
    y: number;
    size: number;
    hueOffset: number;
    opacity: number;
}

// ================================
// NOISE UTILITIES
// ================================

function fbmNoise(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += Math.sin(x * frequency + y * frequency * 0.7) * amplitude;
        value += Math.cos(x * frequency * 0.8 - y * frequency) * amplitude * 0.5;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return (value / maxValue + 1) * 0.5;
}

function flowField(x: number, y: number, time: number, turbulence: number): { dx: number; dy: number } {
    const scale = 0.002;
    const t = time * 0.0001;

    const angle =
        Math.sin(x * scale + t) * 2 +
        Math.sin(y * scale * 0.8 + t * 1.2) * 1.5 +
        Math.sin((x + y) * scale * 0.5 + t * 0.8) * turbulence * 2;

    const strength = 0.2 + turbulence * 0.4;

    return {
        dx: Math.cos(angle) * strength,
        dy: Math.sin(angle) * strength,
    };
}

// ================================
// COMPONENT
// ================================

const FieldCanvas: React.FC<FieldCanvasProps> = ({ visualState, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const starsRef = useRef<Star[]>([]);
    const nebulaRef = useRef<NebulaPoint[]>([]);
    const animationRef = useRef<number>(0);
    const timeRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(Date.now());

    // Initialize stars and nebula points
    useEffect(() => {
        // Stars: 3 parallax layers
        const starCount = Math.floor((width * height) / 3000);
        const stars: Star[] = [];

        for (let i = 0; i < starCount; i++) {
            const z = i / starCount; // Distribute across layers
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z,
                size: 0.5 + z * 1.5,
                brightness: 0.3 + Math.random() * 0.7,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.5 + Math.random() * 1.5,
            });
        }
        starsRef.current = stars;

        // Nebula points for haze
        const nebulaCount = Math.floor((width * height) / 8000);
        const nebula: NebulaPoint[] = [];

        for (let i = 0; i < nebulaCount; i++) {
            nebula.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: 30 + Math.random() * 80,
                hueOffset: (Math.random() - 0.5) * 40,
                opacity: 0.02 + Math.random() * 0.04,
            });
        }
        nebulaRef.current = nebula;
    }, [width, height]);

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const now = Date.now();
        const dt = Math.min(50, now - lastFrameRef.current) / 1000;
        lastFrameRef.current = now;
        timeRef.current += dt * 1000;

        const time = timeRef.current;

        const {
            nebulaHue,
            nebulaDriftX,
            nebulaDriftY,
            nebulaTurbulence,
            auroraIntensity,
            auroraPhase,
            starfieldSpeed,
            parallaxOffset,
            cameraDrift,
            vignetteIntensity,
            vignetteBreathing,
            filmGrain,
            hazeIntensity,
            palette,
            reducedMotion,
            performanceMode,
            cinematicIntensity,
        } = visualState;

        const motionScale = reducedMotion ? 0.3 : 1.0;

        // === CLEAR WITH DEEP BACKGROUND ===
        ctx.fillStyle = palette.background;
        ctx.fillRect(0, 0, width, height);

        // === NEBULA HAZE LAYER ===
        if (!performanceMode) {
            drawNebulaHaze(ctx, width, height, time, nebulaRef.current, nebulaHue, nebulaTurbulence, palette, motionScale);
        }

        // === AURORA RIBBONS ===
        if (auroraIntensity > 0.1 && !performanceMode) {
            drawAuroraRibbons(ctx, width, height, time, auroraIntensity, auroraPhase, palette, motionScale);
        }

        // === PARALLAX STARFIELD ===
        drawStarfield(ctx, width, height, time, starsRef.current, {
            driftX: nebulaDriftX,
            driftY: nebulaDriftY,
            speed: starfieldSpeed,
            parallaxOffset,
            cameraDrift,
            palette,
            motionScale,
            performanceMode,
        });

        // === DREAMLIKE HAZE ===
        if (hazeIntensity > 0.05) {
            drawDreamlikeHaze(ctx, width, height, hazeIntensity, palette);
        }

        // === BREATHING VIGNETTE ===
        drawVignette(ctx, width, height, time, vignetteIntensity, vignetteBreathing, motionScale);

        // === FILM GRAIN ===
        if (filmGrain > 0.01 && !performanceMode) {
            drawFilmGrain(ctx, width, height, filmGrain, time);
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
                zIndex: 0,
            }}
        />
    );
};

// ================================
// DRAWING FUNCTIONS
// ================================

function drawNebulaHaze(
    ctx: CanvasRenderingContext2D,
    w: number, h: number, time: number,
    nebulaPoints: NebulaPoint[],
    hue: number, turbulence: number,
    palette: CinematicVisualState['palette'],
    motionScale: number
) {
    const t = time * 0.00005 * motionScale;

    for (const point of nebulaPoints) {
        // Slow drift
        const { dx, dy } = flowField(point.x, point.y, time, turbulence);
        point.x += dx * motionScale * 0.3;
        point.y += dy * motionScale * 0.3;

        // Wrap
        if (point.x < -point.size) point.x = w + point.size;
        if (point.x > w + point.size) point.x = -point.size;
        if (point.y < -point.size) point.y = h + point.size;
        if (point.y > h + point.size) point.y = -point.size;

        // Draw nebula blob
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size);
        const pointHue = hue + point.hueOffset;

        gradient.addColorStop(0, `hsla(${pointHue}, 50%, 30%, ${point.opacity * 1.5})`);
        gradient.addColorStop(0.4, `hsla(${pointHue + 10}, 40%, 25%, ${point.opacity})`);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

interface StarfieldParams {
    driftX: number;
    driftY: number;
    speed: number;
    parallaxOffset: { x: number; y: number };
    cameraDrift: { x: number; y: number };
    palette: CinematicVisualState['palette'];
    motionScale: number;
    performanceMode: boolean;
}

function drawStarfield(
    ctx: CanvasRenderingContext2D,
    w: number, h: number, time: number,
    stars: Star[],
    params: StarfieldParams
) {
    const { driftX, driftY, speed, parallaxOffset, cameraDrift, palette, motionScale, performanceMode } = params;

    for (const star of stars) {
        // Parallax: nearer stars move more
        const parallax = 0.2 + star.z * 0.8;

        star.x += driftX * parallax * 60 * motionScale;
        star.y += driftY * parallax * 60 * motionScale;

        // Camera drift effect
        const displayX = star.x + cameraDrift.x * parallax * 0.5 + parallaxOffset.x * parallax * w;
        const displayY = star.y + cameraDrift.y * parallax * 0.5 + parallaxOffset.y * parallax * h;

        // Wrap
        if (star.x < 0) star.x = w;
        if (star.x > w) star.x = 0;
        if (star.y < 0) star.y = h;
        if (star.y > h) star.y = 0;

        // Twinkle
        star.twinklePhase += star.twinkleSpeed * 0.02 * motionScale;
        const twinkle = performanceMode ? 1 : (Math.sin(star.twinklePhase) * 0.3 + 0.7);
        const alpha = star.brightness * twinkle;

        // Draw star
        const size = star.size * (0.7 + star.z * 0.3);
        ctx.beginPath();
        ctx.arc(displayX, displayY, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        // Glow for bright stars
        if (star.brightness > 0.7 && star.z > 0.5 && !performanceMode) {
            ctx.beginPath();
            ctx.arc(displayX, displayY, size * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.15})`;
            ctx.fill();
        }
    }
}

function drawAuroraRibbons(
    ctx: CanvasRenderingContext2D,
    w: number, h: number, time: number,
    intensity: number, phase: number,
    palette: CinematicVisualState['palette'],
    motionScale: number
) {
    const ribbonCount = 3;
    const cy = h / 2;

    for (let i = 0; i < ribbonCount; i++) {
        const ribbonPhase = phase + i * 0.8;
        const yOffset = Math.sin(ribbonPhase) * h * 0.2;
        const hueShift = i * 25;

        ctx.beginPath();

        // Create flowing ribbon path
        for (let x = 0; x <= w; x += 10) {
            const wave1 = Math.sin(x * 0.005 + ribbonPhase) * 40;
            const wave2 = Math.sin(x * 0.008 + ribbonPhase * 1.3) * 25;
            const wave3 = Math.sin(x * 0.003 + ribbonPhase * 0.7) * 60;
            const y = cy + yOffset + wave1 + wave2 + wave3 - h * 0.1;

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        // Create gradient for ribbon
        const gradient = ctx.createLinearGradient(0, cy + yOffset - 80, 0, cy + yOffset + 80);
        const auroraHue = parseInt(palette.aurora.match(/\d+/)?.[0] || '200') + hueShift;

        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, `hsla(${auroraHue}, 70%, 55%, ${intensity * 0.12})`);
        gradient.addColorStop(0.5, `hsla(${auroraHue + 15}, 60%, 50%, ${intensity * 0.18})`);
        gradient.addColorStop(0.7, `hsla(${auroraHue}, 70%, 55%, ${intensity * 0.12})`);
        gradient.addColorStop(1, 'transparent');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 60 + i * 20;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

function drawDreamlikeHaze(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    intensity: number,
    palette: CinematicVisualState['palette']
) {
    // Soft overall haze
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    const hazeHue = parseInt(palette.nebulaPrimary.match(/\d+/)?.[0] || '280');

    gradient.addColorStop(0, `hsla(${hazeHue}, 40%, 50%, ${intensity * 0.15})`);
    gradient.addColorStop(0.5, `hsla(${hazeHue + 20}, 30%, 40%, ${intensity * 0.1})`);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

function drawVignette(
    ctx: CanvasRenderingContext2D,
    w: number, h: number, time: number,
    intensity: number, breathing: number,
    motionScale: number
) {
    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.sqrt(cx * cx + cy * cy);

    // Breathing effect
    const breathPhase = Math.sin(time * 0.0003 * motionScale) * 0.5 + 0.5;
    const breathAmount = breathing * 0.1 * breathPhase;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * (1 - breathAmount));
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.4, 'transparent');
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${intensity * 0.3})`);
    gradient.addColorStop(0.85, `rgba(0, 0, 0, ${intensity * 0.5})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity * 0.8})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

function drawFilmGrain(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    intensity: number, time: number
) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const seed = time * 0.001;

    // Very sparse grain for performance
    const step = 4;
    for (let i = 0; i < data.length; i += step * 4) {
        const noise = (Math.sin(i * 0.001 + seed) * 0.5 + 0.5) * intensity * 40 - 20;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);
}

export default FieldCanvas;
