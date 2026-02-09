/**
 * Error Analytics API - استقبال وجلب سجل الأخطاء
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ErrorLogEntry } from '@/lib/analytics/types';

// تخزين مؤقت للأخطاء (في الإنتاج يجب استخدام D1)
const errorStore: ErrorLogEntry[] = [];
const MAX_ERRORS = 500;

/**
 * POST - تسجيل أخطاء جديدة
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { errors } = body as { errors: ErrorLogEntry[] };

        if (!Array.isArray(errors)) {
            return NextResponse.json({ error: 'Invalid errors format' }, { status: 400 });
        }

        // إضافة الأخطاء للتخزين
        for (const error of errors) {
            errorStore.unshift({
                ...error,
                id: error.id || `err_${Date.now().toString(36)}`,
                timestamp: error.timestamp || new Date().toISOString(),
            });
        }

        // الحفاظ على حد أقصى
        if (errorStore.length > MAX_ERRORS) {
            errorStore.splice(MAX_ERRORS);
        }

        // طباعة للـ console للـ debugging
        console.log(`[ErrorAPI] Received ${errors.length} errors:`, errors.map(e => ({
            type: e.type,
            statusCode: e.statusCode,
            url: e.url,
            message: e.message?.substring(0, 100),
        })));

        return NextResponse.json({
            success: true,
            received: errors.length,
            total: errorStore.length,
        });

    } catch (error) {
        console.error('[ErrorAPI] Failed to process errors:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET - جلب سجل الأخطاء
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const type = searchParams.get('type'); // fetch, runtime, unhandled
        const statusCode = searchParams.get('statusCode');
        const sessionId = searchParams.get('sessionId');

        let filtered = [...errorStore];

        // فلترة حسب النوع
        if (type) {
            filtered = filtered.filter(e => e.type === type);
        }

        // فلترة حسب كود الحالة
        if (statusCode) {
            filtered = filtered.filter(e => e.statusCode === parseInt(statusCode));
        }

        // فلترة حسب الجلسة
        if (sessionId) {
            filtered = filtered.filter(e => e.sessionId === sessionId);
        }

        // تطبيق الـ pagination
        const paginated = filtered.slice(offset, offset + limit);

        // إحصائيات سريعة
        const stats = {
            total: filtered.length,
            byType: {
                fetch: errorStore.filter(e => e.type === 'fetch').length,
                runtime: errorStore.filter(e => e.type === 'runtime').length,
                unhandled: errorStore.filter(e => e.type === 'unhandled').length,
            },
            byStatusCode: {} as Record<number, number>,
        };

        // حساب توزيع أكواد الحالة
        errorStore.filter(e => e.statusCode).forEach(e => {
            const code = e.statusCode!;
            stats.byStatusCode[code] = (stats.byStatusCode[code] || 0) + 1;
        });

        return NextResponse.json({
            success: true,
            data: paginated,
            stats,
            pagination: {
                limit,
                offset,
                total: filtered.length,
                hasMore: offset + limit < filtered.length,
            },
        });

    } catch (error) {
        console.error('[ErrorAPI] Failed to get errors:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE - مسح سجل الأخطاء
 */
export async function DELETE() {
    errorStore.length = 0;
    return NextResponse.json({
        success: true,
        message: 'Error log cleared',
    });
}
