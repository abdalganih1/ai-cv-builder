import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface EducationEntry {
    id: string;
    institution: string;
    degree: string;
    major?: string;
    startYear: string;
    endYear: string;
}

interface YearSuggestion {
    year: number;
    label: string;
}

function parseYear(year: string | undefined): number | null {
    if (!year || year === '__skipped__') return null;
    const parsed = parseInt(year, 10);
    return isNaN(parsed) ? null : parsed;
}

function extractBirthYear(birthDate: string | undefined): number | null {
    if (!birthDate || birthDate === '__skipped__') return null;
    const yearMatch = birthDate.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0], 10) : null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { birthDate, degree, education, fieldType, currentEntryIndex } = body as {
            birthDate?: string;
            degree?: string;
            education: EducationEntry[];
            fieldType: 'start' | 'end';
            currentEntryIndex?: number;
        };

        const birthYear = extractBirthYear(birthDate);
        const currentYear = new Date().getFullYear();
        const suggestions: YearSuggestion[] = [];

        // Analyze existing education
        const completedEducation = education
            .filter((e, i) => i !== currentEntryIndex && e.endYear && parseYear(e.endYear))
            .sort((a, b) => (parseYear(b.endYear) || 0) - (parseYear(a.endYear) || 0));

        const isAdvanced = degree && (degree.includes('ماجستير') || degree.includes('دكتوراه'));
        const isBachelor = degree && (degree.includes('بكالوريوس') || degree.includes('دبلوم'));

        // Build AI prompt
        let analysisContext = '';
        
        if (fieldType === 'start') {
            analysisContext = `
المطلوب: اقتراح سنة بدء الدراسة لشهادة "${degree || 'غير محدد'}"

معلومات المتقدم:
- سنة الميلاد: ${birthYear || 'غير محدد'}

التعليم السابق المكتمل:
${completedEducation.length > 0 
    ? completedEducation.map(e => `- ${e.degree} في ${e.major || 'تخصص غير محدد'} من ${e.institution} (${e.startYear} - ${e.endYear})`).join('\n')
    : 'لا يوجد تعليم سابق مسجل'
}

قواعد:
1. للماجستير/الدكتوراه: السنة المتوقعة = سنة تخرج آخر شهادة + 1
2. للبكالوريوس: السنة المتوقعة = سنة الميلاد + 18
3. إذا تم إدخال شهادة أعلى أولاً (مثل دكتوراه قبل البكالوريوس): احسب للخلف
4. أرجع JSON array: [{"year": 2020, "label": "2020 (متوقع)"}, ...]
`;
        } else {
            const startYear = education[currentEntryIndex || 0]?.startYear;
            analysisContext = `
المطلوب: اقتراح سنة انتهاء الدراسة لشهادة "${degree || 'غير محدد'}"

سنة البدء: ${startYear || 'غير محددة'}

مدة الدراسة المتوقعة:
- بكالوريوس: 4 سنوات
- بكالوريوس هندسي: 5 سنوات
- ماجستير: سنتين
- دكتوراه: 3 سنوات
- دبلوم: سنتين

قواعد:
1. السنة المتوقعة = سنة البدء + مدة الدراسة
2. أضف خيار "حالياً (لا أزال طالباً)" دائماً
3. أرجع JSON array: [{"year": 2024, "label": "2024 (4 سنوات - متوقع)"}, ...]
`;
        }

        // Call AI
        const apiKey = process.env.ZAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ suggestions: null }, { status: 200 });
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
                        content: 'أنت مساعد ذكي متخصص في تحليل البيانات الأكاديمية. تُرجع JSON فقط بدون أي نص إضافي.'
                    },
                    {
                        role: 'user',
                        content: analysisContext
                    }
                ],
                temperature: 0.3,
                max_tokens: 500,
            }),
        });

        if (!aiResponse.ok) {
            return NextResponse.json({ suggestions: null }, { status: 200 });
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';

        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return NextResponse.json({ suggestions: parsed });
                }
            } catch {
                // Invalid JSON, fallback
            }
        }

        return NextResponse.json({ suggestions: null }, { status: 200 });

    } catch (error) {
        console.error('AI year suggestions error:', error);
        return NextResponse.json({ suggestions: null }, { status: 200 });
    }
}
