'use client';

/**
 * Analytics Provider
 * يوفر context للتتبع في كل أنحاء التطبيق
 * يدعم الآن: تتبع متقدم، تسجيل الأخطاء
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTracker } from './tracker';
import { getErrorLogger } from './errorLogger';
import type { EventType, AdvancedSessionData } from './types';

// ======================== Types ========================

interface SourceData {
    id: string;
    type: 'url' | 'pdf';
    value: string;
    detectedType?: 'personal' | 'job' | 'unknown';
}

interface ChatMessageData {
    id: string;
    content: string;
    changes?: Record<string, unknown>;
}

interface AnalyticsContextType {
    // Session Info
    sessionId: string | null;
    isReady: boolean;
    advancedData: AdvancedSessionData | null;

    // Basic Tracking
    track: (eventType: EventType, data?: Record<string, unknown>) => void;
    trackStep: (stepIndex: number, stepName?: string) => void;
    trackStepComplete: (stepIndex: number, formData?: Record<string, unknown>) => void;
    trackClick: (buttonId: string, buttonText?: string) => void;
    trackFieldFill: (fieldName: string, stepIndex: number) => void;
    trackFileUpload: (fileType: 'pdf' | 'payment_proof', fileName: string) => void;

    // Advanced Mode Tracking
    trackAdvancedModeStart: () => void;
    trackSourceAdded: (source: SourceData) => void;
    trackSourceRemoved: (sourceId: string) => void;
    trackSourceTypeChanged: (sourceId: string, newType: 'personal' | 'job' | 'unknown') => void;

    // Analysis Tracking
    trackAnalysisStarted: (sourcesCount: number, hasText: boolean) => void;
    trackAnalysisCompleted: (result?: Record<string, unknown>) => void;
    trackAnalysisFailed: (error: string) => void;

    // Chat Tracking
    trackChatMessageSent: (message: ChatMessageData) => void;
    trackChatResponseReceived: (message: ChatMessageData) => void;
    trackCVEditApplied: (changes: Record<string, unknown>) => void;
}

// ======================== Context ========================

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

// ======================== Provider ========================

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [advancedData, setAdvancedData] = useState<AdvancedSessionData | null>(null);

    useEffect(() => {
        const tracker = getTracker();
        const errorLogger = getErrorLogger();

        // Initialize both tracker and error logger
        tracker.init().then((id) => {
            setSessionId(id);
            setAdvancedData(tracker.getAdvancedData());
            setIsReady(true);
            console.log('[Analytics] Initialized with session:', id);
        });

        errorLogger.init();
        console.log('[ErrorLogger] Initialized');
    }, []);

    // ======================== Basic Tracking ========================

    const track = (eventType: EventType, data?: Record<string, unknown>) => {
        getTracker().track(eventType, data);
    };

    const trackStep = (stepIndex: number, stepName?: string) => {
        getTracker().trackStep(stepIndex, stepName);
    };

    const trackStepComplete = (stepIndex: number, formData?: Record<string, unknown>) => {
        getTracker().trackStepComplete(stepIndex, formData);
    };

    const trackClick = (buttonId: string, buttonText?: string) => {
        getTracker().trackClick(buttonId, buttonText);
    };

    const trackFieldFill = (fieldName: string, stepIndex: number) => {
        getTracker().trackFieldFill(fieldName, stepIndex);
    };

    const trackFileUpload = (fileType: 'pdf' | 'payment_proof', fileName: string) => {
        getTracker().trackFileUpload(fileType, fileName);
    };

    // ======================== Advanced Mode Tracking ========================

    const trackAdvancedModeStart = () => {
        getTracker().trackAdvancedModeStart();
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackSourceAdded = (source: SourceData) => {
        getTracker().trackSourceAdded(source);
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackSourceRemoved = (sourceId: string) => {
        getTracker().trackSourceRemoved(sourceId);
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackSourceTypeChanged = (sourceId: string, newType: 'personal' | 'job' | 'unknown') => {
        getTracker().trackSourceTypeChanged(sourceId, newType);
        setAdvancedData(getTracker().getAdvancedData());
    };

    // ======================== Analysis Tracking ========================

    const trackAnalysisStarted = (sourcesCount: number, hasText: boolean) => {
        getTracker().trackAnalysisStarted({ sources: [], additionalText: hasText ? 'yes' : '' });
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackAnalysisCompleted = (result?: Record<string, unknown>) => {
        getTracker().trackAnalysisCompleted({ result });
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackAnalysisFailed = (error: string) => {
        getTracker().trackAnalysisFailed(error);
        setAdvancedData(getTracker().getAdvancedData());
    };

    // ======================== Chat Tracking ========================

    const trackChatMessageSent = (message: ChatMessageData) => {
        getTracker().trackChatMessageSent(message);
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackChatResponseReceived = (message: ChatMessageData) => {
        getTracker().trackChatResponseReceived(message);
        setAdvancedData(getTracker().getAdvancedData());
    };

    const trackCVEditApplied = (changes: Record<string, unknown>) => {
        getTracker().trackCVEditApplied(changes);
        setAdvancedData(getTracker().getAdvancedData());
    };

    // ======================== Render ========================

    return (
        <AnalyticsContext.Provider
            value={{
                sessionId,
                isReady,
                advancedData,
                track,
                trackStep,
                trackStepComplete,
                trackClick,
                trackFieldFill,
                trackFileUpload,
                trackAdvancedModeStart,
                trackSourceAdded,
                trackSourceRemoved,
                trackSourceTypeChanged,
                trackAnalysisStarted,
                trackAnalysisCompleted,
                trackAnalysisFailed,
                trackChatMessageSent,
                trackChatResponseReceived,
                trackCVEditApplied,
            }}
        >
            {children}
        </AnalyticsContext.Provider>
    );
}

// ======================== Hook ========================

export function useAnalytics(): AnalyticsContextType {
    const context = useContext(AnalyticsContext);

    if (!context) {
        // Return a no-op version if outside provider
        return {
            sessionId: null,
            isReady: false,
            advancedData: null,
            track: () => { },
            trackStep: () => { },
            trackStepComplete: () => { },
            trackClick: () => { },
            trackFieldFill: () => { },
            trackFileUpload: () => { },
            trackAdvancedModeStart: () => { },
            trackSourceAdded: () => { },
            trackSourceRemoved: () => { },
            trackSourceTypeChanged: () => { },
            trackAnalysisStarted: () => { },
            trackAnalysisCompleted: () => { },
            trackAnalysisFailed: () => { },
            trackChatMessageSent: () => { },
            trackChatResponseReceived: () => { },
            trackCVEditApplied: () => { },
        };
    }

    return context;
}

