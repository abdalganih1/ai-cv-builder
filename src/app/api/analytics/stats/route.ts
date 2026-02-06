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
        // إذا وصل الطلب لهنا، فإما:
        // 1. بيئة تطوير
        // 2. أو مصادق عبر Cloudflare Access (لأن Access يعترض قبل الوصول)
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cfAccessEmail = request.headers.get('cf-access-authenticated-user-email');

        // في الإنتاج بدون أي header من Access، نرفض
        // لكن إذا Access مفعّل على المسار، الطلب لن يصل أصلاً بدون JWT
        if (!isLocalDev && !cfAccessJWT && !cfAccessEmail) {
            // تحقق إضافي: إذا كان هناك cookie من CF
            const cookies = request.headers.get('cookie') || '';
            if (!cookies.includes('CF_Authorization')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
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
