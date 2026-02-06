/**
 * Sessions List API
 * يعرض قائمة الجلسات مع فلترة وترقيم
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { SessionFilter } from '@/lib/analytics/types';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        // التحقق من المصادقة
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cfAccessEmail = request.headers.get('cf-access-authenticated-user-email');
        const cookies = request.headers.get('cookie') || '';
        const isLocalDev = process.env.NODE_ENV === 'development';

        if (!isLocalDev && !cfAccessJWT && !cookies.includes('CF_Authorization')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;

        // استخراج معايير الفلترة
        const filter: SessionFilter = {
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
            country: searchParams.get('country') || undefined,
            minStep: searchParams.get('minStep') ? parseInt(searchParams.get('minStep')!) : undefined,
            maxStep: searchParams.get('maxStep') ? parseInt(searchParams.get('maxStep')!) : undefined,
            paymentStatus: searchParams.get('paymentStatus') as SessionFilter['paymentStatus'] || undefined,
            isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
            search: searchParams.get('search') || undefined,
        };

        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // الوصول للـ D1 عبر getRequestContext
        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            console.log('[Analytics] No Cloudflare context available');
        }
        const storage = new AnalyticsStorage(db);

        const sessions = await storage.getSessions(filter, limit, offset);

        return NextResponse.json({
            success: true,
            data: sessions,
            pagination: {
                limit,
                offset,
                hasMore: sessions.length === limit,
            },
            authenticatedUser: cfAccessEmail || 'local-dev',
        });

    } catch (error) {
        console.error('[Analytics] Sessions list error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}
