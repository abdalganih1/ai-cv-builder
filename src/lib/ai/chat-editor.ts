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

    // Strict JSON System Prompt with Schema Definition
    const systemPrompt = `
${CV_EDIT_SYSTEM_PROMPT}

IMPORTANT: You are a JSON-only API. You must output VALID JSON matching the CVData schema.
Do NOT use Markdown blocks. Do NOT add preamble. Start with '{'.
CRITICAL: All content values (names, descriptions, roles, etc.) MUST be in ARABIC language (اللغة العربية).
Do NOT output English content unless the term is technical (e.g. Java, SQL).

Schema:
interface CVData {
  personal: { name: string; title: string; ... };
  experience: Array<{ company: string; role: string; ... }>;
  education: Array<{ institution: string; degree: string; ... }>;
  skills: string[];
  ...
}

Current Data:
${JSON.stringify(data, null, 2)}

User Request: "${request}"

Output JSON only:
`;

    try {
        // Use low temperature for deterministic output
        const response = await chatWithAI([
            { role: 'system', content: 'You are a JSON generator. Output valid JSON only.' },
            { role: 'user', content: systemPrompt }
        ], { temperature: 0.3 });

        const content = response.choices[0].message.content;

        try {
            const cleanJson = extractJSON(content);
            return JSON.parse(cleanJson);
        } catch (parseError) {
            console.warn("⚠️ JSON extraction failed. Retrying with correction prompt...");

            // Auto-Correction Retry
            const retryResponse = await chatWithAI([
                { role: 'system', content: 'You are a JSON generator. Output valid JSON only.' },
                { role: 'user', content: systemPrompt },
                { role: 'assistant', content: content },
                { role: 'user', content: 'ERROR: Your last response was not valid JSON. Please fix it and return ONLY valid JSON.' }
            ], { temperature: 0.1 }); // Even lower temp for retry

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
CRITICAL: All content values (names, descriptions, roles, etc.) MUST be in ARABIC language (اللغة العربية).
Do NOT output English content unless the term is technical (e.g. Java, SQL).

Current Data:
${JSON.stringify(data, null, 2)}

Task: Enhance this CV data professionally. Improve summaries, use action verbs for experience, and structure skills.

Output JSON only:
`;

    try {
        const response = await chatWithAI([
            { role: 'system', content: 'You are a JSON generator. Output valid JSON only.' },
            { role: 'user', content: systemPrompt }
        ], { temperature: 0.3 });

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
