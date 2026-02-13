import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

// System prompts per field type
const FIELD_PROMPTS: Record<string, string> = {
    university: 'أنت مساعد متخصص باقتراح أسماء جامعات ومؤسسات تعليمية. أعطِ 5 اقتراحات فقط كقائمة مرقمة مختصرة. ركّز على الجامعات السورية والعربية المعروفة.',
    degree: 'أنت مساعد متخصص باقتراح درجات علمية. أعطِ 5 اقتراحات فقط كقائمة مرقمة. مثل: بكالوريوس، ماجستير، دبلوم، دكتوراه، شهادة مهنية.',
    major: 'أنت مساعد متخصص باقتراح تخصصات جامعية. أعطِ 5 اقتراحات فقط كقائمة مرقمة بناءً على سياق الجامعة المذكورة.',
    company: 'أنت مساعد متخصص باقتراح أسماء شركات وجهات عمل. أعطِ 5 اقتراحات فقط كقائمة مرقمة. ركّز على شركات معروفة في المنطقة العربية.',
    position: 'أنت مساعد متخصص باقتراح مسميات وظيفية. أعطِ 5 اقتراحات فقط كقائمة مرقمة بناءً على اسم الشركة أو جهة العمل المذكورة.',
    description: 'أنت مساعد متخصص بكتابة وصف مهام وظيفية. أعطِ 3 اقتراحات فقط لوصف المهام والمسؤوليات بجملتين لكل اقتراح بناءً على المسمى الوظيفي والشركة.',
    jobTitle: 'أنت مساعد متخصص باقتراح مسميات وظيفية للسيرة الذاتية. أعطِ 5 اقتراحات فقط كقائمة مرقمة لعناوين وظيفية شائعة ومهنية.',
    skills: 'أنت مساعد متخصص باقتراح مهارات مهنية. أعطِ 5 اقتراحات فقط كقائمة مرقمة بناءً على المسمى الوظيفي المذكور.',
    language: 'أنت مساعد متخصص باقتراح أسماء لغات. أعطِ 5 اقتراحات فقط كقائمة مرقمة للغات الأكثر طلباً في سوق العمل.',
};

// User prompts per field type
function buildUserPrompt(fieldType: string, context: string, currentValue: string): string {
    const cv = currentValue ? ` (القيمة الحالية: ${currentValue})` : '';
    switch (fieldType) {
        case 'university':
            return `اقترح أسماء جامعات أو مؤسسات تعليمية${cv}`;
        case 'degree':
            return `اقترح درجات علمية مناسبة${context ? ` لجامعة ${context}` : ''}${cv}`;
        case 'major':
            return `اقترح تخصصات جامعية${context ? ` في ${context}` : ''}${cv}`;
        case 'company':
            return `اقترح أسماء شركات أو جهات عمل${cv}`;
        case 'position':
            return `اقترح مسميات وظيفية${context ? ` في ${context}` : ''}${cv}`;
        case 'description':
            return `اقترح وصف مهام ومسؤوليات${context ? ` لوظيفة ${context}` : ''}${cv}`;
        case 'jobTitle':
            return `اقترح مسميات وظيفية احترافية للسيرة الذاتية${cv}`;
        case 'skills':
            return `اقترح مهارات مهنية${context ? ` مناسبة لوظيفة ${context}` : ''}${cv}`;
        case 'language':
            return `اقترح لغات مطلوبة في سوق العمل${cv}`;
        default:
            return `اقترح خيارات مناسبة${context ? ` بناءً على: ${context}` : ''}${cv}`;
    }
}

// Parse AI response into suggestion array
function parseSuggestions(text: string): string[] {
    // Split by newlines, filter numbered items
    const lines = text.split('\n').filter(line => line.trim());
    const suggestions: string[] = [];

    for (const line of lines) {
        // Remove numbering like "1.", "1-", "1)", etc.
        const cleaned = line.replace(/^\s*[\d]+[\.\-\)]\s*/, '').trim();
        // Remove markdown bold
        const noBold = cleaned.replace(/\*\*/g, '').trim();
        if (noBold && noBold.length > 1 && noBold.length < 200) {
            suggestions.push(noBold);
        }
    }

    return suggestions.slice(0, 6); // Max 6 suggestions
}

export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { fieldType, context, currentValue } = body;

        if (!fieldType) {
            return new Response(
                JSON.stringify({ error: 'fieldType is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const ZAI_API_KEY = process.env.ZAI_API_KEY;
        if (!ZAI_API_KEY) {
            return new Response(
                JSON.stringify({ suggestions: [] }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const systemPrompt = FIELD_PROMPTS[fieldType] || FIELD_PROMPTS['jobTitle'];
        const userPrompt = buildUserPrompt(fieldType, context || '', currentValue || '');

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                stream: false,
                max_tokens: 200,
            }),
        });

        if (!response.ok) {
            console.error('Suggest API error:', response.status);
            return new Response(
                JSON.stringify({ suggestions: [] }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const suggestions = parseSuggestions(content);

        return new Response(
            JSON.stringify({ suggestions }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Suggest route error:', error);
        return new Response(
            JSON.stringify({ suggestions: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
