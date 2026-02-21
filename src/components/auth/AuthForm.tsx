'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './AuthForm.module.css'

export default function AuthForm() {
    const router = useRouter()
    const supabase = createClient()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [fullName, setFullName] = useState('')
    const [website, setWebsite] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async () => {
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            setError(error.message)
        } else {
            router.push('/')
            router.refresh()
        }
        setLoading(false)
    }

    const handleSignUp = async () => {
        setLoading(true)
        setError(null)

        if (!username || !fullName) {
            setError("Username and Full Name are required for sign up.")
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
                data: {
                    username,
                    full_name: fullName,
                    website,
                }
            },
        })

        if (error) {
            setError(error.message)
        } else {
            setError('Check your email for the confirmation link!')
        }
        setLoading(false)
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.fieldGroup}>
                <label className={styles.label}>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.input}
                    placeholder="your@email.com"
                />
            </div>

            <div className={styles.fieldGroup}>
                <label className={styles.label}>Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                    placeholder="••••••••"
                />
            </div>

            {isSignUp && (
                <>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={styles.input}
                            placeholder="johndoe"
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={styles.input}
                            placeholder="John Doe"
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Website (Optional)</label>
                        <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className={styles.input}
                            placeholder="https://example.com"
                        />
                    </div>
                </>
            )}

            <div className={styles.buttonGroup}>
                <button
                    onClick={isSignUp ? handleSignUp : handleLogin}
                    disabled={loading}
                    className={styles.loginButton}
                >
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
                </button>

                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                    }}
                    className={styles.signupButton}
                >
                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
            </div>
        </div>
    )
}
