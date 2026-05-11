/**
 * Smart Analysis API - تحليل ذكي لمصادر متعددة
 * يجمع كل المصادر (روابط، PDF، نص) ويرسلها للـ AI لتحليلها
 *
 * تحسينات:
 * - استخراج نص PDF مباشرة بدون استدعاء HTTP لـ /api/analyze/pdf
 * - استدعاء AI واحد فقط (بدلاً من اثنين)
 * - الاحتفاظ باستخراج صورة الملف الشخصي (profileImage)
 * - تقليل timeout وإزالة retry loop
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdf/extract-text';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const SMART_ANALYSIS_PROMPT = `حلل المعلومات التالية واستخرج بيانات سيرة ذاتية بصيغة JSON.
استخرج: الاسم، البريد، الهاتف، الموقع، المسمى الوظيفي، الملخص، الخبرات، التعليم، المهارات، اللغات، الهوايات.
لا تترك حقلاً فارغاً إذا كانت المعلومات متوفرة. خمّن الحقول الناقصة بشكل منطقي.
أرجع JSON فقط بالشكل:
{
  "personal": { "firstName": "", "lastName": "", "email": "", "phone": "", "location": "", "jobTitle": "" },
  "summary": "ملخص احترافي",
  "experience": [{ "id": "exp-1", "company": "", "position": "", "startDate": "", "endDate": "", "description": "" }],
  "education": [{ "id": "edu-1", "institution": "", "degree": "", "major": "", "startYear": "", "endYear": "" }],
  "skills": [], "languages": [{ "name": "", "level": "" }], "hobbies": []
}`;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // جمع كل المعلومات
        const allInfo: string[] = [];
        let profileImage: string | undefined;

        // 1. معالجة الروابط
        const urlsJson = formData.get('urls');
        if (urlsJson) {
            try {
                const urls = JSON.parse(urlsJson as string);
                if (urls.length > 0) {
                    allInfo.push('📌 **روابط المستخدم:**');

                    // جلب كل الروابط بالتوازي (8s للجميع بدل 8s×عدد)
                    const urlFetchPromises = urls.map(async (urlItem: { url: string; type: string }) => {
                        const typeLabel = urlItem.type === 'personal' ? '👤 بيانات شخصية' :
                            urlItem.type === 'job' ? '💼 وظيفة شاغرة' :
                                '❓ غير محدد';

                        const lines: string[] = [`- ${typeLabel}: ${urlItem.url}`];

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
                                    const textContent = html
                                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                        .replace(/<[^>]+>/g, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim()
                                        .substring(0, 3000);

                                    if (textContent.length > 50) {
                                        lines.push(`  محتوى الصفحة: ${textContent}`);
                                    }
                                }
                            }
                        } catch {
                            console.log(`Could not fetch ${urlItem.url}`);
                        }

                        return lines;
                    });

                    const results = await Promise.allSettled(urlFetchPromises);
                    for (const result of results) {
                        if (result.status === 'fulfilled') {
                            allInfo.push(...result.value);
                        }
                    }
                    allInfo.push('');
                }
            } catch (e) {
                console.error('Error parsing URLs:', e);
            }
        }

        // 2. معالجة ملفات PDF - استخراج مباشر بدون HTTP call
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
                    // 🔥 تحسين: استخراج نص PDF مباشرة بدون استدعاء /api/analyze/pdf
                    const arrayBuffer = await file.arrayBuffer();
                    const extractedData = await extractTextFromPDF(arrayBuffer);

                    if (extractedData.text.length > 0) {
                        allInfo.push(`  محتوى الملف (مستخرج): ${extractedData.text.substring(0, 3000)}`);
                    }

                    // الاحتفاظ بصورة الملف الشخصي إن وُجدت
                    if (extractedData.profileImage) {
                        profileImage = extractedData.profileImage;
                        console.log('✅ Profile image extracted from PDF');
                    }
                } catch (error) {
                    console.error(`Error extracting text from PDF ${file.name}:`, error);
                    allInfo.push(`  ⚠️ لم يتم استخراج النص من الملف`);
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

        // إرسال كل المعلومات للـ AI (استدعاء واحد فقط)
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

        // AI API call - محاولة واحدة مع timeout 55 ثانية
        let aiResponse: Response;
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
                signal: AbortSignal.timeout(55000),
            });
        } catch (fetchError) {
            const errorMsg = fetchError instanceof Error ? fetchError.message : 'Network error';
            console.error('AI API error:', errorMsg);

            return NextResponse.json({
                success: false,
                error: `فشل في تحليل المصادر: ${errorMsg}`,
                details: `AI API error: ${errorMsg}`
            }, { status: 500 });
        }

        if (!aiResponse.ok) {
            const errorBody = await aiResponse.text().catch(() => 'unknown');
            console.error('AI API error:', aiResponse.status, errorBody);

            return NextResponse.json({
                success: false,
                error: `فشل في تحليل المصادر: AI API returned ${aiResponse.status}`,
                details: `AI API error: ${errorBody}`
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
            return NextResponse.json({
                success: false,
                error: 'فشل في تحليل استجابة الذكاء الاصطناعي'
            }, { status: 500 });
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
            // الاحتفاظ بصورة الملف الشخصي إن وُجدت
            ...(profileImage ? { profileImage } : {}),
            sourcesAnalyzed: allInfo.filter(l => l.startsWith('📌') || l.startsWith('📎') || l.startsWith('📝')).length,
            message: 'تم تحليل المصادر بنجاح',
        });

    } catch (error) {
        console.error('Smart analysis error:', error);

        let errorMsg = 'فشل في تحليل المصادر';
        if (error instanceof Error) {
            if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
                errorMsg = 'انتهت مهلة التحليل - يرجى المحاولة مرة أخرى أو تقليل حجم الملف';
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