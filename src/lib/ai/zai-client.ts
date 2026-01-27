"use server";

const BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function chatWithAI(messages: { role: string; content: string }[], retryCount = 0): Promise<any> {
    const ZAI_API_KEY = process.env.ZAI_API_KEY;

    if (!ZAI_API_KEY) {
        console.error("ZAI_API_KEY not found in environment variables");
        throw new Error("API Key config missing: ZAI_API_KEY. Please add it to .env.local and restart the server.");
    }

    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZAI_API_KEY}`,
                'Accept-Language': 'ar-SA,ar',
            },
            body: JSON.stringify({
                model: 'GLM-4.7',
                messages,
                temperature: 0.7
            }),
            cache: 'no-store'
        });

        // Handle rate limiting (429)
        if (response.status === 429) {
            if (retryCount < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, retryCount);
                console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                await sleep(delay);
                return chatWithAI(messages, retryCount + 1);
            } else {
                // After max retries, return a fallback response
                console.warn("Max retries reached. Returning fallback response.");
                return {
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                _fallback: true,
                                message: "عذراً، الخدمة مشغولة حالياً. يرجى المحاولة بعد قليل."
                            })
                        }
                    }]
                };
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`ZAI API Error (${response.status}):`, errorText);
            throw new Error(`AI Request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error calling z.ai:', error);

        // If network error and can retry
        if (retryCount < MAX_RETRIES && !(error instanceof Error && error.message.includes('API Key'))) {
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            console.log(`Network error. Retrying in ${delay}ms...`);
            await sleep(delay);
            return chatWithAI(messages, retryCount + 1);
        }

        throw error;
    }
}

export async function generateAdaptiveQuestion(context: any) {
    const prompt = `Based on the following CV data profile, generate a single, relevant follow-up question in Arabic (RTL) or English to help complete the CV more professionally. 
  If the user's previous answers were detailed, ask a deep, specific question. If they were brief, ask a basic core question.
  Context: ${JSON.stringify(context)}`;

    return await chatWithAI([{ role: 'user', content: prompt }]);
}
