/**
 * InfoPanel - Reusable Floating Info Panel Component
 * 
 * Glassmorphism styled panel with:
 * - Floating positioning (uses Floating UI)
 * - Pin/unpin toggle
 * - Hover + keyboard focus support
 * - Viewport clamping
 */

'use client';

import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
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
    size,
    Placement,
} from '@floating-ui/react';
import styles from './InfoPanel.module.css';

// ================================
// TYPES
// ================================

interface InfoPanelProps {
    /** The trigger element */
    children: React.ReactNode;
    /** Panel content */
    content: React.ReactNode;
    /** Panel title */
    title: string;
    /** subtitle or disclaimer */
    subtitle?: string;
    /** Preferred placement */
    placement?: Placement;
    /** Externally controlled pin state */
    isPinned?: boolean;
    /** Callback when pin toggled */
    onPinChange?: (pinned: boolean) => void;
    /** Width of panel */
    width?: number;
    /** Disable panel */
    disabled?: boolean;
}

// ================================
// COMPONENT
// ================================

export function InfoPanel({
    children,
    content,
    title,
    subtitle,
    placement = 'top',
    isPinned: externalPinned,
    onPinChange,
    width = 340,
    disabled = false,
}: InfoPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [internalPinned, setInternalPinned] = useState(false);
    const arrowRef = useRef<SVGSVGElement>(null);
    const descriptionId = useId();

    // Use external pin state if provided, otherwise internal
    const isPinned = externalPinned ?? internalPinned;
    const setPinned = onPinChange ?? setInternalPinned;

    // Floating UI setup
    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: (open) => {
            if (!open && isPinned) return; // Don't close if pinned
            setIsOpen(open);
            if (!open) setPinned(false);
        },
        placement,
        middleware: [
            offset(12),
            flip({ padding: 16 }),
            shift({ padding: 16 }),
            size({
                padding: 16,
                apply({ availableHeight, elements }) {
                    const maxHeight = Math.min(availableHeight - 32, 450);
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
        enabled: !isPinned && !disabled,
        delay: { open: 200, close: 150 },
    });

    const focus = useFocus(context, {
        enabled: !isPinned && !disabled,
    });

    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: !isPinned, // Only dismiss on outside press if not pinned
    });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        focus,
        dismiss,
    ]);

    // Handle click to toggle pin
    const handleTriggerClick = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.stopPropagation();
        if (!isOpen) {
            setIsOpen(true);
            setPinned(true);
        } else {
            setPinned(!isPinned);
            if (isPinned) {
                // If unpinning, close after brief delay
                setTimeout(() => setIsOpen(false), 200);
            }
        }
    }, [isOpen, isPinned, setPinned, disabled]);

    // Handle pin button click
    const handlePinClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setPinned(!isPinned);
    }, [isPinned, setPinned]);

    // Close on Escape when pinned
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPinned) {
                setPinned(false);
                setIsOpen(false);
            }
        };

        if (isPinned) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isPinned, setPinned]);

    if (disabled) {
        return <>{children}</>;
    }

    return (
        <>
            {/* Trigger */}
            <div
                ref={refs.setReference}
                className={styles.trigger}
                onClick={handleTriggerClick}
                tabIndex={0}
                aria-describedby={isOpen ? descriptionId : undefined}
                {...getReferenceProps()}
            >
                {children}
                {isPinned && <span className={styles.pinBadge}>📌</span>}
            </div>

            {/* Panel (Portal) */}
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        id={descriptionId}
                        role="tooltip"
                        className={`${styles.panel} ${isPinned ? styles.pinned : ''}`}
                        style={{ ...floatingStyles, width: `${width}px` }}
                        {...getFloatingProps()}
                    >
                        {/* Arrow */}
                        <FloatingArrow
                            ref={arrowRef}
                            context={context}
                            className={styles.arrow}
                            width={14}
                            height={7}
                            tipRadius={2}
                        />

                        {/* Header */}
                        <div className={styles.header}>
                            <div className={styles.headerText}>
                                <h3 className={styles.title}>{title}</h3>
                                {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                            </div>
                            <button
                                className={`${styles.pinButton} ${isPinned ? styles.active : ''}`}
                                onClick={handlePinClick}
                                title={isPinned ? 'Unpin panel' : 'Pin panel'}
                            >
                                {isPinned ? '📌' : '📍'}
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className={styles.content}>
                            {content}
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default InfoPanel;
