'use client';

/**
 * Client-side Analytics Tracker
 * يتتبع سلوك المستخدم ويرسل الأحداث للخادم
 * يدعم الآن: الوضع المتقدم، تتبع المصادر، تتبع التحليل، تتبع الدردشة
 */

import type { EventType, TrackRequest, TrackResponse, AdvancedSessionData } from './types';

const STORAGE_KEY = 'cv_analytics_session';
const ADVANCED_DATA_KEY = 'cv_advanced_session_data';
const API_ENDPOINT = '/api/analytics/track';

// In-memory fallback when localStorage is unavailable (iOS private browsing)
const memoryStorage: Record<string, string> = {};

/** Safely check if localStorage is available without triggering iOS popup */
function isLocalStorageAvailable(): boolean {
    try {
        const testKey = '__ls_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

function safeGetItem(key: string): string | null {
    try {
        if (isLocalStorageAvailable()) {
            return localStorage.getItem(key);
        }
    } catch { /* ignore */ }
    return memoryStorage[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
    try {
        if (isLocalStorageAvailable()) {
            localStorage.setItem(key, value);
            return;
        }
    } catch { /* ignore */ }
    memoryStorage[key] = value;
}

// ======================== Interfaces ========================

interface SourceData {
    id: string;
    type: 'url' | 'pdf';
    value: string;
    detectedType?: 'personal' | 'job' | 'unknown';
}

interface AnalysisData {
    sources?: SourceData[];
    additionalText?: string;
    result?: Record<string, unknown>;
    error?: string;
}

interface ChatMessageData {
    id: string;
    content: string;
    changes?: Record<string, unknown>;
}

// ======================== Main Class ========================

class AnalyticsTracker {
    private sessionId: string | null = null;
    private isInitialized = false;
    private eventQueue: TrackRequest[] = [];
    private flushTimeout: NodeJS.Timeout | null = null;
    private advancedData: AdvancedSessionData | null = null;

    // ======================== Initialization ========================

    /**
     * تهيئة المتتبع - يُستدعى مرة واحدة عند تحميل الصفحة
     */
    async init(): Promise<string> {
        if (this.isInitialized && this.sessionId) {
            return this.sessionId;
        }

        // محاولة استعادة الجلسة من التخزين المحلي
        const stored = safeGetItem(STORAGE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // تحقق أن الجلسة لم تنتهِ (أقل من 30 دقيقة من عدم النشاط)
                const lastActivity = new Date(data.lastActivity).getTime();
                const now = Date.now();
                if (now - lastActivity < 30 * 60 * 1000) {
                    this.sessionId = data.sessionId;
                    this.isInitialized = true;
                    this.loadAdvancedData();
                    this.updateLastActivity();
                    return this.sessionId!;
                }
            } catch {
                // تجاهل أخطاء الـ parsing
            }
        }

        // إنشاء جلسة جديدة
        this.sessionId = this.generateSessionId();
        this.isInitialized = true;
        this.initAdvancedData();
        this.saveSession();

        // إرسال حدث بدء الجلسة
        await this.track('session_start');

        // إعداد مستمعي الأحداث
        this.setupEventListeners();

        return this.sessionId;
    }

    // ======================== Basic Tracking ========================

    /**
     * تتبع حدث أساسي
     */
    async track(
        eventType: EventType,
        eventData?: Record<string, unknown>,
        options?: { stepIndex?: number; formData?: Record<string, unknown> }
    ): Promise<TrackResponse | null> {
        if (!this.sessionId) {
            await this.init();
        }

        const request: TrackRequest = {
            sessionId: this.sessionId!,
            eventType,
            eventData,
            stepIndex: options?.stepIndex,
            pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
            formData: options?.formData,
        };

        // إضافة للقائمة
        this.eventQueue.push(request);
        this.updateLastActivity();

        // إرسال فوري للأحداث المهمة
        const immediateEvents: EventType[] = [
            'session_start',
            'payment_proof_upload',
            'page_exit',
            'analysis_completed',
            'analysis_failed',
            'api_error'
        ];

        if (immediateEvents.includes(eventType)) {
            return this.flush();
        }

        // إرسال مؤجل للأحداث الأخرى
        this.scheduleFlush();
        return null;
    }

    /**
     * تتبع دخول خطوة
     */
    trackStep(stepIndex: number, stepName?: string): Promise<TrackResponse | null> {
        return this.track('step_view', { stepName }, { stepIndex });
    }

    /**
     * تتبع إكمال خطوة
     */
    trackStepComplete(stepIndex: number, formData?: Record<string, unknown>): Promise<TrackResponse | null> {
        return this.track('step_complete', { stepIndex }, { stepIndex, formData });
    }

    /**
     * تتبع ملء حقل
     */
    trackFieldFill(fieldName: string, stepIndex: number): Promise<TrackResponse | null> {
        return this.track('form_field_fill', { fieldName }, { stepIndex });
    }

    /**
     * تتبع رفع ملف
     */
    trackFileUpload(fileType: 'pdf' | 'payment_proof', fileName: string): Promise<TrackResponse | null> {
        const eventType: EventType = fileType === 'pdf' ? 'pdf_upload' : 'payment_proof_upload';
        return this.track(eventType, { fileName });
    }

    /**
     * تتبع نقر زر
     */
    trackClick(buttonId: string, buttonText?: string): Promise<TrackResponse | null> {
        return this.track('button_click', { buttonId, buttonText });
    }

    // ======================== Advanced Mode Tracking ========================

    /**
     * تتبع بدء الوضع المتقدم
     */
    trackAdvancedModeStart(): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.mode = 'advanced';
            this.saveAdvancedData();
        }
        return this.track('advanced_mode_start');
    }

    /**
     * تتبع إضافة مصدر (URL أو PDF)
     */
    trackSourceAdded(source: SourceData): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.sources.push({
                ...source,
                detectedType: source.detectedType || 'unknown',
                addedAt: new Date().toISOString(),
            });
            this.saveAdvancedData();
        }
        return this.track('source_added', {
            sourceId: source.id,
            sourceType: source.type,
            sourceValue: source.value,
            detectedType: source.detectedType,
        });
    }

    /**
     * تتبع حذف مصدر
     */
    trackSourceRemoved(sourceId: string): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.sources = this.advancedData.sources.filter(s => s.id !== sourceId);
            this.saveAdvancedData();
        }
        return this.track('source_removed', { sourceId });
    }

    /**
     * تتبع تغيير نوع المصدر
     */
    trackSourceTypeChanged(sourceId: string, newType: 'personal' | 'job' | 'unknown'): Promise<TrackResponse | null> {
        if (this.advancedData) {
            const source = this.advancedData.sources.find(s => s.id === sourceId);
            if (source) {
                source.detectedType = newType;
                this.saveAdvancedData();
            }
        }
        return this.track('source_type_changed', { sourceId, newType });
    }

    // ======================== Analysis Tracking ========================

    /**
     * تتبع بدء التحليل
     */
    trackAnalysisStarted(data: AnalysisData): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.analysisResult = {
                startedAt: new Date().toISOString(),
            };
            this.saveAdvancedData();
        }
        return this.track('analysis_started', {
            sourcesCount: data.sources?.length || 0,
            hasAdditionalText: !!data.additionalText,
        });
    }

    /**
     * تتبع اكتمال التحليل
     */
    trackAnalysisCompleted(data: AnalysisData): Promise<TrackResponse | null> {
        if (this.advancedData && this.advancedData.analysisResult) {
            this.advancedData.analysisResult.completedAt = new Date().toISOString();
            this.advancedData.analysisResult.cvData = data.result;
            this.saveAdvancedData();
        }
        return this.track('analysis_completed', {
            success: true,
            hasJobProfile: !!data.result?.jobProfile,
        });
    }

    /**
     * تتبع فشل التحليل
     */
    trackAnalysisFailed(error: string): Promise<TrackResponse | null> {
        if (this.advancedData && this.advancedData.analysisResult) {
            this.advancedData.analysisResult.error = error;
            this.saveAdvancedData();
        }
        return this.track('analysis_failed', { error });
    }

    // ======================== Chat Tracking ========================

    /**
     * تتبع إرسال رسالة دردشة
     */
    trackChatMessageSent(message: ChatMessageData): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.chatHistory.push({
                id: message.id,
                role: 'user',
                content: message.content,
                timestamp: new Date().toISOString(),
            });
            this.saveAdvancedData();
        }
        return this.track('chat_message_sent', {
            messageId: message.id,
            contentLength: message.content.length,
        });
    }

    /**
     * تتبع استلام رد الدردشة
     */
    trackChatResponseReceived(message: ChatMessageData): Promise<TrackResponse | null> {
        if (this.advancedData) {
            this.advancedData.chatHistory.push({
                id: message.id,
                role: 'assistant',
                content: message.content,
                timestamp: new Date().toISOString(),
                changes: message.changes,
            });
            this.saveAdvancedData();
        }
        return this.track('chat_response_received', {
            messageId: message.id,
            hasChanges: !!message.changes,
        });
    }

    /**
     * تتبع تطبيق تعديل على السيرة
     */
    trackCVEditApplied(changes: Record<string, unknown>): Promise<TrackResponse | null> {
        return this.track('cv_edit_applied', {
            changedFields: Object.keys(changes),
            timestamp: new Date().toISOString(),
        });
    }

    // ======================== Error Tracking ========================

    /**
     * تتبع خطأ API
     */
    trackApiError(url: string, statusCode: number, error: string): Promise<TrackResponse | null> {
        return this.track('api_error', {
            url,
            statusCode,
            error,
            timestamp: new Date().toISOString(),
        });
    }

    // ======================== Getters ========================

    /**
     * الحصول على معرف الجلسة
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * الحصول على بيانات الجلسة المتقدمة
     */
    getAdvancedData(): AdvancedSessionData | null {
        return this.advancedData;
    }

    // ======================== Private Methods ========================

    private generateSessionId(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 9);
        return `${timestamp}-${randomPart}`;
    }

    private saveSession(): void {
        if (typeof window === 'undefined') return;

        safeSetItem(STORAGE_KEY, JSON.stringify({
            sessionId: this.sessionId,
            lastActivity: new Date().toISOString(),
        }));
    }

    private updateLastActivity(): void {
        if (typeof window === 'undefined') return;

        const stored = safeGetItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            data.lastActivity = new Date().toISOString();
            safeSetItem(STORAGE_KEY, JSON.stringify(data));
        }
    }

    private initAdvancedData(): void {
        this.advancedData = {
            mode: 'simple',
            sources: [],
            chatHistory: [],
        };
        this.saveAdvancedData();
    }

    private loadAdvancedData(): void {
        if (typeof window === 'undefined') return;

        try {
            const stored = safeGetItem(ADVANCED_DATA_KEY);
            if (stored) {
                this.advancedData = JSON.parse(stored);
            } else {
                this.initAdvancedData();
            }
        } catch {
            this.initAdvancedData();
        }
    }

    private saveAdvancedData(): void {
        if (typeof window === 'undefined' || !this.advancedData) return;
        safeSetItem(ADVANCED_DATA_KEY, JSON.stringify(this.advancedData));
    }

    private scheduleFlush(): void {
        if (this.flushTimeout) return;

        this.flushTimeout = setTimeout(() => {
            this.flush();
            this.flushTimeout = null;
        }, 2000);
    }

    private async flush(): Promise<TrackResponse | null> {
        if (this.eventQueue.length === 0) return null;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events }),
                keepalive: true,
            });

            if (!response.ok) {
                this.eventQueue.unshift(...events);
                return null;
            }

            return response.json();
        } catch (error) {
            console.error('[Analytics] Failed to send events:', error);
            this.eventQueue.unshift(...events);
            return null;
        }
    }

    private setupEventListeners(): void {
        if (typeof window === 'undefined') return;

        // تتبع رؤية الصفحة
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.track('tab_hidden');
            } else {
                this.track('tab_visible');
            }
        });

        // تتبع مغادرة الصفحة
        window.addEventListener('beforeunload', () => {
            this.track('page_exit');
            this.flush();
        });

        // تتبع الأخطاء
        window.addEventListener('error', (event) => {
            this.track('error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
            });
        });
    }
}

// ======================== Singleton Export ========================

let trackerInstance: AnalyticsTracker | null = null;

export function getTracker(): AnalyticsTracker {
    if (!trackerInstance) {
        trackerInstance = new AnalyticsTracker();
    }
    return trackerInstance;
}

export default AnalyticsTracker;

