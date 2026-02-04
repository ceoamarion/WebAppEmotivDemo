"use client";

import { useState, useEffect } from 'react';
import { useCortex } from '@/context/CortexContext';
import styles from './HeadsetConnection.module.css';

export default function HeadsetConnection() {
    const {
        isConnected,
        isAuthorized,
        headsets,
        selectedHeadset,
        sessionActive,
        error,
        connect,
        fullConnect,
        connectHeadset,
        disconnect
    } = useCortex();

    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [status, setStatus] = useState<string>('Idle');
    const [isLoading, setIsLoading] = useState(false);

    // Load saved credentials
    useEffect(() => {
        const savedClientId = localStorage.getItem('emotiv_clientId');
        const savedClientSecret = localStorage.getItem('emotiv_clientSecret');
        if (savedClientId) setClientId(savedClientId);
        if (savedClientSecret) setClientSecret(savedClientSecret);
    }, []);

    const handleConnect = async () => {
        setIsLoading(true);
        setStatus('Connecting to Cortex...');
        try {
            await connect();
            setStatus('Connected to Cortex WebSocket');
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
        setIsLoading(false);
    };

    const handleAuth = async () => {
        if (!clientId || !clientSecret) return;

        setIsLoading(true);
        setStatus('Authenticating...');

        // Save credentials
        localStorage.setItem('emotiv_clientId', clientId);
        localStorage.setItem('emotiv_clientSecret', clientSecret);

        try {
            await fullConnect(clientId, clientSecret);
            setStatus(`Authorized! Found ${headsets.length} headset(s)`);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
        setIsLoading(false);
    };

    const handleSelectHeadset = async (headsetId: string) => {
        setIsLoading(true);
        setStatus(`Connecting to ${headsetId}...`);
        try {
            await connectHeadset(headsetId);
            setStatus(`Session active with ${headsetId}`);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
        setIsLoading(false);
    };

    const handleDisconnect = () => {
        disconnect();
        setStatus('Disconnected');
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Connection</h2>

            {/* Connection Status */}
            <div className={styles.statusRow}>
                <div className={`${styles.indicator} ${isConnected ? styles.connected : styles.disconnected}`}></div>
                <span className={styles.statusText}>
                    {sessionActive ? 'Session Active' : isAuthorized ? 'Authorized' : isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {sessionActive && (
                    <button onClick={handleDisconnect} className={styles.disconnectBtn}>
                        Disconnect
                    </button>
                )}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {/* Step 1: Connect to WebSocket */}
            {!isConnected && (
                <button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className={styles.authBtn}
                >
                    {isLoading ? 'Connecting...' : 'Connect to Emotiv'}
                </button>
            )}

            {/* Step 2: Authenticate */}
            {isConnected && !isAuthorized && (
                <div className={styles.formGroup}>
                    <div>
                        <label className={styles.label}>Client ID</label>
                        <input
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className={styles.input}
                            placeholder="Enter your Client ID"
                        />
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Client Secret</label>
                        <input
                            type="password"
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            className={styles.input}
                            placeholder="Enter your Client Secret"
                        />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <button
                            onClick={handleAuth}
                            disabled={isLoading || !clientId || !clientSecret}
                            className={styles.authBtn}
                        >
                            {isLoading ? 'Authenticating...' : 'Authenticate'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Select Headset */}
            {isAuthorized && !sessionActive && headsets.length > 0 && (
                <div className={styles.headsetList}>
                    <h3 className={styles.subtitle}>Available Headsets</h3>
                    {headsets.map((headset) => (
                        <div
                            key={headset.id}
                            className={styles.headsetItem}
                            onClick={() => handleSelectHeadset(headset.id)}
                        >
                            <span className={styles.headsetName}>{headset.id}</span>
                            <span className={`${styles.headsetStatus} ${headset.status === 'connected' ? styles.statusGreen : styles.statusYellow}`}>
                                {headset.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {isAuthorized && headsets.length === 0 && (
                <div className={styles.noHeadset}>
                    No headsets found. Make sure your Epoc X is paired and turned on.
                </div>
            )}

            {/* Status Display */}
            {status && (
                <div className={styles.authStatus}>
                    {status}
                </div>
            )}
        </div>
    );
}
