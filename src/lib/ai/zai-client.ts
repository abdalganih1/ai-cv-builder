// Client-side AI helper with Streaming support

const MAX_RETRIES = 2;
const INITIAL_DELAY = 1000;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse SSE stream from AI and collect full response
 * With timeout protection to prevent infinite hangs
 */
async function parseSSEStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let lastDataTime = Date.now();
    const STREAM_TIMEOUT = 60000; // 60 seconds max silence

    // Helper to read with timeout
    const readWithTimeout = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Stream timeout')), STREAM_TIMEOUT);
        });
        return Promise.race([reader.read(), timeoutPromise]);
    };

    try {
        while (true) {
            // Check if too much time passed since last data
            if (Date.now() - lastDataTime > STREAM_TIMEOUT) {
                console.warn('⏰ Stream timeout - no data received for 60s');
                break;
            }

            const { done, value } = await readWithTimeout();
            if (done) break;

            lastDataTime = Date.now(); // Reset timer on data received
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                        return fullContent; // Early return on [DONE]
                    }

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
    } catch (error) {
        if (error instanceof Error && error.message === 'Stream timeout') {
            console.warn('⏰ Stream timed out, returning partial content');
            // Return whatever we have so far
        } else {
            throw error;
        }
    } finally {
        reader.releaseLock();
    }

    return fullContent;
}

/**
 * Chat with AI using streaming for better timeout handling
 */
export async function chatWithAI(
    messages: { role: string; content: string }[],
    options: { temperature?: number; retryCount?: number; stream?: boolean } = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    const { temperature, retryCount = 0, stream = true } = options;

    // Create AbortController for timeout (90 seconds max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, temperature, stream }),
            signal: controller.signal, // Add abort signal
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
        // Check if it was a timeout abort
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('⏰ AI request timed out after 90 seconds');
            throw new Error('انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.');
        }

        console.error('Error calling AI API:', error);

        // Retry on network errors (but not on timeout)
        if (retryCount < MAX_RETRIES && !(error instanceof Error && error.name === 'AbortError')) {
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            console.log(`Network error. Retrying in ${delay}ms...`);
            await sleep(delay);
            return chatWithAI(messages, { ...options, retryCount: retryCount + 1 });
        }

        throw error;
    } finally {
        clearTimeout(timeoutId); // Always clear timeout
    }
}

/**
 * Chat with AI - No streaming (for simple requests)
 */
export async function chatWithAISimple(
    messages: { role: string; content: string }[],
    options: { temperature?: number } = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    return chatWithAI(messages, { ...options, stream: false });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateAdaptiveQuestion(context: any) {
    const prompt = `Based on the following CV data profile, generate a single, relevant follow-up question in Arabic (RTL) or English to help complete the CV more professionally. 
  If the user's previous answers were detailed, ask a deep, specific question. If they were brief, ask a basic core question.
  Context: ${JSON.stringify(context)}`;

    return await chatWithAI([{ role: 'user', content: prompt }]);
}
