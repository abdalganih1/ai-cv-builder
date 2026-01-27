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
 */
export async function processEditRequest(data: CVData, request: string): Promise<CVData> {
    const systemPrompt = `
أنت مساعد تحرير سير ذاتية. يجب أن تُعيد JSON فقط.

⚠️ قاعدة صارمة: الرد يجب أن يبدأ بـ { وينتهي بـ } - لا كلام قبلها ولا بعدها!

${CV_EDIT_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
📄 السيرة الذاتية الحالية:
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(data, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
✏️ طلب المستخدم:
═══════════════════════════════════════════════════════════════════════════════
"${request}"

🔴 أعِد JSON فقط! ابدأ بـ { مباشرة:
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: 'أنت مساعد يُعيد JSON فقط. لا تكتب أي نص آخر.' },
            { role: 'user', content: systemPrompt }
        ]);

        const content = response.choices[0].message.content;

        try {
            const cleanJson = extractJSON(content);
            return JSON.parse(cleanJson);
        } catch (parseError) {
            console.warn("⚠️ JSON extraction failed. Retrying with correction prompt...");

            // Auto-Correction Retry
            const retryResponse = await chatWithAI([
                { role: 'system', content: 'أنت مساعد يُعيد JSON فقط.' },
                { role: 'user', content: systemPrompt },
                { role: 'assistant', content: content }, // Pass strict wrong response
                { role: 'user', content: 'عذراً، الرد لم يكن JSON صالحاً. أعد الرد بصيغة JSON فقط، بدون أي نص إضافي.' }
            ]);

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
أنت خبير سير ذاتية. يجب أن تُعيد JSON فقط.

⚠️ قاعدة صارمة: الرد يجب أن يبدأ بـ { وينتهي بـ } - لا كلام قبلها ولا بعدها!

${CV_GENERATOR_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
📄 البيانات الخام للمستخدم:
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(data, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
🎯 المطلوب:
═══════════════════════════════════════════════════════════════════════════════
1. اكتب نبذة تعريفية احترافية (summary)
2. حسّن وصف كل خبرة عملية
3. رتّب المهارات حسب الأهمية
4. حسّن المسمى الوظيفي

🔴 أعِد JSON فقط! ابدأ بـ { مباشرة:
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: 'أنت مساعد يُعيد JSON فقط. لا تكتب أي نص آخر. ابدأ ردك بـ { مباشرة.' },
            { role: 'user', content: systemPrompt }
        ]);

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
        } catch (parseError) {
            console.warn("⚠️ JSON extraction failed. Retrying with correction prompt...");

            // Auto-Correction Retry for Generation
            const retryResponse = await chatWithAI([
                { role: 'system', content: 'أنت مساعد يُعيد JSON فقط.' },
                { role: 'user', content: systemPrompt },
                { role: 'assistant', content: content },
                { role: 'user', content: 'عذراً، الرد لم يكن JSON صالحاً. أعد الرد بصيغة JSON فقط.' }
            ]);

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
