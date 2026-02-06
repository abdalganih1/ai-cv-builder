/**
 * Payment Settings API - جلب إعدادات الدفع العامة
 * GET /api/settings
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

// نوع إعدادات الدفع
export interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
}

// القيم الافتراضية
const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 500,
    currency: 'ل.س',
    paymentType: 'mandatory',
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
                ).first<Record<string, unknown>>();

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
