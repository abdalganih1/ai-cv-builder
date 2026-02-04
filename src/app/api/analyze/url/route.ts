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
        // Use a simple fetch to get the page content
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CVBuilder/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();

        // Basic HTML to text conversion (remove tags, scripts, styles)
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // Limit content length

        return text;
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

        // Detect platform
        const platform = detectPlatform(url);

        // Fetch URL content
        let pageContent: string;
        try {
            pageContent = await fetchUrlContent(url);
        } catch {
            return new Response(
                JSON.stringify({
                    error: "فشل في جلب محتوى الصفحة. تأكد من أن الصفحة عامة ويمكن الوصول إليها."
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (pageContent.length < 50) {
            return new Response(
                JSON.stringify({
                    error: "لم نتمكن من استخراج محتوى كافٍ من هذه الصفحة. قد تكون محمية أو خاصة."
                }),
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
