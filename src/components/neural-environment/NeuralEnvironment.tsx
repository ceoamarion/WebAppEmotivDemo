/**
 * NeuralEnvironment - Cinematic Neural Visualization
 * 
 * Premium AAA sci-fi meditation environment with:
 * - Deep blacks, rich gradients, soft bloom
 * - Multi-layer orb with depth
 * - Living nebula/aurora background
 * - Smooth camera exposure shifts
 * - Realm-based state transitions
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FieldCanvas from './FieldCanvas';
import OrbCanvas from './OrbCanvas';
import CinematicControls from './CinematicControls';
import {
    useCinematicVisuals,
    loadCinematicIntensity,
    useReducedMotionPreference,
} from './useCinematicVisuals';
import { NeuralInput } from './types';
import styles from './NeuralEnvironment.module.css';

// ================================
// PROPS
// ================================

export interface NeuralEnvironmentProps {
    // Required neural data
    currentStateId: string;
    currentConfidence: number;
    challengerStateId?: string | null;
    challengerConfidence?: number | null;
    transitionStatus: 'stabilizing' | 'candidate' | 'confirmed' | 'locked' | 'transitioning';

    // Band powers (normalized 0-1)
    bandPowers: {
        theta: number;
        alpha: number;
        betaL: number;
        betaH: number;
        gamma: number;
    };

    // Emotion axes
    emotionAxes: {
        valence: number;
        arousal: number;
        control: number;
    };

    isEmotionallyStable: boolean;

    // Optional controls
    showControls?: boolean;

    // Container dimensions
    width?: number;
    height?: number;
}

// ================================
// COMPONENT
// ================================

const NeuralEnvironment: React.FC<NeuralEnvironmentProps> = ({
    currentStateId,
    currentConfidence,
    challengerStateId = null,
    challengerConfidence = null,
    transitionStatus,
    bandPowers,
    emotionAxes,
    isEmotionallyStable,
    showControls = true,
    width: propWidth,
    height: propHeight,
}) => {
    // Container dimensions
    const [dimensions, setDimensions] = useState({ width: propWidth || 800, height: propHeight || 600 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Settings
    const systemReducedMotion = useReducedMotionPreference();
    const [cinematicIntensity, setCinematicIntensity] = useState(() => loadCinematicIntensity());
    const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);

    // Update dimensions on resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: propWidth || containerRef.current.offsetWidth,
                    height: propHeight || containerRef.current.offsetHeight,
                });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [propWidth, propHeight]);

    // Build neural input
    const neuralInput = useMemo<NeuralInput>(() => ({
        currentStateId,
        currentConfidence,
        challengerStateId,
        challengerConfidence,
        transitionStatus,
        bandPowers,
        emotionAxes,
        isEmotionallyStable,
        tickMs: Date.now(),
    }), [
        currentStateId,
        currentConfidence,
        challengerStateId,
        challengerConfidence,
        transitionStatus,
        bandPowers,
        emotionAxes,
        isEmotionallyStable,
    ]);

    // Get cinematic visual state
    const visualState = useCinematicVisuals(neuralInput, {
        cinematicIntensity,
        reducedMotion,
    });

    // Handlers
    const handleIntensityChange = useCallback((value: number) => {
        setCinematicIntensity(value);
    }, []);

    const handleReducedMotionChange = useCallback((value: boolean) => {
        setReducedMotion(value);
    }, []);

    return (
        <div
            ref={containerRef}
            className={styles.container}
            style={{
                width: propWidth ? `${propWidth}px` : '100%',
                height: propHeight ? `${propHeight}px` : '100%',
            }}
        >
            {/* Background Field Layer */}
            <FieldCanvas
                visualState={visualState}
                width={dimensions.width}
                height={dimensions.height}
            />

            {/* Center Orb Layer */}
            <OrbCanvas
                visualState={visualState}
                width={dimensions.width}
                height={dimensions.height}
            />

            {/* Cinematic Controls */}
            {showControls && (
                <div className={styles.controlsContainer}>
                    <CinematicControls
                        onIntensityChange={handleIntensityChange}
                        onReducedMotionChange={handleReducedMotionChange}
                        performanceMode={visualState.performanceMode}
                    />
                </div>
            )}

            {/* State Label (subtle) */}
            <div
                className={styles.stateLabel}
                style={{
                    color: visualState.palette.accent,
                    textShadow: `0 0 20px ${visualState.palette.glow}`,
                }}
            >
                {currentStateId.replace(/_/g, ' ')}
            </div>

            {/* Performance mode indicator */}
            {visualState.performanceMode && (
                <div className={styles.perfMode}>
                    ⚡ Performance Mode
                </div>
            )}
        </div>
    );
};

export default NeuralEnvironment;
