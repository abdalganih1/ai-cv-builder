import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { AnalyticsStorage } from '@/lib/analytics/storage';

export const runtime = 'edge';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const customerName = formData.get('customerName') as string;
        const phone = formData.get('phone') as string;
        const sessionId = formData.get('sessionId') as string;

        // Validate file exists
        if (!file) {
            return NextResponse.json(
                { error: 'لم يتم اختيار ملف' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'نوع الملف غير مدعوم. يسمح فقط بـ: JPG, PNG, WebP' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت' },
                { status: 400 }
            );
        }

        // Convert file to base64 for storage using Uint8Array for Edge compatibility
        const bytes = await file.arrayBuffer();
        const uint8Array = new Uint8Array(bytes);
        let binaryString = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = (customerName || 'customer').replace(/\s+/g, '_').substring(0, 20);
        const extension = file.name.split('.').pop() || 'png';
        const filename = `proof_${sanitizedName}_${timestamp}.${extension}`;

        // Log payment proof for admin review
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

        // For now, we'll return a data URL as a temporary storage solution
        const dataUrl = `data:${file.type};base64,${base64}`;

        // Save payment proof URL to session in D1 if sessionId is provided
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
                // Don't fail the request, just log the error
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
