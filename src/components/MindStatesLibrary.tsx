/**
 * Mind States Library Page
 * 
 * Browse all defined consciousness states with:
 * - Grid/list view
 * - Filtering by band dominance and category
 * - Detailed expansion
 */

'use client';

import React, { useState, useMemo } from 'react';
import { STATE_INFO, StateInfo } from '@/data/stateInfo';
import styles from './MindStatesLibrary.module.css';

// ================================
// EXTENDED STATE INFO
// ================================

interface ExtendedStateInfo extends StateInfo {
    category: 'baseline' | 'relaxation' | 'awareness' | 'transcendence';
    blockers: string[];
    tips: string[];
    howItFeels: string;
}

const EXTENDED_STATES: Record<string, Partial<ExtendedStateInfo>> = {
    ordinary_waking: {
        category: 'baseline',
        howItFeels: 'Normal thinking, planning, analyzing. Internal monologue is active.',
        blockers: ['None - this is the default state'],
        tips: ['This is where most people spend their day', 'Characterized by continuous mental activity'],
    },
    relaxed_awareness: {
        category: 'relaxation',
        howItFeels: 'Calm, present, peaceful. Mind is quiet but aware. Body feels settled.',
        blockers: ['Stress', 'Caffeine', 'Loud environment', 'Racing thoughts'],
        tips: ['Close your eyes', 'Slow down breathing', 'Release physical tension', 'Let thoughts pass without engaging'],
    },
    deep_relaxation: {
        category: 'relaxation',
        howItFeels: 'Profoundly peaceful. Time distortion may occur. Body very still.',
        blockers: ['Physical discomfort', 'Hunger', 'Time pressure', 'External noise'],
        tips: ['Practice 4-7-8 breathing', 'Progressive muscle relaxation', 'Use guided meditation', 'Create a dark, quiet space'],
    },
    inner_sound: {
        category: 'awareness',
        howItFeels: 'High-pitched tones, humming, or celestial sounds appear spontaneously.',
        blockers: ['External noise', 'Active thinking', 'Impatience'],
        tips: ['Focus on the silence between sounds', 'Practice in complete darkness', 'Use ear plugs', 'Maintain Alpha-Theta border'],
    },
    hypnagogic: {
        category: 'awareness',
        howItFeels: 'Floating sensation. Dream-like imagery. Body may feel paralyzed or heavy.',
        blockers: ['Anxiety', 'Caffeine', 'Too much sleep', 'Bright light'],
        tips: ['Practice WILD technique', 'Set intention before sleep', 'Wake-back-to-bed method', 'Stay still upon waking'],
    },
    obe: {
        category: 'transcendence',
        howItFeels: 'Sense of leaving the body. Viewing from above. Vibrational sensations.',
        blockers: ['Fear', 'Doubt', 'Physical movement', 'Strong body awareness'],
        tips: ['Relax completely', 'Use the rope technique', 'Practice daily relaxation', 'Maintain fearless curiosity'],
    },
    lucid_dreaming: {
        category: 'transcendence',
        howItFeels: 'Full awareness within a dream. Ability to control dream content.',
        blockers: ['Low dream recall', 'Excitement (causes wake-up)', 'Irregular sleep'],
        tips: ['Keep dream journal', 'Reality checks during day', 'MILD technique', 'WBTB method'],
    },
    lucid_like_awake: {
        category: 'awareness',
        howItFeels: 'Dreamlike quality to waking consciousness. Reality feels fluid.',
        blockers: ['Strong external focus', 'Analytical thinking', 'Physical activity'],
        tips: ['Practice mindfulness', 'Embrace uncertainty', 'Soften visual focus', 'Notice the witness'],
    },
    bliss_ecstatic: {
        category: 'transcendence',
        howItFeels: 'Overwhelming joy, love, gratitude. Body feels light. Heart opening.',
        blockers: ['Negativity', 'Closed heart', 'Rumination', 'Cynicism'],
        tips: ['Practice loving-kindness', 'Focus on gratitude', 'Open to devotion', 'Surrender to joy'],
    },
    samadhi: {
        category: 'transcendence',
        howItFeels: 'Complete absorption. No sense of time or space. Unity.',
        blockers: ['Restlessness', 'Doubt', 'Distraction', 'Incomplete concentration'],
        tips: ['Years of practice', 'Single-pointed focus', 'Retreat conditions', 'Expert guidance'],
    },
    transcendent_meta: {
        category: 'transcendence',
        howItFeels: 'Awareness of awareness itself. Boundless presence. Timelessness.',
        blockers: ['Identification with thoughts', 'Strong ego activity', 'Fear'],
        tips: ['Self-inquiry practice', 'Direct pointing', 'Non-dual meditation', 'Rest in awareness'],
    },
};

// ================================
// COMPONENT
// ================================

export function MindStatesLibrary() {
    const [searchQuery, setSearchQuery] = useState('');
    const [bandFilter, setBandFilter] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [expandedState, setExpandedState] = useState<string | null>(null);

    // All states with extended info
    const allStates = useMemo(() => {
        return Object.values(STATE_INFO).map(state => ({
            ...state,
            ...(EXTENDED_STATES[state.id] || {}),
        })) as ExtendedStateInfo[];
    }, []);

    // Filtered states
    const filteredStates = useMemo(() => {
        return allStates.filter(state => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    state.name.toLowerCase().includes(query) ||
                    state.description.toLowerCase().includes(query) ||
                    state.aliases.some(a => a.toLowerCase().includes(query)) ||
                    state.dominantBands.some(b => b.toLowerCase().includes(query));
                if (!matchesSearch) return false;
            }

            // Band filter
            if (bandFilter) {
                if (!state.dominantBands.includes(bandFilter)) return false;
            }

            // Category filter
            if (categoryFilter) {
                if (state.category !== categoryFilter) return false;
            }

            return true;
        });
    }, [allStates, searchQuery, bandFilter, categoryFilter]);

    const bands = ['Alpha', 'Theta', 'Gamma', 'Beta-H', 'Beta-L'];
    const categories = ['baseline', 'relaxation', 'awareness', 'transcendence'];

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Mind States Library</h1>
                <p className={styles.subtitle}>
                    Explore the consciousness states detected by Emotiv
                </p>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                {/* Search */}
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search states..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />

                {/* Band filter */}
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Band:</span>
                    <div className={styles.filterButtons}>
                        <button
                            className={`${styles.filterButton} ${bandFilter === null ? styles.active : ''}`}
                            onClick={() => setBandFilter(null)}
                        >
                            All
                        </button>
                        {bands.map(band => (
                            <button
                                key={band}
                                className={`${styles.filterButton} ${bandFilter === band ? styles.active : ''}`}
                                onClick={() => setBandFilter(bandFilter === band ? null : band)}
                            >
                                {band}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Category filter */}
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Category:</span>
                    <div className={styles.filterButtons}>
                        <button
                            className={`${styles.filterButton} ${categoryFilter === null ? styles.active : ''}`}
                            onClick={() => setCategoryFilter(null)}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`${styles.filterButton} ${categoryFilter === cat ? styles.active : ''}`}
                                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                            >
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results count */}
            <div className={styles.resultsCount}>
                {filteredStates.length} state{filteredStates.length !== 1 ? 's' : ''} found
            </div>

            {/* States Grid */}
            <div className={styles.statesGrid}>
                {filteredStates.map(state => (
                    <div
                        key={state.id}
                        className={`${styles.stateCard} ${expandedState === state.id ? styles.expanded : ''}`}
                        onClick={() => setExpandedState(expandedState === state.id ? null : state.id)}
                    >
                        {/* Card Header */}
                        <div className={styles.cardHeader}>
                            <div
                                className={styles.colorDot}
                                style={{ backgroundColor: state.color }}
                            />
                            <div className={styles.cardTitle}>
                                <h3 className={styles.stateName} style={{ color: state.color }}>
                                    {state.name}
                                </h3>
                                <div className={styles.bandTags}>
                                    {state.dominantBands.map(band => (
                                        <span key={band} className={styles.bandTag}>{band}</span>
                                    ))}
                                </div>
                            </div>
                            {state.category && (
                                <span className={`${styles.categoryBadge} ${styles[state.category]}`}>
                                    {state.category}
                                </span>
                            )}
                        </div>

                        {/* Brief description */}
                        <p className={styles.description}>{state.description}</p>

                        {/* Expanded content */}
                        {expandedState === state.id && (
                            <div className={styles.expandedContent}>
                                {/* Aliases */}
                                <div className={styles.detailSection}>
                                    <h4>Also Known As</h4>
                                    <div className={styles.aliases}>
                                        {state.aliases.map(alias => (
                                            <span key={alias} className={styles.alias}>{alias}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* How it feels */}
                                {state.howItFeels && (
                                    <div className={styles.detailSection}>
                                        <h4>How It Feels</h4>
                                        <p>{state.howItFeels}</p>
                                    </div>
                                )}

                                {/* Gating pattern */}
                                <div className={styles.detailSection}>
                                    <h4>Detection Pattern</h4>
                                    <p className={styles.gatingHint}>{state.gatingHint}</p>
                                </div>

                                {/* Common blockers */}
                                {state.blockers && state.blockers.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <h4>⚠️ Common Blockers</h4>
                                        <ul className={styles.list}>
                                            {state.blockers.map((blocker, i) => (
                                                <li key={i}>{blocker}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Tips */}
                                {state.tips && state.tips.length > 0 && (
                                    <div className={styles.detailSection}>
                                        <h4>💡 How to Increase Likelihood</h4>
                                        <ul className={styles.list}>
                                            {state.tips.map((tip, i) => (
                                                <li key={i}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Expand hint */}
                        <div className={styles.expandHint}>
                            {expandedState === state.id ? 'Click to collapse' : 'Click for more'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {filteredStates.length === 0 && (
                <div className={styles.empty}>
                    <span>No states match your filters.</span>
                    <button
                        className={styles.clearFiltersButton}
                        onClick={() => {
                            setSearchQuery('');
                            setBandFilter(null);
                            setCategoryFilter(null);
                        }}
                    >
                        Clear Filters
                    </button>
                </div>
            )}
        </div>
    );
}

export default MindStatesLibrary;
