import { NextRequest } from 'next/server';
import { callAIStream, resolveKeys } from '@/lib/ai/ai-client';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
        requestCounts.set(clientId, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (clientData.count >= RATE_LIMIT) {
        return false;
    }

    clientData.count++;
    return true;
}

function getClientId(request: NextRequest): string {
    return request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'anonymous';
}

export async function POST(request: NextRequest) {
    try {
        const clientId = getClientId(request);
        if (!checkRateLimit(clientId)) {
            return new Response(
                JSON.stringify({ error: "تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً." }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(
                JSON.stringify({ error: "Invalid JSON in request body" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { messages, temperature, stream = true } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "Messages array is required" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate at least one AI key is available
        let cfEnv: Record<string, unknown> | undefined;
        try { cfEnv = getRequestContext().env as unknown as Record<string, unknown>; } catch {}
        const keys = resolveKeys(cfEnv);

        if (!keys.zaiKey && !keys.openrouterKey) {
            console.error("No AI API key found in environment variables");
            return new Response(
                JSON.stringify({ error: "خدمة الذكاء الاصطناعي غير مفعلة حالياً" }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        try {
            // Use streaming with fallback chain
            const aiResponse = await callAIStream(
                messages.map((m: { role: string; content: string }) => ({
                    role: m.role as 'system' | 'user' | 'assistant',
                    content: m.content,
                })),
                { temperature: temperature || 0.7 },
                keys
            );

            clearTimeout(timeoutId);

            if (stream && aiResponse.body) {
                return new Response(aiResponse.body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }

            // Non-streaming response
            const data = await aiResponse.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Check if it's a "all providers failed" error
            if (fetchError instanceof Error && fetchError.message.includes('فشل جميع مزودي AI')) {
                return new Response(
                    JSON.stringify({ error: fetchError.message }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            }

            throw fetchError;
        }

    } catch (error) {
        console.error('Error in AI chat route:', error);

        if (error instanceof Error && error.name === 'AbortError') {
            return new Response(
                JSON.stringify({ error: "انتهت مهلة الطلب. يرجى المحاولة مرة أخرى." }),
                { status: 504, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ داخلي في الخادم';
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
