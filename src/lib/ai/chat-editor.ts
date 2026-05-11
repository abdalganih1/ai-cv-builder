import { CVData } from '../types/cv-schema';
import { chatWithAI } from './zai-client';
import { CV_EDIT_SYSTEM_PROMPT, CV_GENERATOR_SYSTEM_PROMPT } from './system-prompts';

/**
 * Extracts JSON from AI response, handling various formats
 */
function extractJSON(content: string): string {
    if (!content || content.trim() === '') {
        throw new Error("Empty AI response");
    }

    console.log('🤖 Raw AI response (first 500 chars):', content.substring(0, 500));

    // Try to find JSON object
    const firstOpen = content.indexOf('{');
    const lastClose = content.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        return content.substring(firstOpen, lastClose + 1);
    }

    // If no braces found, log the full response for debugging
    console.error('❌ No JSON braces found. Full response:', content);
    throw new Error("No JSON found in AI response");
}

/**
 * Process a user's edit request using the AI Agent
 * Optimized for faster response with compact prompts
 */
export async function processEditRequest(data: CVData, request: string, language: 'ar' | 'en' = 'ar'): Promise<CVData> {
    // Create a compact version of data WITHOUT the photoUrl (base64 images are huge!)
    const dataWithoutPhoto = {
        ...data,
        personal: {
            ...data.personal,
            photoUrl: data.personal.photoUrl ? '[PHOTO]' : undefined
        }
    };
    const compactData = JSON.stringify(dataWithoutPhoto);

    // Check data size and truncate if too large (increased since we removed photo)
    const maxDataSize = 12000; // chars - increased since photo is removed
    const dataToSend = compactData.length > maxDataSize
        ? compactData.substring(0, maxDataSize) + '..."}'
        : compactData;

    // Streamlined prompt - shorter and more focused
    let systemPrompt = '';

    if (language === 'en') {
        systemPrompt = `You are an expert CV editor. Edit the CV data based on the user's request.
Rules:
1. Output VALID JSON only (no markdown).
2. Keep the same structure.
3. Edit ONLY what the user asks.
4. Keep photoUrl as "[PHOTO]" or empty.
5. If the user asks to change a value, use the English text provided.

Current Data:
${dataToSend}

User Request: "${request}"

Return Modified JSON:`;
    } else {
        systemPrompt = `أنت خبير تعديل سير ذاتية. عدّل البيانات حسب الطلب.
قواعد: 
1. أرجع JSON صالح فقط (بدون markdown)
2. احتفظ بالهيكل نفسه
3. عدّل فقط ما يطلبه المستخدم
4. احتفظ بـ photoUrl كما هو إذا كان "[PHOTO]" أو فارغ
5. وإذا طلب المستخدم تغيير الاسم أو أي نص إلى الإنجليزية، استبدل القيمة بالنص الإنجليزي كما هو.
6. إذا طلب تصحيح اسم (Capitalization/Spelling)، التزم بالتصحيح حرفياً.

البيانات الحالية:
${dataToSend}

طلب التعديل: "${request}"

أرجع JSON المُعدَّل:`;
    }

    try {
        // Single call with optimized settings
        const response = await chatWithAI([
            { role: 'user', content: systemPrompt }
        ], { temperature: 0.1, stream: true });

        const content = response.choices[0].message.content;

        // Check for empty response
        if (!content || content.trim() === '') {
            console.error('❌ Empty response from AI');
            throw new Error('لم يتم استلام رد من الذكاء الاصطناعي');
        }

        try {
            const cleanJson = extractJSON(content);
            const parsedData = JSON.parse(cleanJson);

            // Merge with original data to preserve photoUrl
            return {
                ...data,
                ...parsedData,
                personal: {
                    ...data.personal,
                    ...parsedData.personal,
                    photoUrl: data.personal.photoUrl // Always preserve original photo
                }
            };
        } catch (_parseError) {
            console.warn("⚠️ JSON parse failed, trying fix...", _parseError);

            // Quick retry without full context
            const retryResponse = await chatWithAI([
                { role: 'user', content: `أصلح هذا JSON واجعله صالحاً:\n${content}\n\nأرجع JSON صالح فقط:` }
            ], { temperature: 0 });

            const retryContent = retryResponse.choices[0].message.content;

            if (!retryContent || retryContent.trim() === '') {
                throw new Error('فشل إصلاح الرد');
            }

            const cleanRetryJson = extractJSON(retryContent);
            const parsedRetryData = JSON.parse(cleanRetryJson);

            return {
                ...data,
                ...parsedRetryData,
                personal: {
                    ...data.personal,
                    ...parsedRetryData.personal,
                    photoUrl: data.personal.photoUrl
                }
            };
        }

    } catch (error) {
        console.error("Failed to process edit:", error);

        // Provide more descriptive error
        if (error instanceof Error) {
            if (error.message.includes('timeout') || error.message.includes('مهلة')) {
                throw new Error('انتهت مهلة الطلب. يرجى المحاولة بطلب أقصر.');
            }
            if (error.message.includes('JSON')) {
                throw new Error('حدث خطأ في معالجة الرد. يرجى إعادة صياغة الطلب.');
            }
        }
        throw error;
    }
}

/**
 * Auto-generate a complete professional CV from raw user data
 */
export async function generateProfessionalCV(data: CVData): Promise<CVData> {
    // Remove photoUrl from data sent to AI (base64 images are huge and slow down the request)
    const dataForAI = {
        ...data,
        personal: {
            ...data.personal,
            photoUrl: data.personal.photoUrl ? '[PHOTO]' : undefined
        }
    };

    const systemPrompt = `
${CV_GENERATOR_SYSTEM_PROMPT}

IMPORTANT: You are a JSON-only API. You must output VALID JSON matching the CVData schema.
Do NOT use Markdown blocks. Do NOT add preamble. Start with '{'.

CRITICAL INSTRUCTION:
All string values (names, descriptions, roles, degrees, etc.) MUST be in **ARABIC** (اللغة العربية).
If the input data is in English, you MUST **TRANSLATE** it to professional Arabic.
Exception: Technical terms (Java, SQL, React) should remain in English.

Current Data:
${JSON.stringify(dataForAI, null, 2)}

Task: Enhance this CV data professionally. Improve summaries, use action verbs for experience, and structure skills.
Everything MUST be in Arabic.

Output JSON only:
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: 'You are a professional Arabic CV Expert. You output JSON only. You TRANSLATE everything to Arabic.' },
            { role: 'user', content: systemPrompt }
        ], { temperature: 0.2 });

        const content = response.choices[0].message.content;
        console.log('🤖 CV Generation - Response received, length:', content?.length || 0);

        try {
            const cleanJson = extractJSON(content);
            const enhancedData = JSON.parse(cleanJson);
            // Merge enhanced data with original to preserve metadata, IDs, AND photoUrl
            return {
                ...data,
                personal: {
                    ...data.personal,
                    ...enhancedData.personal,
                    photoUrl: data.personal.photoUrl // Preserve original photoUrl
                },
                education: enhancedData.education || data.education,
                experience: enhancedData.experience || data.experience,
                skills: enhancedData.skills || data.skills,
                hobbies: enhancedData.hobbies || data.hobbies,
                languages: enhancedData.languages || data.languages
            };
        } catch (_parseError) {
            console.warn("⚠️ JSON extraction failed. Retrying with correction prompt...", _parseError);

            // Auto-Correction Retry for Generation
            const retryResponse = await chatWithAI([
                { role: 'system', content: 'You are a JSON generator. Output valid JSON only.' },
                { role: 'user', content: systemPrompt },
                { role: 'assistant', content: content },
                { role: 'user', content: 'ERROR: Your last response was not valid JSON. Please fix it and return ONLY valid JSON.' }
            ], { temperature: 0.1 });

            const retryContent = retryResponse.choices[0].message.content;
            const cleanRetryJson = extractJSON(retryContent);
            const enhancedRetryData = JSON.parse(cleanRetryJson);

            return {
                ...data,
                personal: {
                    ...data.personal,
                    ...enhancedRetryData.personal,
                    photoUrl: data.personal.photoUrl // Preserve original photoUrl
                },
                education: enhancedRetryData.education || data.education,
                experience: enhancedRetryData.experience || data.experience,
                skills: enhancedRetryData.skills || data.skills,
                hobbies: enhancedRetryData.hobbies || data.hobbies,
                languages: enhancedRetryData.languages || data.languages
            };
        }

    } catch (error) {
        console.error("Failed to generate professional CV:", error);
        // Return original data if AI fails
        return data;
    }
}

/**
 * Translate CV data from Arabic to English
 * Optimized for fast translation with professional language
 */
export async function translateCVToEnglish(data: CVData): Promise<CVData> {
    // Remove photoUrl from data sent to AI (base64 images are huge!)
    const dataForAI = {
        ...data,
        personal: {
            ...data.personal,
            photoUrl: data.personal.photoUrl ? '[PHOTO]' : undefined
        }
    };

    const compactData = JSON.stringify(dataForAI);

    // Truncate if too large (increased since we removed photo)
    const maxDataSize = 15000;
    const dataToSend = compactData.length > maxDataSize
        ? compactData.substring(0, maxDataSize) + '..."}'
        : compactData;

    const prompt = `Translate this Arabic CV to professional English. Keep the same JSON structure.

Rules:
1. Output valid JSON only (no markdown)
2. Translate ALL Arabic text to English
3. Keep technical terms (React, Python, etc.) as-is
4. If a value is already in English (e.g. name is "Mohammed"), keep it EXACTLY as-is. Do not transliterate it back.
5. Use professional CV language (action verbs, concise)
6. Preserve dates, emails, phones exactly as-is
7. Keep photoUrl as "[PHOTO]" if present

Arabic CV Data:
${dataToSend}

English CV JSON:`;

    try {
        const response = await chatWithAI([
            { role: 'user', content: prompt }
        ], { temperature: 0.2, stream: true });

        const content = response.choices[0].message.content;

        // Merge to preserve IDs and metadata - map each item to keep original IDs
        const mergeWithIds = <T extends { id?: string }>(
            original: T[] | undefined,
            translated: T[] | undefined
        ): T[] => {
            if (!translated || !Array.isArray(translated)) return original || [];
            if (!original || !Array.isArray(original)) return translated;

            return translated.map((item, idx) => ({
                ...item,
                id: original[idx]?.id || `item-${idx}-${Date.now()}`
            }));
        };

        try {
            const cleanJson = extractJSON(content);
            const translatedData = JSON.parse(cleanJson);

            return {
                ...data,
                personal: {
                    ...data.personal,
                    ...translatedData.personal,
                    photoUrl: data.personal.photoUrl // Preserve original photoUrl
                },
                education: mergeWithIds(data.education, translatedData.education),
                experience: mergeWithIds(data.experience, translatedData.experience),
                skills: translatedData.skills || data.skills || [],
                hobbies: translatedData.hobbies || data.hobbies || [],
                languages: translatedData.languages || data.languages || []
            };
        } catch (_parseError) {
            console.warn("⚠️ Translation JSON parse failed, retrying...");

            const retryResponse = await chatWithAI([
                { role: 'user', content: `Fix this JSON and return valid JSON only:\n${content}` }
            ], { temperature: 0 });

            const retryContent = retryResponse.choices[0].message.content;
            const cleanRetryJson = extractJSON(retryContent);
            const retryData = JSON.parse(cleanRetryJson);

            // نفس منطق الدمج — الحفاظ على photoUrl و metadata و IDs
            return {
                ...data,
                personal: {
                    ...data.personal,
                    ...retryData.personal,
                    photoUrl: data.personal.photoUrl, // ✅ الحفاظ على الصورة
                },
                education: mergeWithIds(data.education, retryData.education),
                experience: mergeWithIds(data.experience, retryData.experience),
                skills: retryData.skills || data.skills || [],
                hobbies: retryData.hobbies || data.hobbies || [],
                languages: retryData.languages || data.languages || [],
            };
        }

    } catch (error) {
        console.error("Failed to translate CV:", error);
        throw error;
    }
}
