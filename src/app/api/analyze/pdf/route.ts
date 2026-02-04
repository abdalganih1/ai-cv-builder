import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

const PDF_ANALYSIS_PROMPT = `أنت خبير في تحليل السير الذاتية. تم استخراج النص التالي من ملف PDF لسيرة ذاتية.
مهمتك هي تحليل هذا النص واستخراج البيانات المهيكلة.

استخرج البيانات التالية:
- الاسم الأول والكنية
- البريد الإلكتروني ورقم الهاتف
- المسمى الوظيفي
- الملخص الشخصي
- الخبرات العملية (شركة، منصب، تاريخ، وصف)
- التعليم (مؤسسة، شهادة، تخصص، سنوات)
- المهارات
- اللغات
- الهوايات

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
  "hobbies": []
}

لا تختلق معلومات غير موجودة.`;

// Simple PDF text extraction for Edge runtime
// This extracts visible text from PDF binary data
function extractTextFromPDF(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const pdfString = new TextDecoder('latin1').decode(bytes);

    // Extract text between stream and endstream markers
    const textChunks: string[] = [];

    // Method 1: Look for BT...ET text blocks
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btEtRegex.exec(pdfString)) !== null) {
        const block = match[1];
        // Extract text from Tj and TJ operators
        const tjRegex = /\((.*?)\)\s*Tj/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(block)) !== null) {
            textChunks.push(tjMatch[1]);
        }
    }

    // Method 2: Look for plain text strings
    const stringRegex = /\(([^()]{3,})\)/g;
    while ((match = stringRegex.exec(pdfString)) !== null) {
        const text = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');

        // Only add if it looks like readable text
        if (/[\u0600-\u06FFa-zA-Z]{2,}/.test(text)) {
            textChunks.push(text);
        }
    }

    // Method 3: Look for stream content with readable text
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    while ((match = streamRegex.exec(pdfString)) !== null) {
        const streamContent = match[1];
        // Look for readable strings
        const readableMatch = streamContent.match(/[\u0600-\u06FFa-zA-Z0-9@.\s\-+()]{10,}/g);
        if (readableMatch) {
            textChunks.push(...readableMatch);
        }
    }

    const extractedText = textChunks.join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return extractedText;
}

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
        let extractedText = extractTextFromPDF(arrayBuffer);

        // If extraction failed or got too little text, try base64 approach
        if (extractedText.length < 100) {
            // Convert to base64 for AI to analyze (Vision fallback)
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer).slice(0, 50000)));

            // Ask AI to try to understand the PDF structure
            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'GLM-4.7',
                    messages: [
                        { role: 'system', content: PDF_ANALYSIS_PROMPT },
                        {
                            role: 'user',
                            content: `لم أتمكن من استخراج نص كافٍ من ملف PDF. المحتوى المستخرج: "${extractedText}". 
                            
يرجى إنشاء هيكل JSON فارغ للسيرة الذاتية مع ملء الحقول التي يمكنك استنتاجها من هذا المحتوى المحدود.`
                        }
                    ],
                    temperature: 0.3,
                    stream: false,
                }),
            });

            if (!response.ok) {
                return new Response(
                    JSON.stringify({
                        error: "لم نتمكن من قراءة محتوى الملف. جرب لصق محتوى السيرة كنص بدلاً من ذلك.",
                        fallback: true
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const cvData = JSON.parse(jsonMatch[0]);
                    return new Response(
                        JSON.stringify({
                            cvData,
                            rawText: extractedText,
                            warning: "تم استخراج محتوى محدود من الملف. يُنصح بمراجعة البيانات.",
                            message: "تم تحليل الملف (محتوى محدود)"
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } catch {
                // Continue to fallback
            }

            return new Response(
                JSON.stringify({
                    error: "لم نتمكن من قراءة محتوى الملف. جرب لصق محتوى السيرة كنص.",
                    fallback: true
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
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
                model: 'GLM-4.7',
                messages: [
                    { role: 'system', content: PDF_ANALYSIS_PROMPT },
                    { role: 'user', content: `حلل النص التالي المستخرج من سيرة ذاتية PDF:\n\n${extractedText.substring(0, 8000)}` }
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
                rawText: extractedText.substring(0, 1000),
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
