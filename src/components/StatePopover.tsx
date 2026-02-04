/**
 * StatePopover Component
 * 
 * Floating popover for state cards that:
 * - Renders in a portal to avoid clipping
 * - Auto-positions with flip/shift for viewport collision
 * - Supports hover (temporary) and click-to-pin behavior
 * - Has max-height with scroll for tall content
 * - Closes on Escape or click outside
 */

'use client';

import React, { useState, useCallback, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    useClick,
    useInteractions,
    FloatingArrow,
    FloatingPortal,
    size,
} from '@floating-ui/react';
import { StateInfo } from '@/data/stateInfo';
import styles from './StatePopover.module.css';

// ================================
// TYPES
// ================================

interface StatePopoverProps {
    children: React.ReactNode;
    stateInfo: StateInfo;
    confidence: number;
    lockedSince?: number;
    status?: 'locked' | 'candidate' | 'challenger';
}

// ================================
// COMPONENT
// ================================

export function StatePopover({
    children,
    stateInfo,
    confidence,
    lockedSince,
    status = 'candidate',
}: StatePopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const arrowRef = useRef<SVGSVGElement>(null);
    const descriptionId = useId();

    const timeLocked = lockedSince
        ? Math.round((Date.now() - lockedSince) / 1000)
        : 0;

    // Floating UI setup
    const { refs, floatingStyles, context, middlewareData, placement } = useFloating({
        open: isOpen,
        onOpenChange: (open) => {
            if (!open && isPinned) {
                // Don't close if pinned, unless explicitly dismissed
                return;
            }
            setIsOpen(open);
            if (!open) setIsPinned(false);
        },
        placement: 'top',
        middleware: [
            offset(12),
            flip({
                fallbackPlacements: ['bottom', 'left', 'right'],
                padding: 16,
            }),
            shift({
                padding: 16,
            }),
            size({
                padding: 16,
                apply({ availableHeight, elements }) {
                    // Set max-height based on available viewport space
                    const maxHeight = Math.min(availableHeight - 32, 400);
                    Object.assign(elements.floating.style, {
                        maxHeight: `${maxHeight}px`,
                    });
                },
            }),
            arrow({ element: arrowRef }),
        ],
        whileElementsMounted: autoUpdate,
    });

    // Interactions
    const hover = useHover(context, {
        enabled: !isPinned,
        delay: { open: 150, close: 100 },
    });

    const focus = useFocus(context, {
        enabled: !isPinned,
    });

    const click = useClick(context, {
        toggle: true,
    });

    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: true,
    });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        focus,
        click,
        dismiss,
    ]);

    // Handle click to pin
    const handleTriggerClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPinned((prev) => {
            const newPinned = !prev;
            if (newPinned) {
                setIsOpen(true);
            }
            return newPinned;
        });
    }, []);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPinned) {
                setIsPinned(false);
                setIsOpen(false);
            }
        };

        if (isPinned) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isPinned]);

    // Determine arrow position
    const arrowX = middlewareData.arrow?.x;
    const arrowY = middlewareData.arrow?.y;
    const isTop = placement.startsWith('top');
    const isBottom = placement.startsWith('bottom');
    const isLeft = placement.startsWith('left');
    const isRight = placement.startsWith('right');

    return (
        <>
            {/* Trigger */}
            <div
                ref={refs.setReference}
                className={styles.trigger}
                onClick={handleTriggerClick}
                aria-describedby={isOpen ? descriptionId : undefined}
                {...getReferenceProps()}
            >
                {children}
                {isPinned && <span className={styles.pinIndicator}>📌</span>}
            </div>

            {/* Popover (Portal) */}
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        id={descriptionId}
                        role="tooltip"
                        className={`${styles.popover} ${isPinned ? styles.pinned : ''}`}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        {/* Arrow */}
                        <FloatingArrow
                            ref={arrowRef}
                            context={context}
                            className={styles.arrow}
                            width={16}
                            height={8}
                            tipRadius={2}
                        />

                        {/* Scrollable Content */}
                        <div className={styles.content}>
                            {/* Header */}
                            <div className={styles.header}>
                                <span
                                    className={styles.headerName}
                                    style={{ color: stateInfo.color }}
                                >
                                    {stateInfo.name}
                                </span>
                                <div className={styles.headerRight}>
                                    {isPinned && (
                                        <button
                                            className={styles.closeButton}
                                            onClick={() => {
                                                setIsPinned(false);
                                                setIsOpen(false);
                                            }}
                                            aria-label="Close"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <span className={`${styles.statusBadge} ${styles[status]}`}>
                                        {status}
                                    </span>
                                </div>
                            </div>

                            {/* Aliases */}
                            <div className={styles.aliases}>
                                {stateInfo.aliases.slice(0, 3).map((alias, i) => (
                                    <span key={i} className={styles.alias}>
                                        {alias}
                                    </span>
                                ))}
                            </div>

                            {/* Dominant Bands */}
                            <div className={styles.bands}>
                                <span className={styles.label}>Dominant:</span>
                                {stateInfo.dominantBands.map((band) => (
                                    <span key={band} className={styles.bandTag}>
                                        {band}
                                    </span>
                                ))}
                            </div>

                            {/* Description */}
                            <p className={styles.description}>{stateInfo.description}</p>

                            {/* Metrics */}
                            <div className={styles.metrics}>
                                <div className={styles.metric}>
                                    <span className={styles.metricValue}>{Math.round(confidence)}%</span>
                                    <span className={styles.metricLabel}>confidence</span>
                                </div>
                                {lockedSince && (
                                    <div className={styles.metric}>
                                        <span className={styles.metricValue}>{timeLocked}s</span>
                                        <span className={styles.metricLabel}>locked</span>
                                    </div>
                                )}
                            </div>

                            {/* Gating Hint */}
                            <div className={styles.gatingHint}>
                                <span className={styles.label}>Pattern:</span>
                                <span>{stateInfo.gatingHint}</span>
                            </div>

                            {/* Pin hint */}
                            {!isPinned && (
                                <div className={styles.pinHint}>
                                    Click to pin this info panel
                                </div>
                            )}
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default StatePopover;
