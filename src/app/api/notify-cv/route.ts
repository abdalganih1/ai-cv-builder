/**
 * Notify CV API - إرسال بيانات السيرة الذاتية إلى Telegram عند التوليد
 * POST /api/notify-cv
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { AnalyticsStorage } from '@/lib/analytics/storage';

export const runtime = 'edge';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8562044120:AAFbR8a_xE88xQOh8E1aBoEPoLpeI8Yj1ig';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '692893387';

interface CVNotifyRequest {
    sessionId: string;
    cvData: {
        personal?: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            email?: string;
            country?: string;
            targetJobTitle?: string;
        };
        education?: Array<{
            degree?: string;
            major?: string;
            institution?: string;
            graduationYear?: string;
        }>;
        experience?: Array<{
            position?: string;
            company?: string;
            startDate?: string;
            endDate?: string;
        }>;
        skills?: string[];
        languages?: Array<{ name?: string; level?: string }>;
    };
    language?: 'ar' | 'en';
    action?: 'export' | 'payment' | 'skip_payment';
}

async function sendTelegramCVNotification(data: CVNotifyRequest): Promise<void> {
    try {
        const cv = data.cvData;
        const personal = cv.personal || {};
        const fullName = `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || 'غير محدد';

        // بناء رسالة ملخص السيرة الذاتية
        let message = `📄 *سيرة ذاتية جديدة*\n\n`;
        message += `👤 *الاسم:* ${fullName}\n`;

        if (personal.phone) message += `📞 *الهاتف:* ${personal.phone}\n`;
        if (personal.email) message += `📧 *البريد:* ${personal.email}\n`;
        if (personal.country) message += `🌍 *الدولة:* ${personal.country}\n`;
        if (personal.targetJobTitle) message += `💼 *المسمى الوظيفي:* ${personal.targetJobTitle}\n`;

        // التعليم
        if (cv.education && cv.education.length > 0) {
            message += `\n🎓 *التعليم:*\n`;
            for (const edu of cv.education) {
                const parts = [edu.degree, edu.major, edu.institution, edu.graduationYear].filter(Boolean);
                message += `  • ${parts.join(' - ')}\n`;
            }
        }

        // الخبرة
        if (cv.experience && cv.experience.length > 0) {
            message += `\n💼 *الخبرة:*\n`;
            for (const exp of cv.experience) {
                const period = [exp.startDate, exp.endDate].filter(Boolean).join(' → ');
                message += `  • ${exp.position || ''} في ${exp.company || ''}`;
                if (period) message += ` (${period})`;
                message += `\n`;
            }
        }

        // المهارات
        if (cv.skills && cv.skills.length > 0) {
            message += `\n🛠️ *المهارات:* ${cv.skills.slice(0, 10).join('، ')}\n`;
        }

        // اللغات
        if (cv.languages && cv.languages.length > 0) {
            message += `\n🌐 *اللغات:* ${cv.languages.map(l => `${l.name || ''} (${l.level || ''})`).join('، ')}\n`;
        }

        // معلومات إضافية
        message += `\n───────────────\n`;
        message += `📋 *الإجراء:* ${data.action === 'payment' ? 'دفع + تصدير' : data.action === 'skip_payment' ? 'تخطي الدفع' : 'تصدير'}\n`;
        message += `🌐 *اللغة:* ${data.language === 'en' ? 'إنجليزي' : 'عربي'}\n`;
        message += `🔑 *الجلسة:* \`${data.sessionId || 'غير محدد'}\`\n`;
        message += `📅 *الوقت:* ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Damascus' })}\n`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
    } catch (error) {
        console.error('[Telegram CV] Failed to send notification:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as CVNotifyRequest;

        if (!body.sessionId || !body.cvData) {
            return NextResponse.json(
                { success: false, error: 'sessionId and cvData are required' },
                { status: 400 }
            );
        }

        // إرسال إشعار Telegram بشكل متزامن لأن Edge Runtime يلغي العمليات غير المكتملة
        try {
            await sendTelegramCVNotification(body);
        } catch (err) {
            console.error('[Telegram CV] Notification error:', err);
        }

        // حفظ cvData في D1
        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            console.log('[Notify CV] No Cloudflare context available');
        }

        if (db) {
            try {
                const storage = new AnalyticsStorage(db);
                await storage.upsertSession(body.sessionId, {
                    cvData: body.cvData as Record<string, unknown>,
                });
            } catch (dbError) {
                console.error('[Notify CV] Failed to save to D1:', dbError);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'CV notification sent',
        });
    } catch (error) {
        console.error('[Notify CV] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
