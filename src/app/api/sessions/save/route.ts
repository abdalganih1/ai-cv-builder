/**
 * Save Session Data API
 * حفظ بيانات الجلسة الكاملة (CV + صور + دفع)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsStorage } from '@/lib/analytics/storage';
import type { Session } from '@/lib/analytics/types';

export const runtime = 'edge';

// تعريف نوع البيانات الواردة
interface SaveSessionRequest {
    sessionId: string;
    cvData?: Record<string, unknown>;
    profilePhoto?: string;       // base64
    paymentProofData?: string;   // base64
    advancedData?: Record<string, unknown>;
    currentStep?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as SaveSessionRequest;

        if (!body.sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            );
        }

        // التحقق من حجم البيانات (max 5MB للصور)
        const payloadSize = JSON.stringify(body).length;
        if (payloadSize > 5 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: 'Payload too large (max 5MB)' },
                { status: 413 }
            );
        }

        // الحصول على Storage adapter
        // @ts-expect-error - D1 binding from Cloudflare
        const db = request.cf?.env?.DB;
        const storage = new AnalyticsStorage(db);

        // حفظ البيانات
        const session = await storage.upsertSession(body.sessionId, {
            cvData: body.cvData,
            profilePhoto: body.profilePhoto,
            paymentProofData: body.paymentProofData,
            advancedData: body.advancedData as Session['advancedData'],
            currentStep: body.currentStep,
        });

        return NextResponse.json({
            success: true,
            data: {
                sessionId: session.id,
                savedAt: new Date().toISOString(),
            }
        });

    } catch (error) {
        console.error('[Save Session Error]:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
