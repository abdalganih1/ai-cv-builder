import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

export async function POST(request: NextRequest) {
    try {
        const { messages, temperature, stream = true } = await request.json();

        const ZAI_API_KEY = process.env.ZAI_API_KEY;

        if (!ZAI_API_KEY) {
            console.error("ZAI_API_KEY not found in environment variables");
            return new Response(
                JSON.stringify({ error: "API Key not configured" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Streaming request to AI
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
                stream: stream, // Enable streaming from AI provider
            }),
        });

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

        // If streaming is enabled, pass through the stream
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

        // Fallback to non-streaming response
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in AI chat route:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
