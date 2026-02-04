/**
 * CinematicControls - Intensity Slider and Settings
 * 
 * Compact control panel with:
 * - Cinematic intensity slider (0-1)
 * - Reduced motion toggle
 * - Performance mode indicator
 * - localStorage persistence
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    loadCinematicIntensity,
    saveCinematicIntensity,
    useReducedMotionPreference,
} from './useCinematicVisuals';
import styles from './CinematicControls.module.css';

export interface CinematicControlsProps {
    onIntensityChange: (intensity: number) => void;
    onReducedMotionChange: (reduced: boolean) => void;
    performanceMode: boolean;
    className?: string;
}

const CinematicControls: React.FC<CinematicControlsProps> = ({
    onIntensityChange,
    onReducedMotionChange,
    performanceMode,
    className = '',
}) => {
    const systemReducedMotion = useReducedMotionPreference();
    const [intensity, setIntensity] = useState(() => loadCinematicIntensity());
    const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync with system preference
    useEffect(() => {
        setReducedMotion(systemReducedMotion);
        onReducedMotionChange(systemReducedMotion);
    }, [systemReducedMotion, onReducedMotionChange]);

    const handleIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setIntensity(value);
        saveCinematicIntensity(value);
        onIntensityChange(value);
    }, [onIntensityChange]);

    const toggleReducedMotion = useCallback(() => {
        const newValue = !reducedMotion;
        setReducedMotion(newValue);
        onReducedMotionChange(newValue);
    }, [reducedMotion, onReducedMotionChange]);

    return (
        <div className={`${styles.container} ${className}`}>
            {/* Toggle Button */}
            <button
                className={`${styles.toggleButton} ${isExpanded ? styles.active : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                title="Cinematic Settings"
            >
                <span className={styles.toggleIcon}>✨</span>
                {performanceMode && <span className={styles.perfIndicator}>⚡</span>}
            </button>

            {/* Expanded Panel */}
            {isExpanded && (
                <div className={styles.panel}>
                    <div className={styles.header}>
                        <span className={styles.title}>Cinematic</span>
                        {performanceMode && (
                            <span className={styles.perfBadge} title="Performance mode active">
                                ⚡ Lite
                            </span>
                        )}
                    </div>

                    {/* Intensity Slider */}
                    <div className={styles.control}>
                        <label className={styles.label}>
                            <span className={styles.labelText}>Intensity</span>
                            <span className={styles.labelValue}>{Math.round(intensity * 100)}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={intensity}
                            onChange={handleIntensityChange}
                            className={styles.slider}
                        />
                        <div className={styles.sliderLabels}>
                            <span>Subtle</span>
                            <span>Immersive</span>
                        </div>
                    </div>

                    {/* Reduce Motion Toggle */}
                    <div className={styles.control}>
                        <button
                            className={`${styles.toggleOption} ${reducedMotion ? styles.active : ''}`}
                            onClick={toggleReducedMotion}
                        >
                            <span className={styles.toggleEmoji}>
                                {reducedMotion ? '🐢' : '🐇'}
                            </span>
                            <span className={styles.toggleLabel}>
                                {reducedMotion ? 'Reduced Motion' : 'Full Motion'}
                            </span>
                        </button>
                    </div>

                    {/* Info */}
                    <div className={styles.info}>
                        <span className={styles.infoIcon}>ℹ️</span>
                        <span className={styles.infoText}>
                            Adjust for comfort. Lower intensity uses less GPU.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CinematicControls;
