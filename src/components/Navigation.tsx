"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
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
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleSignOut = async () => {
        setDropdownOpen(false);
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleExportJSON = () => {
        setDropdownOpen(false);
        const stored = localStorage.getItem('consciousness_explorer_sessions');
        const data = stored ? JSON.parse(stored) : [];
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emotiv_sessions_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.username ||
        user?.email?.split('@')[0] ||
        'Account';

    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <nav className={styles.nav}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}>🧠</span>
                <span className={styles.logoText}>Emotiv Demo</span>
            </div>

            <div className={styles.rightSection}>
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

                {!loading && (
                    user ? (
                        <div className={styles.accountWrapper} ref={dropdownRef}>
                            <button
                                className={styles.accountButton}
                                onClick={() => setDropdownOpen(prev => !prev)}
                                aria-haspopup="true"
                                aria-expanded={dropdownOpen}
                            >
                                <span className={styles.accountAvatar}>{initials}</span>
                                {displayName}
                                <span className={`${styles.accountChevron} ${dropdownOpen ? styles.open : ''}`}>▼</span>
                            </button>

                            {dropdownOpen && (
                                <div className={styles.dropdown} role="menu">
                                    {/* Email header */}
                                    <div className={styles.dropdownHeader}>
                                        <span className={styles.dropdownName}>{displayName}</span>
                                        <span className={styles.dropdownEmail}>{user.email}</span>
                                    </div>

                                    <div className={styles.dropdownItems}>
                                        <Link
                                            href="/profile"
                                            className={styles.dropdownItem}
                                            role="menuitem"
                                            onClick={() => setDropdownOpen(false)}
                                        >
                                            <span className={styles.icon}>👤</span>
                                            Profile
                                        </Link>

                                        <button
                                            className={styles.dropdownItem}
                                            role="menuitem"
                                            onClick={() => { setDropdownOpen(false); onTabChange('records'); }}
                                        >
                                            <span className={styles.icon}>📋</span>
                                            Records
                                        </button>

                                        <button
                                            className={styles.dropdownItem}
                                            role="menuitem"
                                            onClick={handleExportJSON}
                                        >
                                            <span className={styles.icon}>📥</span>
                                            Export JSON
                                        </button>

                                        <div className={styles.dropdownDivider} />

                                        <button
                                            className={`${styles.dropdownItem} ${styles.danger}`}
                                            role="menuitem"
                                            onClick={handleSignOut}
                                        >
                                            <span className={styles.icon}>🚪</span>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" className={styles.loginButton}>
                            Login
                        </Link>
                    )
                )}
            </div>
        </nav>
    );
}
