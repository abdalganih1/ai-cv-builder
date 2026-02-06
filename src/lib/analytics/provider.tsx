'use client';

/**
 * Analytics Provider
 * يوفر context للتتبع في كل أنحاء التطبيق
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTracker } from './tracker';
import type { EventType } from './types';

interface AnalyticsContextType {
    sessionId: string | null;
    track: (eventType: EventType, data?: Record<string, unknown>) => void;
    trackStep: (stepIndex: number, stepName?: string) => void;
    trackStepComplete: (stepIndex: number, formData?: Record<string, unknown>) => void;
    trackClick: (buttonId: string, buttonText?: string) => void;
    trackFieldFill: (fieldName: string, stepIndex: number) => void;
    trackFileUpload: (fileType: 'pdf' | 'payment_proof', fileName: string) => void;
    isReady: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const tracker = getTracker();

        tracker.init().then((id) => {
            setSessionId(id);
            setIsReady(true);
            console.log('[Analytics] Initialized with session:', id);
        });
    }, []);

    const track = (eventType: EventType, data?: Record<string, unknown>) => {
        const tracker = getTracker();
        tracker.track(eventType, data);
    };

    const trackStep = (stepIndex: number, stepName?: string) => {
        const tracker = getTracker();
        tracker.trackStep(stepIndex, stepName);
    };

    const trackStepComplete = (stepIndex: number, formData?: Record<string, unknown>) => {
        const tracker = getTracker();
        tracker.trackStepComplete(stepIndex, formData);
    };

    const trackClick = (buttonId: string, buttonText?: string) => {
        const tracker = getTracker();
        tracker.trackClick(buttonId, buttonText);
    };

    const trackFieldFill = (fieldName: string, stepIndex: number) => {
        const tracker = getTracker();
        tracker.trackFieldFill(fieldName, stepIndex);
    };

    const trackFileUpload = (fileType: 'pdf' | 'payment_proof', fileName: string) => {
        const tracker = getTracker();
        tracker.trackFileUpload(fileType, fileName);
    };

    return (
        <AnalyticsContext.Provider
            value={{
                sessionId,
                track,
                trackStep,
                trackStepComplete,
                trackClick,
                trackFieldFill,
                trackFileUpload,
                isReady,
            }}
        >
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics(): AnalyticsContextType {
    const context = useContext(AnalyticsContext);

    if (!context) {
        // Return a no-op version if outside provider
        return {
            sessionId: null,
            track: () => { },
            trackStep: () => { },
            trackStepComplete: () => { },
            trackClick: () => { },
            trackFieldFill: () => { },
            trackFileUpload: () => { },
            isReady: false,
        };
    }

    return context;
}
