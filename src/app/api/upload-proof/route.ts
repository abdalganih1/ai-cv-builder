import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { AnalyticsStorage } from '@/lib/analytics/storage';

export const runtime = 'edge';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8562044120:AAFbR8a_xE88xQOh8E1aBoEPoLpeI8Yj1ig';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '692893387';

async function sendTelegramNotification(params: {
    customerName: string;
    phone: string;
    sessionId: string;
    imageSize: number;
}): Promise<void> {
    try {
        const message = `
🔔 *إشعار دفع جديد*

👤 *العميل:* ${params.customerName || 'غير محدد'}
📞 *الهاتف:* ${params.phone || 'غير محدد'}
📁 *حجم الصورة:* ${(params.imageSize / 1024).toFixed(2)} KB
🔑 *الجلسة:* \`${params.sessionId || 'غير محدد'}\`
📅 *الوقت:* ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Damascus' })}
`.trim();

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
        console.error('[Telegram] Failed to send notification:', error);
    }
}

async function sendTelegramPhoto(params: {
    customerName: string;
    phone: string;
    sessionId: string;
    base64Image: string;
    mimeType: string;
}): Promise<void> {
    try {
        const caption = `
🔔 *إثبات دفع جديد*

👤 *العميل:* ${params.customerName || 'غير محدد'}
📞 *الهاتف:* ${params.phone || 'غير محدد'}
🔑 *الجلسة:* \`${params.sessionId || 'غير محدد'}\`
📅 *الوقت:* ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Damascus' })}
`.trim();

        // تحويل base64 إلى Blob
        const base64Data = params.base64Image.includes(',')
            ? params.base64Image.split(',')[1]
            : params.base64Image;
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: params.mimeType });

        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'payment_proof.jpg');
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData,
        });
    } catch (error) {
        console.error('[Telegram] Failed to send photo:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const customerName = formData.get('customerName') as string;
        const phone = formData.get('phone') as string;
        const sessionId = formData.get('sessionId') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'لم يتم اختيار ملف' },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'نوع الملف غير مدعوم. يسمح فقط بـ: JPG, PNG, WebP' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const uint8Array = new Uint8Array(bytes);
        let binaryString = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);

        const timestamp = Date.now();
        const sanitizedName = (customerName || 'customer').replace(/\s+/g, '_').substring(0, 20);
        const extension = file.name.split('.').pop() || 'png';
        const filename = `proof_${sanitizedName}_${timestamp}.${extension}`;

        console.log('='.repeat(50));
        console.log('💰 NEW PAYMENT PROOF RECEIVED');
        console.log('='.repeat(50));
        console.log(`📅 Time: ${new Date().toISOString()}`);
        console.log(`👤 Customer: ${customerName}`);
        console.log(`📞 Phone: ${phone}`);
        console.log(`📁 Filename: ${filename}`);
        console.log(`📦 File Size: ${(uint8Array.length / 1024).toFixed(2)} KB`);
        console.log(`🔑 Session ID: ${sessionId || 'Not provided'}`);
        console.log('='.repeat(50));

        const dataUrl = `data:${file.type};base64,${base64}`;

        // Send Telegram notification (non-blocking)
        sendTelegramNotification({
            customerName: customerName || '',
            phone: phone || '',
            sessionId: sessionId || '',
            imageSize: uint8Array.length,
        }).catch(err => console.error('[Telegram] Notification error:', err));

        // Also try to send photo if small enough (< 3MB for Telegram)
        if (uint8Array.length < 3 * 1024 * 1024) {
            sendTelegramPhoto({
                customerName: customerName || '',
                phone: phone || '',
                sessionId: sessionId || '',
                base64Image: dataUrl,
                mimeType: file.type,
            }).catch(err => console.error('[Telegram] Photo error:', err));
        }

        if (sessionId) {
            try {
                let db: any = undefined;
                try {
                    const { env } = getRequestContext();
                    db = env.ANALYTICS_DB || undefined;
                } catch {
                    console.log('[Upload] No Cloudflare context available');
                }

                if (db) {
                    const storage = new AnalyticsStorage(db);
                    await storage.upsertSession(sessionId, {
                        paymentProofUrl: dataUrl,
                        paymentStatus: 'uploaded',
                    });
                    console.log('[Upload] Payment proof URL saved to session:', sessionId);
                }
            } catch (dbError) {
                console.error('[Upload] Failed to save payment proof to session:', dbError);
            }
        }

        return NextResponse.json({
            success: true,
            url: dataUrl,
            filename: filename,
            message: 'Payment proof uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء رفع الملف';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
