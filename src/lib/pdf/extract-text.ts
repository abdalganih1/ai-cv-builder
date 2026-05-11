/**
 * PDF Text Extraction - استخراج النص من ملفات PDF
 *
 * يدعم الأوضاع التالية:
 * 1. Fast regex extraction (fallback) - سريع جداً، يُجرَّب أولاً
 * 2. Self-hosted API (PDF_API_URL) - لنشر على VPS
 * 3. OCR.space API (OCR_SPACE_API_KEY) - لنشر على Cloudflare
 *
 * ⚠️ ملاحظة: لا يستخدم أي وحدات Node.js (fs, child_process, etc.)
 * لضمان التوافق مع Cloudflare Edge Runtime
 */

export interface ExtractionResult {
    text: string;
    profileImage?: string;
}

/**
 * استخراج النص من PDF - يختار أفضل طريقة تلقائياً
 *
 * التحسين الجديد: يجرّب fallbackExtractText أولاً
 * إذا النص كافي (> 200 حرف) يستخدمه مباشرة بدون OCR
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractionResult> {
    // 🔥 تحسين: جرّب الاستخراج السريع أولاً
    const fastText = fallbackExtractText(buffer);
    if (fastText.length > 200) {
        console.log(`⚡ Fast extraction succeeded: ${fastText.length} chars (skipping OCR)`);
        return { text: fastText };
    }

    console.log(`⚠️ Fast extraction got only ${fastText.length} chars, trying full extraction...`);

    const PDF_API_URL = process.env.PDF_API_URL;
    const PDF_API_KEY = process.env.PDF_API_KEY;
    const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;

    // Mode 1: Self-hosted API (VPS with Docker)
    if (PDF_API_URL) {
        console.log('🔧 Using Self-hosted PDF API');
        const result = await extractViaSelfHostedAPI(buffer, PDF_API_URL, PDF_API_KEY || '');
        if (result.text.length > fastText.length) return result;
        // إذا النتيجة أسوأ من fallback، أرجع fallback
        return { text: fastText, profileImage: result.profileImage };
    }

    // Mode 2: OCR.space API (Cloudflare deployment)
    if (OCR_SPACE_API_KEY) {
        console.log('☁️ Using OCR.space API');
        const result = await extractViaOCRSpace(buffer, OCR_SPACE_API_KEY);
        if (result.text.length > fastText.length) return result;
        return { text: fastText, profileImage: result.profileImage };
    }

    // Mode 3: No API configured — return fast extraction result
    console.log('📝 No PDF API configured, using fast text extraction only');
    return { text: fastText };
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