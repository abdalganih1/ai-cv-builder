/**
 * Dashboard Stats API
 * يعرض إحصائيات لوحة التحكم
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        // التحقق من المصادقة
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');

        if (!isLocalDev && !cfAccessJWT) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-expect-error - Cloudflare D1 binding
        const db = request.cf?.env?.ANALYTICS_DB || null;
        const storage = new AnalyticsStorage(db);

        const stats = await storage.getDashboardStats();

        return NextResponse.json({
            success: true,
            data: stats,
            generatedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[Analytics] Stats error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
