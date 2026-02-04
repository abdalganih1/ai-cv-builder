import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const URL_ANALYSIS_PROMPT = `أنت خبير في تحليل صفحات الويب والملفات الشخصية على السوشال ميديا.
مهمتك هي استخراج البيانات الشخصية والمهنية من محتوى الصفحة المُعطى.

استخرج البيانات التالية إذا وُجدت:
- الاسم الكامل
- المسمى الوظيفي
- الملخص الشخصي/المهني (Bio)
- الخبرات العملية
- التعليم
- المهارات
- اللغات

أرجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي، بالهيكل التالي:
{
  "personal": {
    "firstName": "",
    "lastName": "",
    "jobTitle": "",
    "summary": ""
  },
  "education": [],
  "experience": [],
  "skills": [],
  "languages": [],
  "hobbies": []
}

إذا لم تجد معلومة، اتركها فارغة. لا تختلق معلومات.`;

async function fetchUrlContent(url: string): Promise<string> {
    try {
        // Use more browser-like headers to avoid being blocked
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.google.com/',
                'Cache-Control': 'no-cache',
            },
        });

        // Handle specific error codes
        if (!response.ok) {
            if (response.status === 403 || response.status === 401) {
                console.warn(`Access denied (${response.status}) for ${url}`);
                throw new Error(`تعذر الوصول للصفحة (${response.status}). قد يكون الموقع محمي ضد الروبوتات.`);
            }
            if (response.status === 404) {
                throw new Error(`الصفحة غير موجودة (404). تأكد من صحة الرابط.`);
            }
            throw new Error(`فشل في جلب الرابط: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        // Improved HTML to text conversion
        const text = html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
            .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gim, "")
            .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gim, "")
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const cleanText = text.substring(0, 15000); // Increased limit for better context

        if (cleanText.length < 50) {
            throw new Error('محتوى الصفحة قصير جداً أو فارغ. تأكد أن الصفحة عامة.');
        }

        return cleanText;
    } catch (error) {
        console.error('Error fetching URL:', error);
        throw error;
    }
}

function detectPlatform(url: string): string {
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('facebook.com') || url.includes('fb.com')) return 'Facebook';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    return 'website';
}

export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(
                JSON.stringify({ error: "Invalid JSON in request body" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { url } = body;

        if (!url || typeof url !== 'string') {
            return new Response(
                JSON.stringify({ error: "الرابط مطلوب" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return new Response(
                JSON.stringify({ error: "الرابط غير صحيح" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const ZAI_API_KEY = process.env.ZAI_API_KEY;

        if (!ZAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: "خدمة الذكاء الاصطناعي غير مفعلة" }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const platform = detectPlatform(url);

        // Fetch URL content
        let pageContent: string;
        try {
            pageContent = await fetchUrlContent(url);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'فشل في جلب محتوى الصفحة';
            return new Response(
                JSON.stringify({ error: errorMessage }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Analyze with AI
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'GLM-4.7',
                messages: [
                    { role: 'system', content: URL_ANALYSIS_PROMPT },
                    {
                        role: 'user',
                        content: `حلل محتوى هذه الصفحة من ${platform} واستخرج البيانات الشخصية والمهنية:\n\n${pageContent}`
                    }
                ],
                temperature: 0.3,
                stream: false,
            }),
        });

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: "فشل في تحليل المحتوى" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        let cvData;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cvData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch {
            return new Response(
                JSON.stringify({ error: "فشل في تحليل استجابة الذكاء الاصطناعي" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                cvData,
                source: platform,
                message: `تم تحليل صفحة ${platform} بنجاح`
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in URL analysis route:', error);
        return new Response(
            JSON.stringify({ error: "حدث خطأ داخلي" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
