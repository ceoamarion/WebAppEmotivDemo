/**
 * EmotionInfoTooltip Component
 *
 * A floating portal-based hover tooltip for the Emotion State panel.
 * Shows definitions of Valence/Arousal/Control axes, current live values,
 * and how they map to the cinematic visuals (orb glow, intensity, smoothness).
 *
 * Uses @floating-ui/react for anti-clipping, viewport clamping, and auto-flip.
 */

'use client';

import React, { useState, useRef, useId } from 'react';
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    arrow,
    useHover,
    useFocus,
    useDismiss,
    useInteractions,
    FloatingArrow,
    FloatingPortal,
} from '@floating-ui/react';
import { EmotionAxes, EmotionItem } from '@/stores/sessionStore';
import styles from './EmotionInfoTooltip.module.css';

interface EmotionInfoTooltipProps {
    children: React.ReactNode;
    axes: EmotionAxes;
    topEmotions: EmotionItem[];
    hasData: boolean;
}

function formatBipolar(v: number): string {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${(v * 100).toFixed(0)}%`;
}
function formatUnipolar(v: number): string {
    return `${(v * 100).toFixed(0)}%`;
}

export function EmotionInfoTooltip({ children, axes, topEmotions, hasData }: EmotionInfoTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const arrowRef = useRef<SVGSVGElement>(null);
    const descriptionId = useId();

    const { refs, floatingStyles, context, middlewareData } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'right-start',
        middleware: [
            offset(12),
            flip({
                fallbackPlacements: ['right', 'top', 'bottom', 'left'],
                padding: 16,
            }),
            shift({ padding: 16 }),
            arrow({ element: arrowRef }),
        ],
        whileElementsMounted: autoUpdate,
    });

    const hover = useHover(context, {
        delay: { open: 150, close: 120 },
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss]);

    const valenceColor = axes.valence >= 0 ? '#22c55e' : '#ef4444';
    const arousalColor = axes.arousal > 0.5 ? '#f59e0b' : '#3b82f6';

    return (
        <>
            <div
                ref={refs.setReference}
                className={styles.trigger}
                aria-describedby={isOpen ? descriptionId : undefined}
                {...getReferenceProps()}
            >
                {children}
            </div>

            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        id={descriptionId}
                        role="tooltip"
                        className={styles.popover}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <FloatingArrow
                            ref={arrowRef}
                            context={context}
                            className={styles.arrow}
                            width={14}
                            height={7}
                            tipRadius={2}
                        />

                        <div className={styles.content}>
                            <div className={styles.sectionTitle}>Emotion Axes</div>

                            {/* Valence */}
                            <div className={styles.axisItem}>
                                <div className={styles.axisHeader}>
                                    <span className={styles.axisName}>Valence</span>
                                    {hasData && (
                                        <span className={styles.axisValue} style={{ color: valenceColor }}>
                                            {formatBipolar(axes.valence)}
                                        </span>
                                    )}
                                </div>
                                <p className={styles.axisDef}>
                                    Emotional tone from <em>negative</em> (−100%) to <em>positive</em> (+100%).
                                    Drives the <strong>orb color tint</strong> — warm hues when positive, cool/red when negative.
                                </p>
                            </div>

                            {/* Arousal */}
                            <div className={styles.axisItem}>
                                <div className={styles.axisHeader}>
                                    <span className={styles.axisName}>Arousal</span>
                                    {hasData && (
                                        <span className={styles.axisValue} style={{ color: arousalColor }}>
                                            {formatUnipolar(axes.arousal)}
                                        </span>
                                    )}
                                </div>
                                <p className={styles.axisDef}>
                                    Activation level from calm (0%) to highly energized (100%).
                                    Controls <strong>orb glow intensity</strong> and particle speed.
                                </p>
                            </div>

                            {/* Control */}
                            <div className={styles.axisItem}>
                                <div className={styles.axisHeader}>
                                    <span className={styles.axisName}>Control</span>
                                    {hasData && (
                                        <span className={styles.axisValue} style={{ color: '#8b5cf6' }}>
                                            {formatUnipolar(axes.control)}
                                        </span>
                                    )}
                                </div>
                                <p className={styles.axisDef}>
                                    Sense of agency from uncontrolled (0%) to mastery (100%).
                                    Affects <strong>waveform smoothness</strong> in the background canvas.
                                </p>
                            </div>

                            {/* Top emotions */}
                            {hasData && topEmotions.length > 0 && (
                                <>
                                    <div className={styles.divider} />
                                    <div className={styles.sectionTitle}>Top Emotions</div>
                                    {topEmotions.map((e, i) => (
                                        <div key={e.name} className={styles.emotionRow}>
                                            <span className={styles.emotionRank}>{i + 1}</span>
                                            <span className={styles.emotionName}>{e.name}</span>
                                            <div className={styles.emotionBarWrap}>
                                                <div
                                                    className={styles.emotionBar}
                                                    style={{ width: `${Math.min(100, Math.max(0, e.score))}%` }}
                                                />
                                            </div>
                                            <span className={styles.emotionPct}>
                                                {Math.min(100, Math.max(0, e.score)).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {!hasData && (
                                <div className={styles.noData}>
                                    Emotion data will appear when a session is active.
                                </div>
                            )}
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default EmotionInfoTooltip;
