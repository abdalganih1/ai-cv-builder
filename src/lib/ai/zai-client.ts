// Client-side AI helper with Streaming support

const MAX_RETRIES = 2;
const INITIAL_DELAY = 1000;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse SSE stream from AI and collect full response
 */
async function parseSSEStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content || '';
                    fullContent += delta;
                } catch {
                    // Skip invalid JSON chunks
                }
            }
        }
    }

    return fullContent;
}

/**
 * Chat with AI using streaming for better timeout handling
 */
export async function chatWithAI(
    messages: { role: string; content: string }[],
    options: { temperature?: number; retryCount?: number; stream?: boolean } = {}
): Promise<any> {
    const { temperature, retryCount = 0, stream = true } = options;

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, temperature, stream }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`AI API Error (${response.status}):`, errorData);

            // Retry on server errors (but fewer retries to save time)
            if (response.status >= 500 && retryCount < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, retryCount);
                console.log(`Server error. Retrying in ${delay}ms...`);
                await sleep(delay);
                return chatWithAI(messages, { ...options, retryCount: retryCount + 1 });
            }

            throw new Error(`AI Request failed: ${response.status}`);
        }

        // Check if response is streaming (SSE)
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
            // Parse streaming response
            console.log('📡 Receiving streaming response...');
            const content = await parseSSEStream(response);
            console.log('✅ Stream complete, content length:', content.length);

            // Return in standard format
            return {
                choices: [{
                    message: {
                        content: content
                    }
                }]
            };
        }

        // Non-streaming fallback
        return await response.json();

    } catch (error) {
        console.error('Error calling AI API:', error);

        // Retry on network errors
        if (retryCount < MAX_RETRIES) {
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            console.log(`Network error. Retrying in ${delay}ms...`);
            await sleep(delay);
            return chatWithAI(messages, { ...options, retryCount: retryCount + 1 });
        }

        throw error;
    }
}

/**
 * Chat with AI - No streaming (for simple requests)
 */
export async function chatWithAISimple(
    messages: { role: string; content: string }[],
    options: { temperature?: number } = {}
): Promise<any> {
    return chatWithAI(messages, { ...options, stream: false });
}

export async function generateAdaptiveQuestion(context: any) {
    const prompt = `Based on the following CV data profile, generate a single, relevant follow-up question in Arabic (RTL) or English to help complete the CV more professionally. 
  If the user's previous answers were detailed, ask a deep, specific question. If they were brief, ask a basic core question.
  Context: ${JSON.stringify(context)}`;

    return await chatWithAI([{ role: 'user', content: prompt }]);
}
