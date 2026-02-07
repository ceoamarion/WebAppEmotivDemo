/**
 * Stream Subscription Adapter
 * 
 * Connects Emotiv Cortex API streams to the session store.
 * Handles all stream data parsing and routing.
 * 
 * Usage:
 * ```
 * const adapter = new StreamAdapter(cortex);
 * adapter.start();
 * // ... later
 * adapter.stop();
 * ```
 */

import { useSessionStore } from './sessionStore';

export interface StreamAdapterConfig {
    tickIntervalMs: number;
    enableLogging: boolean;
}

const DEFAULT_CONFIG: StreamAdapterConfig = {
    tickIntervalMs: 500,
    enableLogging: false,
};

export class StreamAdapter {
    private cortex: { on: (event: string, handler: (data: unknown) => void) => void; off?: (event: string, handler: (data: unknown) => void) => void };
    private config: StreamAdapterConfig;
    private tickInterval: ReturnType<typeof setInterval> | null = null;
    private packetCount = 0;
    private lastPacketCountReset = Date.now();
    private handlers: Map<string, (data: unknown) => void> = new Map();

    constructor(
        cortex: { on: (event: string, handler: (data: unknown) => void) => void; off?: (event: string, handler: (data: unknown) => void) => void },
        config: Partial<StreamAdapterConfig> = {}
    ) {
        this.cortex = cortex;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    public start(): void {
        const store = useSessionStore.getState();
        store.setSessionActive(true);

        // Create stream handlers
        this.handlers.set('stream', this.handleStream.bind(this));

        // Subscribe to cortex events
        this.handlers.forEach((handler, event) => {
            this.cortex.on(event, handler);
        });

        // Start tick interval for stale detection
        this.tickInterval = setInterval(() => {
            this.tick();
        }, this.config.tickIntervalMs);

        if (this.config.enableLogging) {
            console.log('[StreamAdapter] Started');
        }
    }

    public stop(): void {
        const store = useSessionStore.getState();
        store.setSessionActive(false);

        // Unsubscribe from cortex events
        if (this.cortex.off) {
            this.handlers.forEach((handler, event) => {
                this.cortex.off!(event, handler);
            });
        }
        this.handlers.clear();

        // Stop tick interval
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        if (this.config.enableLogging) {
            console.log('[StreamAdapter] Stopped');
        }
    }

    private handleStream(data: unknown): void {
        if (!data || typeof data !== 'object') return;

        const streamData = data as { stream?: string; data?: unknown };
        if (!streamData.stream || !streamData.data) return;

        const store = useSessionStore.getState();
        store.receiveStreamPacket(streamData.stream, streamData.data);

        this.packetCount++;

        if (this.config.enableLogging) {
            console.log(`[StreamAdapter] ${streamData.stream}:`, streamData.data);
        }
    }

    private tick(): void {
        const now = Date.now();
        const store = useSessionStore.getState();

        // Update packet rate
        const elapsed = now - this.lastPacketCountReset;
        if (elapsed >= 1000) {
            const rate = (this.packetCount / elapsed) * 1000;
            useSessionStore.setState({ packetRate: rate });
            this.packetCount = 0;
            this.lastPacketCountReset = now;
        }

        // Run store tick for stale detection
        store.tick();
    }
}

/**
 * React hook for using the stream adapter
 */
import { useEffect, useRef } from 'react';

export function useStreamAdapter(
    cortex: { on: (event: string, handler: (data: unknown) => void) => void; off?: (event: string, handler: (data: unknown) => void) => void } | null,
    isActive: boolean,
    config?: Partial<StreamAdapterConfig>
): void {
    const adapterRef = useRef<StreamAdapter | null>(null);

    useEffect(() => {
        if (!cortex || !isActive) {
            if (adapterRef.current) {
                adapterRef.current.stop();
                adapterRef.current = null;
            }
            return;
        }

        // Create and start adapter
        adapterRef.current = new StreamAdapter(cortex, config);
        adapterRef.current.start();

        return () => {
            if (adapterRef.current) {
                adapterRef.current.stop();
                adapterRef.current = null;
            }
        };
    }, [cortex, isActive, config]);
}

export default StreamAdapter;
