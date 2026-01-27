import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

export async function POST(request: NextRequest) {
    try {
        const { messages } = await request.json();

        const ZAI_API_KEY = process.env.ZAI_API_KEY;

        if (!ZAI_API_KEY) {
            console.error("ZAI_API_KEY not found in environment variables");
            return NextResponse.json(
                { error: "API Key not configured" },
                { status: 500 }
            );
        }

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
                temperature: 0.7
            }),
        });

        if (response.status === 429) {
            return NextResponse.json(
                {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                _fallback: true,
                                message: "عذراً، الخدمة مشغولة حالياً. يرجى المحاولة بعد قليل."
                            })
                        }
                    }]
                },
                { status: 200 }
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`ZAI API Error (${response.status}):`, errorText);
            return NextResponse.json(
                { error: `AI Request failed: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error in AI chat route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
