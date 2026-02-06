import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const TEXT_ANALYSIS_PROMPT = `أنت خبير في تحليل السير الذاتية والمعلومات الشخصية. مهمتك هي استخراج البيانات المهيكلة من النص المُعطى.

**الحقول الإلزامية التي يجب البحث عنها:**
- firstName (الاسم الأول) - إلزامي
- lastName (الكنية) - إلزامي  
- phone (رقم الهاتف) - إلزامي
- email (البريد الإلكتروني) - إلزامي
- country (الدولة) - إلزامي
- birthDate (تاريخ الميلاد) - اختياري

**الحقول الإضافية:**
- المسمى الوظيفي الحالي أو المطلوب
- ملخص شخصي/مهني
- الخبرات العملية (اسم الشركة، المنصب، تاريخ البداية والنهاية، الوصف)
- التعليم (المؤسسة، الشهادة، التخصص، سنة البداية والنهاية)
- المهارات (قائمة نصية)
- اللغات (قائمة نصية)
- الهوايات (قائمة نصية)

**مهمتك:**
1. استخرج جميع البيانات الموجودة في النص
2. لا تختلق أي معلومات غير موجودة
3. حدد الحقول الإلزامية الناقصة

أرجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي، بالهيكل التالي:
{
  "personal": {
    "firstName": "",
    "lastName": "",
    "email": "",
    "phone": "",
    "country": "",
    "birthDate": "",
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

**تعليمات مهمة:**
- إذا لم تجد معلومة معينة، اتركها فارغة ""
- لا تختلق معلومات غير موجودة في النص
- في missingRequiredFields، ضع أسماء الحقول الإلزامية الناقصة فقط من: ["firstName", "lastName", "email", "phone", "country"]
- مثال: إذا لم تجد الاسم والإيميل، أرجع "missingRequiredFields": ["firstName", "lastName", "email"]`;

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

        const { text } = body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: "النص مطلوب" }),
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

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'GLM-4.7',
                messages: [
                    { role: 'system', content: TEXT_ANALYSIS_PROMPT },
                    { role: 'user', content: `حلل النص التالي واستخرج البيانات:\n\n${text}` }
                ],
                temperature: 0.3,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`ZAI API Error (${response.status}):`, errorText);
            return new Response(
                JSON.stringify({ error: "فشل في تحليل النص" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Try to parse the JSON from the response
        let cvData;
        try {
            // Find JSON in the response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cvData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            return new Response(
                JSON.stringify({ error: "فشل في تحليل استجابة الذكاء الاصطناعي" }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Extract missingRequiredFields from AI response
        const aiMissingFields: string[] = cvData.missingRequiredFields || [];
        delete cvData.missingRequiredFields; // Remove from cvData since it's metadata

        // Field metadata for missing fields form
        const fieldMetadata: Record<string, any> = {
            firstName: {
                field: 'firstName',
                label: 'First Name',
                labelAr: 'الاسم الأول',
                type: 'text',
                required: true,
                placeholder: 'e.g., Mohammed',
                placeholderAr: 'مثلاً: محمد'
            },
            lastName: {
                field: 'lastName',
                label: 'Last Name',
                labelAr: 'الكنية',
                type: 'text',
                required: true,
                placeholder: 'e.g., Ali',
                placeholderAr: 'مثلاً: علي'
            },
            email: {
                field: 'email',
                label: 'Email',
                labelAr: 'البريد الإلكتروني',
                type: 'email',
                required: true,
                placeholder: 'example@email.com',
                placeholderAr: 'example@email.com'
            },
            phone: {
                field: 'phone',
                label: 'Phone',
                labelAr: 'رقم الهاتف',
                type: 'tel',
                required: true,
                placeholder: '+963 XXX XXX XXX',
                placeholderAr: '+963 XXX XXX XXX'
            },
            country: {
                field: 'country',
                label: 'Country',
                labelAr: 'الدولة',
                type: 'text',
                required: true,
                placeholder: 'e.g., Syria',
                placeholderAr: 'مثلاً: سوريا'
            },
            birthDate: {
                field: 'birthDate',
                label: 'Birth Date',
                labelAr: 'تاريخ الميلاد',
                type: 'date',
                required: false,
                placeholder: 'YYYY-MM-DD',
                placeholderAr: 'YYYY-MM-DD'
            },
            photoUrl: {
                field: 'photoUrl',
                label: 'Profile Photo',
                labelAr: 'الصورة الشخصية',
                type: 'file',
                required: false,
                placeholder: 'Upload your photo',
                placeholderAr: 'ارفع صورتك الشخصية'
            }
        };

        // Map missing fields to detailed info
        const missingFields = aiMissingFields
            .filter(field => fieldMetadata[field])
            .map(field => fieldMetadata[field]);

        const isComplete = missingFields.length === 0;

        return new Response(
            JSON.stringify({
                cvData,
                missingFields,
                isComplete,
                message: isComplete
                    ? "تم تحليل النص بنجاح - البيانات كاملة"
                    : "تم تحليل النص - يوجد بيانات أساسية ناقصة"
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in text analysis route:', error);
        return new Response(
            JSON.stringify({ error: "حدث خطأ داخلي" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
