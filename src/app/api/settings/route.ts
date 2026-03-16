/**
 * Payment Settings API - جلب وحفظ إعدادات الدفع
 * GET /api/settings - جلب الإعدادات
 * PUT /api/settings - تحديث الإعدادات (من لوحة التحكم)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// نوع إعدادات الدفع
export interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
    priceUsd?: number;
    priceSyp?: number;
    paymentLanguage?: 'both' | 'ar' | 'en';
    defaultPaymentImage?: boolean;
}

// القيم الافتراضية
const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 500,
    currency: 'ل.س',
    paymentType: 'mandatory',
    priceUsd: 5,
    priceSyp: 50000,
    paymentLanguage: 'both',
    defaultPaymentImage: true,
};

export const runtime = 'edge';

export async function GET() {
    try {
        // محاولة جلب من قاعدة البيانات
        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            console.log('[Settings] No Cloudflare context available');
        }

        if (db) {
            try {
                const row = await db.prepare(
                    'SELECT * FROM payment_settings WHERE id = 1'
                ).first();

                if (row) {
                    return NextResponse.json({
                        success: true,
                        data: {
                            qrImageUrl: row.qr_image_url as string,
                            recipientName: row.recipient_name as string,
                            recipientCode: row.recipient_code as string,
                            amount: row.amount as number,
                            currency: row.currency as string,
                            paymentType: row.payment_type as PaymentSettings['paymentType'],
                            priceUsd: row.price_usd as number ?? 5,
                            priceSyp: row.price_syp as number ?? 50000,
                            paymentLanguage: row.payment_language as string ?? 'both',
                            defaultPaymentImage: row.default_payment_image !== 0,
                        },
                    });
                }
            } catch (dbError) {
                console.error('[Settings] DB Error:', dbError);
            }
        }

        // إرجاع القيم الافتراضية
        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    } catch (error) {
        console.error('[Settings API] Error:', error);
        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            console.log('[Settings PUT] No Cloudflare context available');
        }

        if (!db) {
            return NextResponse.json({
                success: false,
                error: 'Database not available',
            }, { status: 503 });
        }

        // تحديث الإعدادات في D1
        await db.prepare(`
            UPDATE payment_settings SET
                payment_type = ?,
                price_usd = ?,
                price_syp = ?,
                payment_language = ?,
                default_payment_image = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `).bind(
            body.paymentType || 'mandatory',
            body.priceUsd ?? 5,
            body.priceSyp ?? 50000,
            body.paymentLanguage || 'both',
            body.defaultPaymentImage !== false ? 1 : 0,
        ).run();

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully',
        });
    } catch (error) {
        console.error('[Settings PUT] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
