import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { birthDate, education, experience, fieldType, currentCompany, currentStartDate } = body;

        const apiKey = process.env.ZAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

        const currentYear = new Date().getFullYear();

        let prompt = '';

        if (fieldType === 'start') {
            prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- تاريخ الميلاد: ${birthDate || 'غير محدد'}
- التعليم: ${education?.map((e: any) => `${e.degree} ${e.major} (${e.endYear})`).join(' | ') || 'غير محدد'}
- الخبرات السابقة: ${experience?.map((e: any) => `${e.position} في ${e.company} (${e.startDate} - ${e.endDate})`).join(' | ') || 'لا يوجد'}
- الشركة الحالية: ${currentCompany || 'غير محدد'}

المطلوب: اقتراح 5-6 تواريخ بداية عمل محتملة

قواعد:
- إذا توجد خبرة سابقة: بعد تاريخ انتهائها
- إذا أول خبرة: بعد التخرج بـ 0-6 أشهر
- الصيغة: YYYY/MM (مثال: 2020/01)
- أرجع JSON array: ["2020/01 (بعد التخرج)", "2020/06", ...]
`;
        } else {
            prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- تاريخ بداية العمل: ${currentStartDate || 'غير محدد'}
- الشركة: ${currentCompany || 'غير محدد'}

المطلوب: اقتراح 4-5 تواريخ انتهاء عمل محتملة

قواعد:
- الخيار الأول دائماً: "حالياً (لا أزال أعمل)"
- مدة العمل المتوسطة: 1-5 سنوات
- الصيغة: YYYY/MM
- أرجع JSON array: ["حالياً (لا أزال أعمل)", "2024/06 (4 سنوات)", ...]
`;
        }

        const aiResponse = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages: [
                    {
                        role: 'system',
                        content: 'أنت مساعد ذكي. تُرجع JSON array فقط بدون أي نص إضافي.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 300,
            }),
        });

        if (!aiResponse.ok) {
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';

        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return NextResponse.json({ suggestions: parsed });
                }
            } catch {
                // Invalid JSON
            }
        }

        return NextResponse.json({ suggestions: [] }, { status: 200 });

    } catch (error) {
        console.error('Work date suggestions error:', error);
        return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
}
