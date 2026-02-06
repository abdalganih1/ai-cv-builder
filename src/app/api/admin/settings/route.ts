/**
 * Admin Settings API - إدارة إعدادات الدفع
 * GET /api/admin/settings - جلب الإعدادات
 * PUT /api/admin/settings - تحديث الإعدادات
 */

import { NextResponse } from 'next/server';

export interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
    updatedAt?: string;
}

const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 500,
    currency: 'ل.س',
    paymentType: 'mandatory',
};

export const runtime = 'edge';

// جلب الإعدادات
export async function GET(request: Request) {
    try {
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
                        updatedAt: row.updated_at as string,
                    },
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    } catch (error) {
        console.error('[Admin Settings] GET Error:', error);
        return NextResponse.json({
            success: true,
            data: DEFAULT_SETTINGS,
        });
    }
}

// تحديث الإعدادات
export async function PUT(request: Request) {
    try {
        const env = (request as unknown as { env?: { ANALYTICS_DB?: unknown } }).env;
        const body = await request.json() as Partial<PaymentSettings>;

        if (!env?.ANALYTICS_DB) {
            // في بيئة التطوير، نرجع القيم المحدثة مباشرة
            console.log('[Admin Settings] Updated (dev mode):', body);
            return NextResponse.json({
                success: true,
                data: { ...DEFAULT_SETTINGS, ...body },
                message: 'تم التحديث (بيئة التطوير)',
            });
        }

        const db = env.ANALYTICS_DB as {
            prepare: (sql: string) => {
                bind: (...values: unknown[]) => {
                    run: () => Promise<unknown>;
                    first: <T>() => Promise<T | null>;
                };
                first: <T>() => Promise<T | null>;
            };
        };

        // تحديث الإعدادات
        const updates: string[] = [];
        const values: unknown[] = [];

        if (body.qrImageUrl !== undefined) {
            updates.push('qr_image_url = ?');
            values.push(body.qrImageUrl);
        }
        if (body.recipientName !== undefined) {
            updates.push('recipient_name = ?');
            values.push(body.recipientName);
        }
        if (body.recipientCode !== undefined) {
            updates.push('recipient_code = ?');
            values.push(body.recipientCode);
        }
        if (body.amount !== undefined) {
            updates.push('amount = ?');
            values.push(body.amount);
        }
        if (body.currency !== undefined) {
            updates.push('currency = ?');
            values.push(body.currency);
        }
        if (body.paymentType !== undefined) {
            updates.push('payment_type = ?');
            values.push(body.paymentType);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');

            await db.prepare(
                `UPDATE payment_settings SET ${updates.join(', ')} WHERE id = 1`
            ).bind(...values).run();
        }

        // جلب الإعدادات المحدثة
        const row = await db.prepare(
            'SELECT * FROM payment_settings WHERE id = 1'
        ).first<Record<string, unknown>>();

        return NextResponse.json({
            success: true,
            data: row ? {
                qrImageUrl: row.qr_image_url as string,
                recipientName: row.recipient_name as string,
                recipientCode: row.recipient_code as string,
                amount: row.amount as number,
                currency: row.currency as string,
                paymentType: row.payment_type as PaymentSettings['paymentType'],
                updatedAt: row.updated_at as string,
            } : { ...DEFAULT_SETTINGS, ...body },
            message: 'تم تحديث الإعدادات بنجاح',
        });
    } catch (error) {
        console.error('[Admin Settings] PUT Error:', error);
        return NextResponse.json(
            { success: false, error: 'فشل تحديث الإعدادات' },
            { status: 500 }
        );
    }
}
