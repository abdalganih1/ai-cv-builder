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
export async function processEditRequest(data: CVData, request: string): Promise<CVData> {
    // Create a compact version of data (no pretty print, minimal structure)
    const compactData = JSON.stringify(data);

    // Check data size and truncate if too large
    const maxDataSize = 8000; // chars
    const dataToSend = compactData.length > maxDataSize
        ? compactData.substring(0, maxDataSize) + '..."}'
        : compactData;

    // Streamlined prompt - shorter and more focused
    const systemPrompt = `أنت خبير تعديل سير ذاتية. عدّل البيانات حسب الطلب.
قواعد: 
1. أرجع JSON صالح فقط (بدون markdown)
2. احتفظ بالهيكل نفسه
3. عدّل فقط ما يطلبه المستخدم

البيانات الحالية:
${dataToSend}

طلب التعديل: "${request}"

أرجع JSON المُعدَّل:`;

    try {
        // Single call with optimized settings
        const response = await chatWithAI([
            { role: 'user', content: systemPrompt }
        ], { temperature: 0.1, stream: true });

        const content = response.choices[0].message.content;

        try {
            const cleanJson = extractJSON(content);
            return JSON.parse(cleanJson);
        } catch (_parseError) {
            console.warn("⚠️ JSON parse failed, trying fix...");

            // Quick retry without full context
            const retryResponse = await chatWithAI([
                { role: 'user', content: `أصلح هذا JSON واجعله صالحاً:\n${content}\n\nأرجع JSON صالح فقط:` }
            ], { temperature: 0 });

            const retryContent = retryResponse.choices[0].message.content;
            const cleanRetryJson = extractJSON(retryContent);
            return JSON.parse(cleanRetryJson);
        }

    } catch (error) {
        console.error("Failed to process edit:", error);
        throw error;
    }
}

/**
 * Auto-generate a complete professional CV from raw user data
 */
export async function generateProfessionalCV(data: CVData): Promise<CVData> {

    const systemPrompt = `
${CV_GENERATOR_SYSTEM_PROMPT}

IMPORTANT: You are a JSON-only API. You must output VALID JSON matching the CVData schema.
Do NOT use Markdown blocks. Do NOT add preamble. Start with '{'.

CRITICAL INSTRUCTION:
All string values (names, descriptions, roles, degrees, etc.) MUST be in **ARABIC** (اللغة العربية).
If the input data is in English, you MUST **TRANSLATE** it to professional Arabic.
Exception: Technical terms (Java, SQL, React) should remain in English.

Current Data:
${JSON.stringify(data, null, 2)}

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
            // Merge enhanced data with original to preserve metadata and IDs
            return {
                ...data,
                personal: { ...data.personal, ...enhancedData.personal },
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
                personal: { ...data.personal, ...enhancedRetryData.personal },
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
    const compactData = JSON.stringify(data);

    // Truncate if too large
    const maxDataSize = 10000;
    const dataToSend = compactData.length > maxDataSize
        ? compactData.substring(0, maxDataSize) + '..."}'
        : compactData;

    const prompt = `Translate this Arabic CV to professional English. Keep the same JSON structure.

Rules:
1. Output valid JSON only (no markdown)
2. Translate ALL Arabic text to English
3. Keep technical terms (React, Python, etc.) as-is
4. Use professional CV language (action verbs, concise)
5. Preserve dates, emails, phones exactly as-is

Arabic CV Data:
${dataToSend}

English CV JSON:`;

    try {
        const response = await chatWithAI([
            { role: 'user', content: prompt }
        ], { temperature: 0.2, stream: true });

        const content = response.choices[0].message.content;

        try {
            const cleanJson = extractJSON(content);
            const translatedData = JSON.parse(cleanJson);

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

            return {
                ...data,
                personal: { ...data.personal, ...translatedData.personal },
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
            return JSON.parse(cleanRetryJson);
        }

    } catch (error) {
        console.error("Failed to translate CV:", error);
        throw error;
    }
}
