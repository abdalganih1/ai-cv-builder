/**
 * Admin Settings API - إدارة إعدادات الدفع
 * GET /api/admin/settings - جلب الإعدادات
 * PUT /api/admin/settings - تحديث الإعدادات
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

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

// Helper function to get D1 database
function getDB(): any {
    try {
        const { env } = getRequestContext();
        return env.ANALYTICS_DB || undefined;
    } catch {
        console.log('[Admin Settings] No Cloudflare context available');
        return undefined;
    }
}

// جلب الإعدادات
export async function GET(request: NextRequest) {
    try {
        // التحقق من المصادقة
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cookies = request.headers.get('cookie') || '';

        if (!isLocalDev && !cfAccessJWT && !cookies.includes('CF_Authorization')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = getDB();

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
                            updatedAt: row.updated_at as string,
                        },
                    });
                }
            } catch (dbError) {
                console.error('[Admin Settings] DB Error:', dbError);
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
export async function PUT(request: NextRequest) {
    try {
        // التحقق من المصادقة
        const isLocalDev = process.env.NODE_ENV === 'development';
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cookies = request.headers.get('cookie') || '';

        if (!isLocalDev && !cfAccessJWT && !cookies.includes('CF_Authorization')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json() as Partial<PaymentSettings>;
        const db = getDB();

        if (!db) {
            // في بيئة التطوير، نرجع القيم المحدثة مباشرة
            console.log('[Admin Settings] Updated (dev mode):', body);
            return NextResponse.json({
                success: true,
                data: { ...DEFAULT_SETTINGS, ...body },
                message: 'تم التحديث (بيئة التطوير)',
            });
        }

        // التحقق من وجود سجل أول
        let row = await db.prepare(
            'SELECT id FROM payment_settings WHERE id = 1'
        ).first();

        if (!row) {
            // إنشاء سجل جديد
            await db.prepare(`
                INSERT INTO payment_settings (id, qr_image_url, recipient_name, recipient_code, amount, currency, payment_type)
                VALUES (1, ?, ?, ?, ?, ?, ?)
            `).bind(
                body.qrImageUrl || DEFAULT_SETTINGS.qrImageUrl,
                body.recipientName || DEFAULT_SETTINGS.recipientName,
                body.recipientCode || DEFAULT_SETTINGS.recipientCode,
                body.amount || DEFAULT_SETTINGS.amount,
                body.currency || DEFAULT_SETTINGS.currency,
                body.paymentType || DEFAULT_SETTINGS.paymentType
            ).run();
        } else {
            // تحديث الإعدادات الموجودة
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
        }

        // جلب الإعدادات المحدثة
        row = await db.prepare(
            'SELECT * FROM payment_settings WHERE id = 1'
        ).first();

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
            { success: false, error: 'فشل تحديث الإعدادات: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
