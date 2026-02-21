'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import styles from './page.module.css'

export default function ProfilePage() {
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
            } else {
                setUser(session.user)
            }
            setLoading(false)
        })
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const handleBack = () => router.back()

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>Loading...</div>
            </div>
        )
    }

    if (!user) return null

    const displayName = user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0] || 'User'
    const createdAt = new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
    })

    return (
        <div className={styles.page}>
            <button className={styles.backButton} onClick={handleBack}>← Back</button>
            <div className={styles.card}>
                {/* Avatar */}
                <div className={styles.avatar}>
                    {displayName.slice(0, 2).toUpperCase()}
                </div>

                <h1 className={styles.name}>{displayName}</h1>
                <p className={styles.email}>{user.email}</p>

                <div className={styles.divider} />

                <div className={styles.infoGrid}>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Account Created</span>
                        <span className={styles.infoValue}>{createdAt}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Username</span>
                        <span className={styles.infoValue}>{user.user_metadata?.username || '—'}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Full Name</span>
                        <span className={styles.infoValue}>{user.user_metadata?.full_name || '—'}</span>
                    </div>
                    {user.user_metadata?.website && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Website</span>
                            <a href={user.user_metadata.website} className={styles.infoLink} target="_blank" rel="noopener noreferrer">
                                {user.user_metadata.website}
                            </a>
                        </div>
                    )}
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Auth Status</span>
                        <span className={`${styles.infoValue} ${styles.badge}`}>✓ Connected</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Provider</span>
                        <span className={styles.infoValue}>{user.app_metadata?.provider || 'email'}</span>
                    </div>
                </div>

                <div className={styles.divider} />

                <button className={styles.signOutButton} onClick={handleSignOut}>
                    🚪 Sign Out
                </button>
            </div>
        </div>
    )
}
