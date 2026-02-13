import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

// System prompts - SIMPLE and DIRECT to avoid thinking mode
const FIELD_PROMPTS: Record<string, string> = {
    university: 'جامعة دمشق، جامعة حلب، جامعة تشرين، الجامعة الوطنية الخاصة، الجامعة العربية الدولية، جامعة القلمون، جامعة الفرات، جامعة حماة، جامعة إدلب، الجامعة السورية الخاصة، جامعة قرطبة، جامعة الشام الخاصة',
    degree: 'بكالوريوس، ماجستير، دبلوم، دكتوراه، شهادة مهنية',
    major: 'هندسة برمجيات، طب عام، إدارة أعمال، حقوق، صيدلة',
    company: 'شركة سيريتل، MTN سوريا، بنك سورية والخليج، بنك البركة، سيرياتل',
    position: 'مطور برمجي، مهندس شبكات، مدير مبيعات، محاسب، مصمم جرافيك',
    description: 'إدارة وتطوير التطبيقات، متابعة المشاريع، كتابة التقارير',
    jobTitle: 'مطور full-stack، مهندس DevOps، مدير منتج، محلل بيانات، مصمم UX',
    skills: 'JavaScript، Python، تواصل فعّال، إدارة وقت، تفكير ناقد',
    language: 'الإنجليزية، الفرنسية، الألمانية، التركية، الروسية',
};

// Parse: just split by comma
function parseSuggestions(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    console.log('[parseSuggestions] Raw text:', text);

    // Clean common prefixes
    let cleaned = text
        .replace(/^(الجواب:|الإجابة:|الاقتراحات:|اقتراحاتي:|هذه|Answer:|Suggestions:)\s*/i, '')
        .trim();

    // Split by comma (Arabic or English)
    const parts = cleaned.split(/[،,]/);
    const suggestions: string[] = [];

    for (const part of parts) {
        let s = part.trim();
        s = s.replace(/^\d+[\.\-\)]\s*/, '');  // Remove numbering
        s = s.replace(/\*\*/g, '');            // Remove bold
        s = s.replace(/[\u064B-\u065F]/g, ''); // Remove diacritics
        s = s.trim();

        if (s && s.length > 1 && s.length < 200) {
            suggestions.push(s);
        }
    }

    const result = suggestions.slice(0, 6);
    console.log('[parseSuggestions] Parsed:', result);
    return result;
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

        const { fieldType } = body;
        console.log('[suggest] Request:', fieldType);

        if (!fieldType) {
            return new Response(
                JSON.stringify({ error: 'fieldType required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const ZAI_API_KEY = process.env.ZAI_API_KEY;
        if (!ZAI_API_KEY) {
            console.log('[suggest] No API key - returning hardcoded');
            // Return hardcoded suggestions when no API key
            const hardcoded = FIELD_PROMPTS[fieldType] || FIELD_PROMPTS['jobTitle'];
            return new Response(
                JSON.stringify({ suggestions: parseSuggestions(hardcoded) }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const prompt = `اقترح 5 خيارات مشابهة لـ: ${FIELD_PROMPTS[fieldType] || 'خيارات مهنية'}. أعطِ الخيارات فقط مفصولة بفاصلة بدون ترقيم.`;

        console.log('[suggest] Calling ZAI API:', prompt);

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'GLM-4.5-Flash',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                stream: false,
                max_tokens: 100,
            }),
        });

        if (!response.ok) {
            console.error('[suggest] API error:', response.status);
            // Fallback to hardcoded
            const hardcoded = FIELD_PROMPTS[fieldType] || FIELD_PROMPTS['jobTitle'];
            return new Response(
                JSON.stringify({ suggestions: parseSuggestions(hardcoded) }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';

        console.log('[suggest] AI response:', content);

        let suggestions = parseSuggestions(content);

        // If parsing failed, use hardcoded
        if (suggestions.length === 0) {
            console.log('[suggest] Parsing failed, using hardcoded');
            const hardcoded = FIELD_PROMPTS[fieldType] || FIELD_PROMPTS['jobTitle'];
            suggestions = parseSuggestions(hardcoded);
        }

        return new Response(
            JSON.stringify({ suggestions }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[suggest] Error:', error);
        return new Response(
            JSON.stringify({ suggestions: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
