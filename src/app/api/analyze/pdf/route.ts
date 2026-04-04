import { NextRequest } from 'next/server';

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

// =============================================
// PDF TEXT EXTRACTION - DUAL MODE SUPPORT
// =============================================
// Mode 1: Self-hosted API (PDF_API_URL set) → VPS deployment
// Mode 2: OCR.space API (OCR_SPACE_API_KEY set) → Cloudflare deployment  
// Mode 3: Python child_process (fallback) → Local development
// =============================================

interface ExtractionResult {
    text: string;
    profileImage?: string;
}

// Main extraction function - auto-selects best method
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractionResult> {
    const PDF_API_URL = process.env.PDF_API_URL;
    const PDF_API_KEY = process.env.PDF_API_KEY;
    const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;

    // Mode 1: Self-hosted API (VPS with Docker)
    if (PDF_API_URL) {
        console.log('🔧 Using Self-hosted PDF API');
        return extractViaSelfHostedAPI(buffer, PDF_API_URL, PDF_API_KEY || '');
    }

    // Mode 2: OCR.space API (Cloudflare deployment)
    if (OCR_SPACE_API_KEY) {
        console.log('☁️ Using OCR.space API');
        return extractViaOCRSpace(buffer, OCR_SPACE_API_KEY);
    }

    // Mode 3: Python child_process (local development)
    console.log('🐍 Using Python PyMuPDF (local)');
    return extractViaPython(buffer);
}

// Method 1: Self-hosted FastAPI server
async function extractViaSelfHostedAPI(
    buffer: ArrayBuffer,
    apiUrl: string,
    apiKey: string
): Promise<ExtractionResult> {
    try {
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: 'application/pdf' }), 'document.pdf');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Self-hosted API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Self-hosted extracted ${data.text_length} chars, ${data.images_count} images`);
            return {
                text: data.text,
                profileImage: data.profile_image_base64
            };
        }

        throw new Error(data.error || 'Extraction failed');
    } catch (error) {
        console.error('Self-hosted API error:', error);
        // Fallback to OCR.space if configured
        const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;
        if (OCR_SPACE_API_KEY) {
            return extractViaOCRSpace(buffer, OCR_SPACE_API_KEY);
        }
        return { text: fallbackExtractText(buffer) };
    }
}

// Method 2: OCR.space API (Cloudflare compatible)
async function extractViaOCRSpace(
    buffer: ArrayBuffer,
    apiKey: string
): Promise<ExtractionResult> {
    try {
        // Convert to base64 safely (avoid stack overflow on large files)
        const uint8Array = new Uint8Array(buffer);
        let base64 = '';

        // Use Buffer if available (Node.js), otherwise chunk manually
        if (typeof Buffer !== 'undefined') {
            base64 = Buffer.from(uint8Array).toString('base64');
        } else {
            // Fallback: chunk-based conversion for Edge runtime
            const CHUNK_SIZE = 32768; // 32KB chunks
            const chunks: string[] = [];
            for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
                const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
                chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
            }
            base64 = btoa(chunks.join(''));
        }

        const formData = new FormData();
        formData.append('base64Image', `data:application/pdf;base64,${base64}`);
        formData.append('language', 'ara');  // Arabic
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '1');  // Engine 1 supports Arabic

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': apiKey,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`OCR.space API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.ParsedResults && data.ParsedResults.length > 0) {
            const text = data.ParsedResults
                .map((result: { ParsedText: string }) => result.ParsedText)
                .join('\n\n');

            console.log(`✅ OCR.space extracted ${text.length} chars`);
            return { text };
        }

        if (data.ErrorMessage) {
            throw new Error(data.ErrorMessage);
        }

        throw new Error('No text extracted');
    } catch (error) {
        console.error('OCR.space API error:', error);
        return { text: fallbackExtractText(buffer) };
    }
}

// Method 3: Python PyMuPDF (local development)
// Note: This function uses Node.js APIs not available in Edge Runtime
// It will only work in local development or Node.js server
async function extractViaPython(buffer: ArrayBuffer): Promise<ExtractionResult> {
    // Edge Runtime doesn't support fs, path, child_process, os modules
    // Always return fallback in Edge Runtime
    try {
        // Check if we're in Edge Runtime by checking for unavailable APIs
        // Using typeof check to avoid bundler issues
        if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge') {
            console.log('⚠️ Python extraction not available in Edge Runtime');
            return { text: fallbackExtractText(buffer) };
        }

        // Try to use Node.js modules if available
        // This will only work in Node.js runtime (local development)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('child_process');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const os = require('os');

        const tempDir = os.tmpdir();
        const tempPdfPath = path.join(tempDir, `cv_upload_${Date.now()}.pdf`);
        // Use process.cwd() only in Node.js runtime where it's available
        const cwd = typeof process.cwd === 'function' ? process.cwd() : '.';
        const scriptPath = path.join(cwd, 'scripts', 'pdf_text_extractor.py');

        try {
            fs.writeFileSync(tempPdfPath, Buffer.from(buffer));

            const result = execSync(`python "${scriptPath}" "${tempPdfPath}"`, {
                encoding: 'utf-8',
                maxBuffer: 50 * 1024 * 1024,
                timeout: 60000
            });

            const parsed = JSON.parse(result);

            if (parsed.success && parsed.text) {
                console.log(`✅ PyMuPDF extracted ${parsed.text_length} chars, ${parsed.images_count} images`);
                return {
                    text: parsed.text,
                    profileImage: parsed.profile_image_base64
                };
            }
            throw new Error(parsed.error || 'Unknown extraction error');
        } finally {
            try { fs.unlinkSync(tempPdfPath); } catch { /* ignore */ }
        }
    } catch (error) {
        console.error('Python extraction error:', error);
        return { text: fallbackExtractText(buffer) };
    }
}

// Fallback regex-based extraction (for extreme edge cases)
function fallbackExtractText(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const pdfString = new TextDecoder('latin1').decode(bytes);
    const textChunks: string[] = [];
    const seen = new Set<string>();

    const textRegex = /\(([^\(\)]+)\)/g;
    let match;
    while ((match = textRegex.exec(pdfString)) !== null) {
        const text = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, ' ')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .trim();

        if (text.length > 1 && /[\u0600-\u06FFa-zA-Z0-9@.\-+]/.test(text) && !seen.has(text)) {
            textChunks.push(text);
            seen.add(text);
        }
    }

    return textChunks.join('\n').replace(/\n+/g, '\n').trim();
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
        const extractedData = await extractTextFromPDF(arrayBuffer);
        const extractedText = extractedData.text;
        const profileImage = extractedData.profileImage;

        console.log('--- DEBUG: Extracted Text Start ---');
        console.log(extractedText.substring(0, 500)); // Log first 500 chars
        console.log(`--- DEBUG: Total Length: ${extractedText.length} chars ---`);
        if (profileImage) console.log('✅ Profile image detected!');

        // If extraction failed or got too little text, try base64 approach
        if (extractedText.length < 100) {
            // Convert to base64 for AI to analyze (Vision)
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer).slice(0, 50000)));

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
