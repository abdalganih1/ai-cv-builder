// Client-side AI helper - calls the Edge API route

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function chatWithAI(messages: { role: string; content: string }[], retryCount = 0): Promise<any> {
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`AI API Error (${response.status}):`, errorData);

            // Retry on server errors
            if (response.status >= 500 && retryCount < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, retryCount);
                console.log(`Server error. Retrying in ${delay}ms...`);
                await sleep(delay);
                return chatWithAI(messages, retryCount + 1);
            }

            throw new Error(`AI Request failed: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error calling AI API:', error);

        // Retry on network errors
        if (retryCount < MAX_RETRIES) {
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
