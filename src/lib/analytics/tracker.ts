'use client';

/**
 * Client-side Analytics Tracker
 * يتتبع سلوك المستخدم ويرسل الأحداث للخادم
 */

import type { EventType, TrackRequest, TrackResponse } from './types';

const STORAGE_KEY = 'cv_analytics_session';
const API_ENDPOINT = '/api/analytics/track';

class AnalyticsTracker {
    private sessionId: string | null = null;
    private isInitialized = false;
    private eventQueue: TrackRequest[] = [];
    private flushTimeout: NodeJS.Timeout | null = null;

    /**
     * تهيئة المتتبع - يُستدعى مرة واحدة عند تحميل الصفحة
     */
    async init(): Promise<string> {
        if (this.isInitialized && this.sessionId) {
            return this.sessionId;
        }

        // محاولة استعادة الجلسة من التخزين المحلي
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // تحقق أن الجلسة لم تنتهِ (أقل من 30 دقيقة من عدم النشاط)
                const lastActivity = new Date(data.lastActivity).getTime();
                const now = Date.now();
                if (now - lastActivity < 30 * 60 * 1000) {
                    this.sessionId = data.sessionId;
                    this.isInitialized = true;
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
        this.saveSession();

        // إرسال حدث بدء الجلسة
        await this.track('session_start');

        // إعداد مستمعي الأحداث
        this.setupEventListeners();

        return this.sessionId;
    }

    /**
     * تتبع حدث
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

        // إضافة للقائمة وإرسال بشكل مجمع لتحسين الأداء
        this.eventQueue.push(request);
        this.updateLastActivity();

        // إرسال فوري للأحداث المهمة
        const immediateEvents: EventType[] = ['session_start', 'payment_proof_upload', 'page_exit'];
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

    /**
     * الحصول على معرف الجلسة
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    // ======================== Private Methods ========================

    private generateSessionId(): string {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substring(2, 9);
        return `${timestamp}-${randomPart}`;
    }

    private saveSession(): void {
        if (typeof window === 'undefined') return;

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            sessionId: this.sessionId,
            lastActivity: new Date().toISOString(),
        }));
    }

    private updateLastActivity(): void {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            data.lastActivity = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimeout) return;

        this.flushTimeout = setTimeout(() => {
            this.flush();
            this.flushTimeout = null;
        }, 2000); // إرسال كل 2 ثانية
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
                keepalive: true, // للتأكد من الإرسال حتى عند إغلاق الصفحة
            });

            if (!response.ok) {
                // إعادة الأحداث للقائمة عند الفشل
                this.eventQueue.unshift(...events);
                return null;
            }

            return response.json();
        } catch (error) {
            console.error('[Analytics] Failed to send events:', error);
            // إعادة الأحداث للقائمة عند الفشل
            this.eventQueue.unshift(...events);
            return null;
        }
    }

    private setupEventListeners(): void {
        if (typeof window === 'undefined') return;

        // تتبع رؤية الصفحة (tab visible/hidden)
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
            this.flush(); // إرسال فوري
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

// Singleton instance
let trackerInstance: AnalyticsTracker | null = null;

export function getTracker(): AnalyticsTracker {
    if (!trackerInstance) {
        trackerInstance = new AnalyticsTracker();
    }
    return trackerInstance;
}

export default AnalyticsTracker;
