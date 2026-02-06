/**
 * Session Detail API
 * يعرض تفاصيل جلسة معينة مع كل الأحداث
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';

export const runtime = 'edge';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // التحقق من المصادقة
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');

        if (!isLocalDev && !cfAccessJWT) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        // @ts-expect-error - Cloudflare D1 binding
        const db = request.cf?.env?.ANALYTICS_DB || null;
        const storage = new AnalyticsStorage(db);

        const session = await storage.getSession(id);

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const events = await storage.getSessionEvents(id);

        return NextResponse.json({
            success: true,
            data: {
                session,
                events,
                timeline: events.map(e => ({
                    time: e.timestamp,
                    type: e.eventType,
                    details: e.eventData,
                    step: e.stepIndex,
                })),
            },
        });

    } catch (error) {
        console.error('[Analytics] Session detail error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch session' },
            { status: 500 }
        );
    }
}
