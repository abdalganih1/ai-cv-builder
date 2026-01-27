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

    // One-Shot Examples to force JSON mode
    const exampleMessages = [
        { role: 'system', content: 'أنت مساعد تحرير سير ذاتية. يجب أن تُعيد JSON فقط بناءً على المخطط المطلوب.' },
        { role: 'user', content: 'السيرة الذاتية: {"personal":{"firstName":"أحمد"}} \n الطلب: "غيّر اسمي إلى عمر"' },
        { role: 'assistant', content: '{"personal":{"firstName":"عمر"},"metadata":{"updated":true}}' }, // JSON Only response example
    ];

    const systemPromptMessage = {
        role: 'system',
        content: `
${CV_EDIT_SYSTEM_PROMPT}

⚠️ قاعدة صارمة جداً: الرد يجب أن يكون **JSON فقط**.
لا تكتب أي مقدمات مثل "إليك التعديل" أو "حسناً".
فقط كود JSON.

السيرة الذاتية الحالية:
${JSON.stringify(data, null, 2)}
`
    };

    const userMessage = {
        role: 'user',
        content: `الطلب: "${request}"\n\nأعِد JSON فقط:`
    };

    // Combine messages: System -> Examples -> Current Context -> User Request
    const messages = [
        systemPromptMessage,
        ...exampleMessages.slice(1), // Add user/assistant examples, skip the extra system msg
        userMessage
    ];

    try {
        const response = await chatWithAI(messages);
        const content = response.choices[0].message.content;

        try {
            const cleanJson = extractJSON(content);
            return JSON.parse(cleanJson);
        } catch (parseError) {
            console.warn("⚠️ JSON extraction failed. Retrying with correction prompt...");

            // Auto-Correction Retry
            const retryResponse = await chatWithAI([
                ...messages,
                { role: 'assistant', content: content },
                { role: 'user', content: 'عذراً، هذا ليس JSON صالحاً. أعد المحاولة وأرسل JSON فقط (بدون markdown).' }
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

    // One-Shot Examples for Generation
    const exampleMessages = [
        { role: 'system', content: 'أنت خبير سير ذاتية. الرد JSON فقط.' },
        { role: 'user', content: 'أنشئ سيرة ذاتية لهذا المستخدم: {"personal":{"firstName":"تجربة"}}' },
        { role: 'assistant', content: '{"personal":{"firstName":"تجربة","summary":"خبير..."},"skills":["مهارة 1"]}' }
    ];

    const systemPromptMessage = {
        role: 'system',
        content: `
${CV_GENERATOR_SYSTEM_PROMPT}

⚠️ قاعدة صارمة جداً: الرد يجب أن يكون **JSON فقط**.
لا تستخدم Markdown block (\`\`\`json). ابدأ بـ { مباشرة.

البيانات الخام:
${JSON.stringify(data, null, 2)}
`
    };

    const userMessage = {
        role: 'user',
        content: 'أنشئ السيرة الذاتية الاحترافية الآن (JSON فقط):'
    };

    const messages = [
        systemPromptMessage,
        ...exampleMessages.slice(1),
        userMessage
    ];

    try {
        const response = await chatWithAI(messages);
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
                ...messages,
                { role: 'assistant', content: content },
                { role: 'user', content: 'عذراً، هذا ليس JSON صالحاً. أعد المحاولة وأرسل JSON فقط (بدون markdown).' }
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
