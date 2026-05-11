/**
 * PDF Text Extraction - استخراج النص من ملفات PDF
 *
 * سلسلة الاستخراج:
 * 1. Fast regex extraction (fallback) - سريع جداً، يُجرَّب أولاً
 * 2. Gemini Vision via LiteLLM (الأفضل للعربي)
 * 3. Self-hosted API (PDF_API_URL) - لنشر على VPS
 * 4. OCR.space API (OCR_SPACE_API_KEY) - احتياطي
 *
 * ⚠️ ملاحظة: لا يستخدم أي وحدات Node.js (fs, child_process, etc.)
 * لضمان التوافق مع Cloudflare Edge Runtime
 */

import { getRequestContext } from '@cloudflare/next-on-pages';

export interface ExtractionResult {
    text: string;
    profileImage?: string;
}

/**
 * يكتشف إذا النص المستخرج هو garbage (بيانات مشفرة)
 * يحسب نسبة الأحرف القابلة للقراءة (عربي + إنكليزي + أرقام + رموز شائعة)
 */
function isReadableText(text: string): boolean {
    if (text.length < 50) return false;

    // عدّ الأحرف القابلة للقراءة
    const readableChars = text.replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9\s@.\-+(),;:!?\/\\\[\]{}'"]/g, '');
    const ratio = readableChars.length / text.length;

    console.log(`📊 Text readability: ${(ratio * 100).toFixed(1)}% readable (${readableChars.length}/${text.length})`);

    // إذا أقل من 40% أحرف قابلة للقراءة → garbage
    return ratio > 0.4;
}

/**
 * استخراج النص من PDF - يختار أفضل طريقة تلقائياً
 *
 * السلسلة: regex → Gemini Vision → Self-hosted → OCR.space → fallback
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractionResult> {
    // قراءة المفاتيح من Cloudflare secrets + process.env
    let cfEnv: Record<string, unknown> | undefined;
    try { cfEnv = getRequestContext().env as unknown as Record<string, unknown>; } catch { /* local dev */ }

    const OCR_SPACE_API_KEY = (cfEnv?.OCR_SPACE_API_KEY as string) || process.env.OCR_SPACE_API_KEY;
    const PDF_API_URL = (cfEnv?.PDF_API_URL as string) || process.env.PDF_API_URL;
    const PDF_API_KEY = (cfEnv?.PDF_API_KEY as string) || process.env.PDF_API_KEY;
    const LITELLM_BASE_URL = (cfEnv?.LITELLM_BASE_URL as string) || process.env.LITELLM_BASE_URL;
    const LITELLM_API_KEY = (cfEnv?.LITELLM_API_KEY as string) || process.env.LITELLM_API_KEY;

    // 1️⃣ جرّب الاستخراج السريع أولاً
    const fastText = fallbackExtractText(buffer);
    const isFastUsable = fastText.length > 200 && isReadableText(fastText);

    if (isFastUsable) {
        console.log(`⚡ Fast extraction succeeded: ${fastText.length} readable chars`);
        return { text: fastText };
    }

    console.log(`⚠️ Fast extraction: ${fastText.length} chars but GARBAGE — trying alternatives...`);

    // 2️⃣ Gemini Vision عبر LiteLLM (الأفضل للعربي)
    if (LITELLM_BASE_URL && LITELLM_API_KEY) {
        try {
            console.log('🔍 Using Gemini Vision via LiteLLM...');
            const result = await extractViaGeminiVision(buffer, LITELLM_BASE_URL, LITELLM_API_KEY);
            if (result.text.length > 50 && isReadableText(result.text)) return result;
            console.log('⚠️ Gemini Vision result not usable, trying next method...');
        } catch {
            console.log('⚠️ Gemini Vision failed, trying next method...');
        }
    }

    // 3️⃣ Self-hosted API (VPS with Docker)
    if (PDF_API_URL) {
        console.log('🔧 Using Self-hosted PDF API');
        const result = await extractViaSelfHostedAPI(buffer, PDF_API_URL, PDF_API_KEY || '', OCR_SPACE_API_KEY);
        if (result.text.length > fastText.length && isReadableText(result.text)) return result;
        return { text: fastText, profileImage: result.profileImage };
    }

    // 4️⃣ OCR.space API (احتياطي)
    if (OCR_SPACE_API_KEY) {
        console.log('☁️ Using OCR.space API');
        const result = await extractViaOCRSpace(buffer, OCR_SPACE_API_KEY);
        if (result.text.length > fastText.length && isReadableText(result.text)) return result;
        return { text: fastText, profileImage: result.profileImage };
    }

    // 5️⃣ لا API — إرجاع النص الخام
    console.log('📝 No PDF API configured, using fast text extraction only');
    return { text: fastText };
}

// Method 1: Gemini Vision via LiteLLM proxy (الأفضل للعربي)
async function extractViaGeminiVision(
    buffer: ArrayBuffer,
    baseUrl: string,
    apiKey: string
): Promise<ExtractionResult> {
    // تحويل PDF لـ base64 (Edge Runtime compatible)
    const uint8Array = new Uint8Array(buffer);
    const CHUNK_SIZE = 32768;
    const chunks: string[] = [];
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    const base64 = btoa(chunks.join(''));

    console.log(`🔍 Gemini Vision: sending ${base64.length} base64 chars...`);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gemini/gemini-3.1-flash-lite-preview',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'استخرج كل النص الموجود في هذا الملف PDF بالكامل. أرجع النص فقط بدون أي تعليقات أو إضافات.'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:application/pdf;base64,${base64}`
                        }
                    }
                ]
            }],
            max_tokens: 4000,
            temperature: 0.1,
        }),
        signal: AbortSignal.timeout(25000), // 25s timeout
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Gemini Vision API error: ${response.status} ${errorBody.substring(0, 200)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (text.length > 50) {
        console.log(`✅ Gemini Vision extracted ${text.length} chars`);
        return { text };
    }

    throw new Error('Gemini Vision returned empty text');
}

// Method 2: Self-hosted FastAPI server
async function extractViaSelfHostedAPI(
    buffer: ArrayBuffer,
    apiUrl: string,
    apiKey: string,
    ocrSpaceApiKey?: string
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
        if (ocrSpaceApiKey) {
            return extractViaOCRSpace(buffer, ocrSpaceApiKey);
        }
        return { text: fallbackExtractText(buffer) };
    }
}

// Method 3: OCR.space API (Cloudflare compatible)
async function extractViaOCRSpace(
    buffer: ArrayBuffer,
    apiKey: string
): Promise<ExtractionResult> {
    try {
        // Convert to base64 using chunk-based method (Edge Runtime compatible)
        // Avoids: Buffer.from() (not in Cloudflare Workers), spread operator stack overflow
        const uint8Array = new Uint8Array(buffer);
        const CHUNK_SIZE = 32768; // 32KB chunks
        const chunks: string[] = [];
        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
            chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
        }
        const base64 = btoa(chunks.join(''));

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

/**
 * Fallback regex-based extraction (for extreme edge cases)
 * سريع جداً (< 1 ثانية) لكن أقل دقة من OCR للملفات المعقدة
 */
export function fallbackExtractText(buffer: ArrayBuffer): string {
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