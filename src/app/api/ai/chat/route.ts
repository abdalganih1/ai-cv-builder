import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

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

        const ZAI_API_KEY = process.env.ZAI_API_KEY;

        if (!ZAI_API_KEY) {
            console.error("ZAI_API_KEY not found in environment variables");
            return new Response(
                JSON.stringify({ error: "خدمة الذكاء الاصطناعي غير مفعلة حالياً" }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        try {
            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZAI_API_KEY}`,
                    'Accept-Language': 'ar-SA,ar',
                },
                body: JSON.stringify({
                    model: 'GLM-4.7',
                    messages,
                    temperature: temperature || 0.7,
                    stream: stream,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                return new Response(
                    JSON.stringify({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    _fallback: true,
                                    message: "عذراً، الخدمة مشغولة حالياً. يرجى المحاولة بعد قليل."
                                })
                            }
                        }]
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`ZAI API Error (${response.status}):`, errorText);
                return new Response(
                    JSON.stringify({ error: `AI Request failed: ${response.status}` }),
                    { status: response.status, headers: { 'Content-Type': 'application/json' } }
                );
            }

            if (stream && response.body) {
                return new Response(response.body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }

            const data = await response.json();
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);
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
