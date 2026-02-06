/**
 * Dashboard Stats API
 * يعرض إحصائيات لوحة التحكم
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        // التحقق من المصادقة
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cfAccessEmail = request.headers.get('cf-access-authenticated-user-email');
        const cookies = request.headers.get('cookie') || '';

        if (!isLocalDev && !cfAccessJWT && !cfAccessEmail && !cookies.includes('CF_Authorization')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // الوصول للـ D1 عبر getRequestContext
        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            // في بيئة التطوير، لا يوجد context
            console.log('[Analytics] No Cloudflare context available');
        }

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
