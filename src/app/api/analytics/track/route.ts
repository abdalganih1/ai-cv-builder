/**
 * Analytics Tracking API
 * يستقبل أحداث التتبع من المتصفح ويخزنها في D1
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';
import type { TrackRequest, CFRequestInfo, AnalyticsEvent, EventType } from '@/lib/analytics/types';

// استخراج معلومات Cloudflare من الـ headers
function getCFInfo(request: NextRequest): CFRequestInfo {
    const headers = request.headers;

    return {
        ip: headers.get('cf-connecting-ip') ||
            headers.get('x-forwarded-for')?.split(',')[0] ||
            headers.get('x-real-ip') ||
            'unknown',
        country: headers.get('cf-ipcountry') || undefined,
        city: headers.get('cf-ipcity') || undefined,
        userAgent: headers.get('user-agent') || 'unknown',
        cfRay: headers.get('cf-ray') || undefined,
    };
}

// التحقق من صحة نوع الحدث
function isValidEventType(type: string): type is EventType {
    const validTypes: EventType[] = [
        'page_view', 'step_view', 'step_complete', 'form_field_fill',
        'button_click', 'file_upload', 'pdf_upload', 'payment_proof_upload',
        'tab_visible', 'tab_hidden', 'page_exit', 'session_start', 'session_end', 'error'
    ];
    return validTypes.includes(type as EventType);
}

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const cfInfo = getCFInfo(request);

        // الحصول على D1 من بيئة Cloudflare (إذا متوفر)
        // @ts-expect-error - Cloudflare D1 binding
        const db = request.cf?.env?.ANALYTICS_DB || null;
        const storage = new AnalyticsStorage(db);

        // التعامل مع أحداث متعددة (batch)
        const events: TrackRequest[] = body.events || [body];

        if (!events.length) {
            return NextResponse.json({ success: false, message: 'No events provided' }, { status: 400 });
        }

        let sessionId = events[0].sessionId;

        for (const event of events) {
            if (!event.eventType || !isValidEventType(event.eventType)) {
                console.warn('[Analytics] Invalid event type:', event.eventType);
                continue;
            }

            // استخدام نفس الـ session ID لكل الأحداث
            sessionId = event.sessionId || sessionId;

            if (!sessionId) {
                console.warn('[Analytics] Missing session ID');
                continue;
            }

            // تحديث/إنشاء الجلسة
            await storage.upsertSession(sessionId, {
                currentStep: event.stepIndex,
                formData: event.formData,
            }, cfInfo);

            // تسجيل الحدث
            const analyticsEvent: AnalyticsEvent = {
                sessionId,
                eventType: event.eventType,
                eventData: event.eventData,
                stepIndex: event.stepIndex,
                pageUrl: event.pageUrl,
                timestamp: new Date().toISOString(),
            };

            await storage.recordEvent(analyticsEvent);
        }

        return NextResponse.json({
            success: true,
            sessionId,
            message: `Recorded ${events.length} event(s)`,
        });

    } catch (error) {
        console.error('[Analytics] Track error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to track event' },
            { status: 500 }
        );
    }
}

// للتطوير المحلي - عرض حالة API
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Analytics tracking API is running',
        timestamp: new Date().toISOString(),
    });
}
