'use client';

/**
 * Error Logger - نظام تسجيل الأخطاء
 * يلتقط أخطاء HTTP وأخطاء Runtime ويرسلها للخادم
 */

import type { ErrorLogEntry } from './types';

const ERROR_API_ENDPOINT = '/api/analytics/errors';
const ERROR_STORAGE_KEY = 'cv_error_log';
const MAX_STORED_ERRORS = 50;

class ErrorLogger {
    private errorQueue: ErrorLogEntry[] = [];
    private isIntercepting = false;
    private flushTimeout: NodeJS.Timeout | null = null;
    private originalFetch: typeof fetch | null = null;

    /**
     * تهيئة مسجل الأخطاء
     */
    init(): void {
        if (typeof window === 'undefined') return;

        // استعادة الأخطاء غير المرسلة
        this.loadStoredErrors();

        // إعداد اعتراض fetch
        this.interceptFetch();

        // إعداد مستمعي الأخطاء
        this.setupErrorListeners();

        // إرسال الأخطاء المخزنة
        this.scheduleFlush();
    }

    /**
     * تسجيل خطأ جديد
     */
    logError(entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>): void {
        const fullEntry: ErrorLogEntry = {
            ...entry,
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(),
        };

        this.errorQueue.push(fullEntry);
        this.saveErrors();
        this.scheduleFlush();

        // طباعة للـ console أيضاً
        console.error('[ErrorLogger]', fullEntry);
    }

    /**
     * تسجيل خطأ fetch
     */
    logFetchError(url: string, method: string, statusCode: number, message: string, context?: Record<string, unknown>): void {
        this.logError({
            type: 'fetch',
            url,
            method,
            statusCode,
            message,
            context,
        });
    }

    /**
     * اعتراض fetch للتقاط أخطاء HTTP
     */
    private interceptFetch(): void {
        if (this.isIntercepting || typeof window === 'undefined') return;

        this.originalFetch = window.fetch;
        const logger = this;

        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            const method = init?.method || 'GET';

            try {
                const response = await logger.originalFetch!.call(window, input, init);

                // تسجيل أخطاء HTTP (4xx, 5xx)
                if (!response.ok && response.status >= 400) {
                    // تجاهل بعض الـ endpoints
                    const ignorePatterns = ['/api/analytics', '/_next', '/favicon'];
                    const shouldIgnore = ignorePatterns.some(pattern => url.includes(pattern));

                    if (!shouldIgnore) {
                        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                        try {
                            const clonedResponse = response.clone();
                            const errorBody = await clonedResponse.json();
                            if (errorBody.error || errorBody.message) {
                                errorMessage = errorBody.error || errorBody.message;
                            }
                        } catch {
                            // تجاهل أخطاء parsing
                        }

                        logger.logFetchError(url, method, response.status, errorMessage);
                    }
                }

                return response;
            } catch (error) {
                // خطأ شبكة
                logger.logFetchError(url, method, 0, error instanceof Error ? error.message : 'Network Error', {
                    errorType: 'network',
                });
                throw error;
            }
        };

        this.isIntercepting = true;
    }

    /**
     * إعداد مستمعي الأخطاء
     */
    private setupErrorListeners(): void {
        if (typeof window === 'undefined') return;

        // أخطاء JavaScript غير الملتقطة
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'runtime',
                message: event.message,
                stack: event.error?.stack,
                context: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
            });
        });

        // Promise rejections غير الملتقطة
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'unhandled',
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
            });
        });
    }

    /**
     * جدولة إرسال الأخطاء
     */
    private scheduleFlush(): void {
        if (this.flushTimeout) return;

        this.flushTimeout = setTimeout(() => {
            this.flush();
            this.flushTimeout = null;
        }, 3000);
    }

    /**
     * إرسال الأخطاء للخادم
     */
    private async flush(): Promise<void> {
        if (this.errorQueue.length === 0) return;

        const errors = [...this.errorQueue];
        this.errorQueue = [];

        try {
            // استخدام originalFetch لتجنب الحلقة اللانهائية
            const fetchFn = this.originalFetch || fetch;
            const response = await fetchFn(ERROR_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ errors }),
                keepalive: true,
            });

            if (!response.ok) {
                // إعادة للقائمة
                this.errorQueue.unshift(...errors);
            } else {
                // مسح التخزين المحلي
                localStorage.removeItem(ERROR_STORAGE_KEY);
            }
        } catch {
            // إعادة للقائمة
            this.errorQueue.unshift(...errors);
            this.saveErrors();
        }
    }

    /**
     * حفظ الأخطاء في التخزين المحلي
     */
    private saveErrors(): void {
        if (typeof window === 'undefined') return;

        const toStore = this.errorQueue.slice(-MAX_STORED_ERRORS);
        localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(toStore));
    }

    /**
     * تحميل الأخطاء المخزنة
     */
    private loadStoredErrors(): void {
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(ERROR_STORAGE_KEY);
            if (stored) {
                this.errorQueue = JSON.parse(stored);
            }
        } catch {
            // تجاهل
        }
    }

    /**
     * توليد معرف فريد
     */
    private generateId(): string {
        return `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    }

    /**
     * الحصول على معرف الجلسة
     */
    private getSessionId(): string | undefined {
        if (typeof window === 'undefined') return undefined;

        try {
            const stored = localStorage.getItem('cv_analytics_session');
            if (stored) {
                return JSON.parse(stored).sessionId;
            }
        } catch {
            // تجاهل
        }
        return undefined;
    }

    /**
     * جلب الأخطاء المحلية (للـ debugging)
     */
    getLocalErrors(): ErrorLogEntry[] {
        return [...this.errorQueue];
    }
}

// Singleton instance
let loggerInstance: ErrorLogger | null = null;

export function getErrorLogger(): ErrorLogger {
    if (!loggerInstance) {
        loggerInstance = new ErrorLogger();
    }
    return loggerInstance;
}

export default ErrorLogger;
