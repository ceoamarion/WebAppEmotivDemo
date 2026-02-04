"use client";

import { useState } from 'react';
import styles from './Navigation.module.css';

interface Tab {
    id: string;
    label: string;
}

const TABS: Tab[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'experience', label: 'Experience' },
    { id: 'tutorial', label: 'Tutorial' },
    { id: 'mindstates', label: 'Mind States' },
    { id: 'records', label: 'Records' },
];

interface NavigationProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
    return (
        <nav className={styles.nav}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}>🧠</span>
                <span className={styles.logoText}>Emotiv Demo</span>
            </div>

            <div className={styles.tabs}>
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </nav>
    );
}
