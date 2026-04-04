/**
 * Smart Analysis API - تحليل ذكي لمصادر متعددة
 * يجمع كل المصادر (روابط، PDF، نص) ويرسلها للـ AI لتحليلها
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const SMART_ANALYSIS_PROMPT = `أنت خبير في تحليل السير الذاتية.

سأعطيك معلومات من مصادر متعددة (نص، روابط مُضافة من المستخدم، ملفات PDF محللة).
مهمتك: استخراج **كل** البيانات المُمكنة وتحويلها لسيرة ذاتية منظمة.

**ملاحظات مهمة:**
1. الروابط التي يضيفها المستخدم هي مصادر قيمة - استخدم عناوينها لفهم السياق
2. إذا كان هناك رابط LinkedIn أو GitHub - استخدم ذلك لفهم الخبرة
3. إذا كان هناك رابط وظيفة - ركز السيرة على متطلبات تلك الوظيفة
4. **لا تترك أي حقل فارغاً إذا كانت المعلومات متوفرة**
5. **خمّن الحقول الناقصة بشكل منطقي** من السياق

**النتيجة المطلوبة:** أرجع JSON فقط بالشكل التالي:
{
  "personal": {
    "firstName": "الاسم الأول",
    "lastName": "الاسم الأخير",
    "email": "البريد الإلكتروني",
    "phone": "رقم الهاتف",
    "location": "الموقع/البلد",
    "jobTitle": "المسمى الوظيفي"
  },
  "summary": "ملخص احترافي عن الشخص",
  "experience": [
    {
      "id": "exp-1",
      "company": "اسم الشركة",
      "position": "المنصب",
      "startDate": "تاريخ البدء",
      "endDate": "تاريخ الانتهاء أو 'حتى الآن'",
      "description": "وصف المهام"
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "institution": "الجامعة/المعهد",
      "degree": "الدرجة",
      "major": "التخصص",
      "startYear": "سنة البدء",
      "endYear": "سنة التخرج"
    }
  ],
  "skills": ["مهارة 1", "مهارة 2"],
  "languages": [{"name": "العربية", "level": "اللغة الأم"}, {"name": "الإنجليزية", "level": "جيد جداً"}],
  "hobbies": []
}`;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // جمع كل المعلومات
        const allInfo: string[] = [];
        let pdfData: Record<string, unknown> | null = null;

        // 1. معالجة الروابط
        const urlsJson = formData.get('urls');
        if (urlsJson) {
            try {
                const urls = JSON.parse(urlsJson as string);
                if (urls.length > 0) {
                    allInfo.push('📌 **روابط المستخدم:**');
                    for (const urlItem of urls) {
                        const typeLabel = urlItem.type === 'personal' ? '👤 بيانات شخصية' :
                            urlItem.type === 'job' ? '💼 وظيفة شاغرة' :
                                '❓ غير محدد';
                        allInfo.push(`- ${typeLabel}: ${urlItem.url}`);

                        // محاولة جلب محتوى الرابط (قد تفشل لكن نحاول)
                        try {
                            const response = await fetch(urlItem.url, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (compatible; CVBuilder/1.0)',
                                },
                                signal: AbortSignal.timeout(8000),
                            });

                            if (response.ok) {
                                const contentType = response.headers.get('content-type') || '';
                                if (contentType.includes('text/html')) {
                                    const html = await response.text();
                                    // استخراج النص المفيد فقط
                                    const textContent = html
                                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                        .replace(/<[^>]+>/g, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim()
                                        .substring(0, 3000);

                                    if (textContent.length > 50) {
                                        allInfo.push(`  محتوى الصفحة: ${textContent}`);
                                    }
                                }
                            }
                        } catch {
                            // تجاهل أخطاء الجلب
                            console.log(`Could not fetch ${urlItem.url}`);
                        }
                    }
                    allInfo.push('');
                }
            } catch (e) {
                console.error('Error parsing URLs:', e);
            }
        }

        // 2. معالجة ملفات PDF
        const fileKeys = Array.from(formData.keys()).filter(k => k.startsWith('file_') && !k.endsWith('_type'));

        for (const key of fileKeys) {
            const file = formData.get(key) as File;
            const typeKey = `${key}_type`;
            const fileType = formData.get(typeKey) as string || 'unknown';

            if (file) {
                const typeLabel = fileType === 'personal' ? '👤 سيرة ذاتية' :
                    fileType === 'job' ? '💼 وصف وظيفة' :
                        '📄 ملف PDF';
                allInfo.push(`📎 **${typeLabel}:** ${file.name}`);

                try {
                    // استخدام الـ PDF analyzer الموجود
                    const pdfFormData = new FormData();
                    pdfFormData.append('file', file);

                    const pdfResponse = await fetch(`${request.nextUrl.origin}/api/analyze/pdf`, {
                        method: 'POST',
                        body: pdfFormData,
                    });

                    if (pdfResponse.ok) {
                        const pdfResult = await pdfResponse.json();
                        if (pdfResult.cvData) {
                            pdfData = pdfResult.cvData;
                            allInfo.push(`  محتوى الملف (محلل): ${JSON.stringify(pdfResult.cvData).substring(0, 2000)}`);
                        }
                    }
                } catch (error) {
                    console.error(`Error analyzing PDF ${file.name}:`, error);
                }
                allInfo.push('');
            }
        }

        // 3. معالجة النص الإضافي (الأهم!)
        const additionalText = formData.get('additionalText') as string || '';
        if (additionalText.trim()) {
            allInfo.push('📝 **نص المستخدم:**');
            allInfo.push(additionalText);
            allInfo.push('');
        }

        // التحقق من وجود معلومات
        if (allInfo.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'لم يتم إضافة أي مصادر'
            }, { status: 400 });
        }

        // إرسال كل المعلومات للـ AI
        const ZAI_API_KEY = process.env.ZAI_API_KEY;
        if (!ZAI_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'خدمة الذكاء الاصطناعي غير مفعلة'
            }, { status: 503 });
        }

        const fullContext = allInfo.join('\n');
        console.log('--- Smart Analysis Context ---');
        console.log(fullContext.substring(0, 500));
        console.log(`--- Total length: ${fullContext.length} chars ---`);

        // AI API call with retry
        let aiResponse: Response | null = null;
        let lastError = '';

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                aiResponse = await fetch(`${BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${ZAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: 'GLM-5-Turbo',
                        messages: [
                            { role: 'system', content: SMART_ANALYSIS_PROMPT },
                            { role: 'user', content: `حلل المعلومات التالية واستخرج بيانات السيرة الذاتية:\n\n${fullContext}` }
                        ],
                        temperature: 0.3,
                        stream: false,
                    }),
                    signal: AbortSignal.timeout(45000),
                });

                if (aiResponse.ok) break;

                lastError = `AI API returned ${aiResponse.status}`;
                console.error(`AI API attempt ${attempt} failed:`, aiResponse.status);

                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
                }
            } catch (fetchError) {
                lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
                console.error(`AI API attempt ${attempt} error:`, lastError);

                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }

        if (!aiResponse || !aiResponse.ok) {
            const errorBody = aiResponse ? await aiResponse.text().catch(() => 'unknown') : 'no response';
            console.error('AI API final error:', errorBody);

            // إذا عندنا بيانات PDF، استخدمها كـ fallback
            if (pdfData) {
                return NextResponse.json({
                    success: true,
                    cvData: pdfData,
                    sourcesAnalyzed: 1,
                    message: 'تم استخراج البيانات من ملف PDF (التحليل الذكي غير متوفر حالياً)',
                });
            }

            return NextResponse.json({
                success: false,
                error: `فشل في تحليل المصادر: ${lastError}`,
                details: `AI API error after 2 attempts: ${lastError}`
            }, { status: 500 });
        }

        const data = await aiResponse.json();
        const content = data.choices?.[0]?.message?.content || '';

        // استخراج JSON من الرد
        let cvData;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cvData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in AI response');
            }
        } catch {
            console.error('Failed to parse AI response:', content.substring(0, 200));
            // إذا فشل التحليل وعندنا بيانات PDF، نستخدمها
            if (pdfData) {
                cvData = pdfData;
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'فشل في تحليل استجابة الذكاء الاصطناعي'
                }, { status: 500 });
            }
        }

        // تأكد من وجود البنية الأساسية
        const finalCvData = {
            personal: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                location: '',
                jobTitle: '',
                ...(cvData.personal || {}),
            },
            summary: cvData.summary || '',
            experience: cvData.experience || [],
            education: cvData.education || [],
            skills: cvData.skills || [],
            languages: cvData.languages || [],
            hobbies: cvData.hobbies || [],
        };

        return NextResponse.json({
            success: true,
            cvData: finalCvData,
            sourcesAnalyzed: allInfo.filter(l => l.startsWith('📌') || l.startsWith('📎') || l.startsWith('📝')).length,
            message: 'تم تحليل المصادر بنجاح',
        });

    } catch (error) {
        console.error('Smart analysis error:', error);

        let errorMsg = 'فشل في تحليل المصادر';
        if (error instanceof Error) {
            if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
                errorMsg = 'انتهت مهلة التحليل - يرجى المحاولة مرة أخرى';
            } else if (error.message.includes('fetch') || error.message.includes('network')) {
                errorMsg = 'مشكلة في الاتصال بالخادم - يرجى التحقق من الإنترنت';
            } else {
                errorMsg = `فشل في تحليل المصادر: ${error.message}`;
            }
        }

        return NextResponse.json(
            {
                success: false,
                error: errorMsg,
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
