import { NextRequest } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdf/extract-text';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const PDF_ANALYSIS_PROMPT = `أنت خبير في تحليل السير الذاتية. سأعطيك نصاً مستخرجاً من ملف PDF لسيرة ذاتية.
مهمتك هي تحليل هذا النص بعناية واستخراج **جميع** البيانات المهيكلة بدون اختصار.

**تحذير حاسم:** النص المستخرج من PDF قد يكون غير مرتب. استخدم ذكاءك لإعادة ترتيب المعلومات منطقياً.
**ممنوع منعاً باتاً اختصار أو حذف أي معلومات موجودة في النص!**

استخرج **كل** البيانات التالية:
- الاسم الكامل (firstName + lastName)
- البريد الإلكتروني ورقم الهاتف والعنوان/البلد
- المسمى الوظيفي
- الملخص الشخصي (كامل بكل تفاصيله)
- **الخبرات العملية**: استخرج **كل** الخبرات بتواريخها ووصفها الكامل
- **التعليم**: استخرج **كل** الشهادات والدرجات العلمية
- **المهارات**: اذكر **كل** المهارات المذكورة في النص
- **اللغات**: كل اللغات المذكورة
- الهوايات إن وجدت

أرجع النتيجة بصيغة JSON فقط:
{
  "personal": {
    "firstName": "",
    "lastName": "",
    "email": "",
    "phone": "",
    "jobTitle": "",
    "summary": ""
  },
  "education": [
    {
      "id": "edu-1",
      "institution": "",
      "degree": "",
      "major": "",
      "startYear": "",
      "endYear": ""
    }
  ],
  "experience": [
    {
      "id": "exp-1",
      "company": "",
      "position": "",
      "startDate": "",
      "endDate": "",
      "description": ""
    }
  ],
  "skills": [],
  "languages": [],
  "hobbies": [],
  "missingRequiredFields": []
}

**تعليمات التنسيق:**
1. استخرج البيانات بدقة من النص.
2. إذا كان النص يحتوي على تواريخ، استخدمها. إذا لم يوجد، اتركها فارغة.
3. **لا تستخدم نصوص افتراضية** مثل "[اسم الشركة]"
4. في حقل summary، لخص الخبرة والمهارات في فقرة احترافية.
5. في حقل experience، حاول دمج المعلومات المتناثرة لتكوين سجل وظيفي متكامل.

ملاحظة للذكاء الاصطناعي: النص المستخرج قد يكون غير مرتب (بسبب طبيعة ملفات PDF العربية). ابذل قصارى جهدك لفهم السياق وترتيب المعلومات بشكل صحيح.`;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return new Response(
                JSON.stringify({ error: "الملف مطلوب" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (file.type !== 'application/pdf') {
            return new Response(
                JSON.stringify({ error: "يجب أن يكون الملف بصيغة PDF" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return new Response(
                JSON.stringify({ error: "حجم الملف يجب أن يكون أقل من 5 ميغابايت" }),
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

        // Read file as ArrayBuffer and extract text
        const arrayBuffer = await file.arrayBuffer();
        const extractedData = await extractTextFromPDF(arrayBuffer);
        const extractedText = extractedData.text;
        const profileImage = extractedData.profileImage;

        console.log('--- DEBUG: Extracted Text Start ---');
        console.log(extractedText.substring(0, 500)); // Log first 500 chars
        console.log(`--- DEBUG: Total Length: ${extractedText.length} chars ---`);
        if (profileImage) console.log('✅ Profile image detected!');

        // If extraction failed or got too little text, try base64 approach
        if (extractedText.length < 100) {
            // Convert to base64 using chunk-based method (Edge Runtime compatible)
            const uint8Arr = new Uint8Array(arrayBuffer).slice(0, 50000);
            const CHUNK_SIZE = 32768;
            const chunks: string[] = [];
            for (let i = 0; i < uint8Arr.length; i += CHUNK_SIZE) {
                const chunk = uint8Arr.slice(i, i + CHUNK_SIZE);
                chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
            }
            const base64 = btoa(chunks.join(''));

            // Ask AI to try to understand the PDF structure
            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'GLM-5-Turbo',
                    messages: [
                        { role: 'system', content: PDF_ANALYSIS_PROMPT },
                        {
                            role: 'user',
                            content: `لم أتمكن من استخراج نص كافٍ من ملف PDF (النص المستخرج: "${extractedText}"). 
                            يرجى تحليل الملف المرفق (Base64) واستخراج البيانات.`
                        },
                        {
                            role: 'user',
                            content: base64 // Sending base64 as content logic (simplified for prompt)
                        }
                    ],
                    temperature: 0.3,
                    stream: false,
                }),
            });

            if (!response.ok) {
                return new Response(
                    JSON.stringify({
                        error: "لم نتمكن من قراءة محتوى الملف. جرب لصق محتوى السيرة كنص.",
                        fallback: true
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            // Try to parse JSON from content
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const cvData = JSON.parse(jsonMatch[0]);
                    return new Response(
                        JSON.stringify({
                            cvData,
                            warning: "تم استخراج محتوى محدود من الملف. يُنصح بمراجعة البيانات.",
                            debug_text_preview: "Fallback Base64 Vision Used"
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } catch (e) {
                console.error("Failed to parse fallback JSON", e);
            }

            // If parsing failed
            return new Response(
                JSON.stringify({ error: "فشل في تحليل هيكل الملف." }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Analyze extracted text with AI
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'GLM-5-Turbo',
                messages: [
                    { role: 'system', content: PDF_ANALYSIS_PROMPT },
                    { role: 'user', content: `حلل النص التالي المستخرج من سيرة ذاتية PDF:\n\n${extractedText.substring(0, 15000)}` }
                ],
                temperature: 0.3,
                stream: false,
            }),
        });

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: "فشل في تحليل الملف" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

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
                profileImage: profileImage || undefined,
                debug_text_preview: extractedText.substring(0, 1000),
                message: "تم تحليل ملف PDF بنجاح"
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in PDF analysis route:', error);
        return new Response(
            JSON.stringify({ error: "حدث خطأ داخلي" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}