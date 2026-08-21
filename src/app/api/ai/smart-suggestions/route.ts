import { NextRequest, NextResponse } from 'next/server';
import { callAI, resolveKeys } from '@/lib/ai/ai-client';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

interface EducationEntry {
    major?: string;
    degree?: string;
    startYear?: string;
    endYear?: string;
}

interface WorkEntry {
    company?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fieldType, currentValue, context } = body as {
            fieldType: string;
            currentValue?: string;
            context: {
                education?: EducationEntry[];
                experience?: WorkEntry[];
                targetJobTitle?: string;
                company?: string;
                birthDate?: string;
            };
        };

        // Cloudflare Pages secrets تُقرأ عبر getRequestContext وليس process.env
        let cfEnv: Record<string, unknown> | undefined;
        try { cfEnv = getRequestContext().env as unknown as Record<string, unknown>; } catch { /* local dev */ }
        const keys = resolveKeys(cfEnv);
        if (!keys.zaiKey && !keys.openrouterKey) {
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

        let prompt = '';

        if (fieldType === 'position' || fieldType === 'jobTitle') {
            // اقتراح حي أثناء الكتابة — بادئة قصيرة (مثل "مه") → مسميات محتملة
            const typed = (context as { typed?: string }).typed || currentValue || '';
            if (typed.trim().length >= 2 && typed.trim().length <= 20) {
                prompt = `
أنت مساعد ذكي متخصص في المسميات الوظيفية العربية.
المستخدم بدأ يكتب: "${typed.trim()}"
${context.education?.length ? `- تخصصاته: ${context.education.map((e: EducationEntry) => e.major).filter(Boolean).join('، ')}` : ''}

المطلوب: أكمل تخمين المسمى الوظيفي الذي يقصده.
قواعد:
- كل اقتراح يجب أن يبدأ بنفس ما كتبه (مثل "مه" → "مهندس ...")
- إذا ما نطابق منطقي، اقترح مسميات شائعة قريبة صوتياً/إملائياً
- 4-6 اقتراحات
- أرجع JSON array فقط: ["مهندس برمجيات", "مهندس مدني", ...]
`;
            } else {
                prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- التخصصات الدراسية: ${context.education?.map(e => e.major).filter(Boolean).join('، ') || 'غير محدد'}
- الشهادات: ${context.education?.map(e => e.degree).filter(Boolean).join('، ') || 'غير محدد'}
- المسمى الوظيفي المستهدف: ${context.targetJobTitle || 'غير محدد'}
- الشركة الحالية: ${context.company || 'غير محدد'}
- الخبرات السابقة: ${context.experience?.map(e => `${e.position} في ${e.company}`).filter(Boolean).join('، ') || 'لا يوجد'}

المطلوب: اقتراح 6-10 مسميات وظيفية مناسبة بناءً على:
1. التخصص الدراسي (الأهم)
2. الشهادات العلمية
3. المسمى الوظيفي المستهدف
4. الخبرات السابقة
5. طبيعة الشركة الحالية

قواعد:
- ركز على التخصصات الهندسية والطبية والتقنية
- إذا التخصص "هندسة كهربائية" لا تقترح "مهندس ميكانيكي"
- أضف مسميات عامة كخيار أخير
- أرجع JSON array فقط: ["مهندس كهربائي", "مهندس طاقة", ...]
`;
            }
        } else if (fieldType === 'workStartDate') {
            prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- تاريخ الميلاد: ${context.birthDate || 'غير محدد'}
- التعليم: ${context.education?.map(e => `${e.degree} ${e.major} (${e.startYear}-${e.endYear})`).join(' | ') || 'غير محدد'}
- الخبرات السابقة: ${context.experience?.map(e => `${e.position} في ${e.company} (${e.startDate}-${e.endDate})`).join(' | ') || 'لا يوجد'}
- الشركة الحالية: ${context.company || 'غير محدد'}

المطلوب: اقتراح 4-6 تواريخ بداية عمل محتملة للشركة "${context.company || 'الحالية'}"

قواعد:
- إذا أول خبرة: غالباً بعد التخرج بـ 0-2 سنة
- إذا خبرة سابقة منتهية: بعد تاريخ الانتهاء مباشرة أو خلال سنة
- الصيغة: YYYY/MM (مثال: 2020/01)
- أرجع JSON array: ["2020/01 (بعد التخرج)", "2020/06", ...]
`;
        } else if (fieldType === 'workEndDate') {
            prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- تاريخ بداية العمل: ${currentValue || 'غير محدد'}
- الشركة: ${context.company || 'غير محدد'}
- المسمى الوظيفي المستهدف: ${context.targetJobTitle || 'غير محدد'}

المطلوب: اقتراح 4-6 تواريخ انتهاء عمل محتملة

قواعد:
- أضف "حالياً (لا أزال أعمل)" كخيار أول
- مدة العمل المتوسطة: 2-4 سنوات
- الصيغة: YYYY/MM
- أرجع JSON array: ["حالياً (لا أزال أعمل)", "2024/06 (4 سنوات)", ...]
`;
        } else if (fieldType === 'skills') {
            const existing = (context as { existingTags?: string[] }).existingTags || [];
            prompt = `
أنت مساعد ذكي متخصص في السير الذاتية.

بيانات المستخدم:
- التخصصات الدراسية: ${context.education?.map(e => e.major).filter(Boolean).join('، ') || 'غير محدد'}
- المسمى الوظيفي المستهدف: ${context.targetJobTitle || 'غير محدد'}
- الخبرات: ${context.experience?.map(e => e.position).filter(Boolean).join('، ') || 'غير محدد'}
${existing.length ? `- مهارات أضافها بالفعل (لا تكررها): ${existing.join('، ')}` : ''}

المطلوب: اقتراح 6-10 مهارات جديدة مناسبة لم يجدها المستخدم بالقائمة
قواعد:
- لا تكرر أي مهارة من القائمة الموجودة أعلاه
- ركز على مهارات تقنية ومهنية متوافقة مع التخصص
- اخلط مهارات تقنية (Soft/Hard)
- أرجع JSON array فقط: ["مهارة 1", "مهارة 2", ...]
`;
        } else if (fieldType === 'hobbies') {
            prompt = `
أنت مساعد ذكي متخصص في تحليل السير الذاتية.

بيانات المستخدم:
- التخصصات الدراسية: ${context.education?.map(e => e.major).filter(Boolean).join('، ') || 'غير محدد'}
- المسمى الوظيفي المستهدف: ${context.targetJobTitle || 'غير محدد'}
- الخبرات: ${context.experience?.map(e => e.position).filter(Boolean).join('، ') || 'غير محدد'}

المطلوب: اقتراح 6-8 هوايات واهتمامات مناسبة

قواعد:
- ركز على هوايات متوافقة مع التخصص والوظيفة
- أضف هوايات عامة وشائعة
- اجعل الاقتراحات مختصرة
- أرجع JSON array: ["القراءة", "البرمجة", "الرياضة", ...]
`;
        } else {
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

        let content: string;
        try {
            const aiResult = await callAI(
                [
                    { role: 'system', content: 'أنت مساعد ذكي. تُرجع JSON array فقط بدون أي نص إضافي.' },
                    { role: 'user', content: prompt }
                ],
                { temperature: 0.3, maxTokens: 500, fast: true },
                keys
            );
            content = aiResult.content;
        } catch (error) {
            console.error('smart-suggestions AI error:', error);
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

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
        console.error('Smart suggestions error:', error);
        return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
}
