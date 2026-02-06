/**
 * Payment Settings API - جلب إعدادات الدفع العامة
 * GET /api/settings
 */

import { NextResponse } from 'next/server';

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

export async function GET(request: Request) {
    try {
        // محاولة جلب من قاعدة البيانات
        const env = (request as unknown as { env?: { ANALYTICS_DB?: unknown } }).env;

        if (env?.ANALYTICS_DB) {
            const db = env.ANALYTICS_DB as {
                prepare: (sql: string) => {
                    first: <T>() => Promise<T | null>;
                };
            };

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
        }

        // إرجاع القيم الافتراضية
        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    } catch (error) {
        console.error('[Settings API] Error:', error);
        // في حالة الخطأ، إرجاع القيم الافتراضية
        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    }
}
