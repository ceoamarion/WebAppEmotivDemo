"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CortexService, HeadsetInfo, StreamData, StreamType } from '@/services/cortex';

interface CortexContextType {
    service: CortexService;
    isConnected: boolean;
    isAuthorized: boolean;
    headsets: HeadsetInfo[];
    selectedHeadset: HeadsetInfo | null;
    sessionActive: boolean;
    streamData: StreamData | null;
    error: string | null;

    // Actions
    connect: () => Promise<void>;
    fullConnect: (clientId: string, clientSecret: string) => Promise<void>;
    connectHeadset: (headsetId: string) => Promise<void>;
    startStreaming: (streams: StreamType[]) => Promise<void>;
    stopStreaming: (streams: StreamType[]) => Promise<void>;
    disconnect: () => void;
}

const CortexContext = createContext<CortexContextType | undefined>(undefined);

export const CortexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [service] = useState(() => new CortexService());
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [headsets, setHeadsets] = useState<HeadsetInfo[]>([]);
    const [selectedHeadset, setSelectedHeadset] = useState<HeadsetInfo | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [streamData, setStreamData] = useState<StreamData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async () => {
        try {
            setError(null);
            await service.connect();
            setIsConnected(true);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Cortex');
            setIsConnected(false);
        }
    }, [service]);

    const fullConnect = useCallback(async (clientId: string, clientSecret: string) => {
        try {
            setError(null);

            if (!isConnected) {
                await service.connect();
                setIsConnected(true);
            }

            const result = await service.fullConnect(clientId, clientSecret);
            setIsAuthorized(true);
            setHeadsets(result.headsets);

        } catch (err: any) {
            setError(err.message || 'Failed to authorize');
            throw err;
        }
    }, [service, isConnected]);

    const connectHeadset = useCallback(async (headsetId: string) => {
        try {
            setError(null);
            await service.connectHeadset(headsetId);

            const headset = headsets.find(h => h.id === headsetId);
            setSelectedHeadset(headset || null);
            setSessionActive(true);

        } catch (err: any) {
            setError(err.message || 'Failed to connect headset');
            throw err;
        }
    }, [service, headsets]);

    const startStreaming = useCallback(async (streams: StreamType[]) => {
        try {
            setError(null);
            await service.startStreaming(streams, (data) => {
                setStreamData(data);
            });
        } catch (err: any) {
            setError(err.message || 'Failed to start streaming');
            throw err;
        }
    }, [service]);

    const stopStreaming = useCallback(async (streams: StreamType[]) => {
        try {
            await service.unsubscribe(streams);
        } catch (err: any) {
            setError(err.message || 'Failed to stop streaming');
        }
    }, [service]);

    const disconnect = useCallback(() => {
        service.disconnect();
        setIsConnected(false);
        setIsAuthorized(false);
        setHeadsets([]);
        setSelectedHeadset(null);
        setSessionActive(false);
        setStreamData(null);
    }, [service]);

    return (
        <CortexContext.Provider value={{
            service,
            isConnected,
            isAuthorized,
            headsets,
            selectedHeadset,
            sessionActive,
            streamData,
            error,
            connect,
            fullConnect,
            connectHeadset,
            startStreaming,
            stopStreaming,
            disconnect
        }}>
            {children}
        </CortexContext.Provider>
    );
};

export const useCortex = () => {
    const context = useContext(CortexContext);
    if (context === undefined) {
        throw new Error('useCortex must be used within a CortexProvider');
    }
    return context;
};
