import { CVData } from '../types/cv-schema';
import { chatWithAI } from './zai-client';
import { CV_EDIT_SYSTEM_PROMPT, CV_GENERATOR_SYSTEM_PROMPT } from './system-prompts';

/**
 * Process a user's edit request using the AI Agent
 */
export async function processEditRequest(data: CVData, request: string): Promise<CVData> {
    const systemPrompt = `
${CV_EDIT_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
📄 السيرة الذاتية الحالية (Current CV JSON):
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(data, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
✏️ طلب المستخدم (User Request):
═══════════════════════════════════════════════════════════════════════════════
"${request}"

أعِد الآن JSON المُعدَّل فقط بدون أي شرح إضافي.
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: request }
        ]);

        const content = response.choices[0].message.content;

        // Robust JSON extraction: find the first '{' and the last '}'
        const firstOpen = content.indexOf('{');
        const lastClose = content.lastIndexOf('}');

        if (firstOpen === -1 || lastClose === -1) {
            throw new Error("No JSON found in AI response");
        }

        const cleanJson = content.substring(firstOpen, lastClose + 1);
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Failed to process edit:", error);
        throw error;
    }
}

/**
 * Auto-generate a complete professional CV from raw user data
 * This is called after the questionnaire is complete
 */
export async function generateProfessionalCV(data: CVData): Promise<CVData> {
    const systemPrompt = `
${CV_GENERATOR_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════════════════════
📄 البيانات الخام للمستخدم (Raw User Data):
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(data, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
🎯 المطلوب:
═══════════════════════════════════════════════════════════════════════════════
1. اكتب نبذة تعريفية احترافية (summary) بناءً على الخبرات والمهارات
2. حسّن وصف كل خبرة عملية بصيغة CAR مع أفعال قوية
3. رتّب المهارات حسب الأهمية
4. أضف وصفاً مختصراً للتعليم إن أمكن
5. حسّن المسمى الوظيفي ليكون أكثر احترافية

أعِد الآن JSON الكامل المُحسَّن.
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'أنشئ لي سيرة ذاتية احترافية كاملة' }
        ]);

        const content = response.choices[0].message.content;
        // Robust JSON extraction
        const firstOpen = content.indexOf('{');
        const lastClose = content.lastIndexOf('}');

        if (firstOpen === -1 || lastClose === -1) {
            throw new Error("No JSON found in AI response");
        }

        const cleanJson = content.substring(firstOpen, lastClose + 1);

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
    } catch (error) {
        console.error("Failed to generate professional CV:", error);
        // Return original data if AI fails
        return data;
    }
}
