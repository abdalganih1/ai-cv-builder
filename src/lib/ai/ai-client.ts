/**
 * AI Client with Fallback Chain
 * يحاول Z.AI أولاً → OpenRouter مجاني → OpenRouter مدفوع
 *
 * ⚠️ ملاحظة: في Cloudflare Pages، الـ secrets لا تُقرأ من process.env
 * بل يجب تمريرها من الـ route handler عبر getRequestContext().env
 */

interface AIProvider {
    name: string;
    url: string;
    model: string;
    getHeaders: () => Record<string, string>;
    timeout: number;
}

export interface AIKeys {
    zaiKey?: string;
    openrouterKey?: string;
}

/**
 * يجمع المفاتيح من process.env + المفاتيح المُمررة (Cloudflare secrets)
 */
export function resolveKeys(cfEnv?: Record<string, unknown>): AIKeys {
    const zaiKey = (cfEnv?.ZAI_API_KEY as string) || process.env.ZAI_API_KEY || undefined;
    const openrouterKey = (cfEnv?.OPENROUTER_API_KEY as string) || process.env.OPENROUTER_API_KEY || undefined;
    
    console.log(`🔑 resolveKeys: ZAI=${zaiKey ? `${zaiKey.substring(0, 8)}...` : 'MISSING'}, OR=${openrouterKey ? `${openrouterKey.substring(0, 12)}...` : 'MISSING'}`);
    console.log(`🔑 Sources: cfEnv=${!!cfEnv}, cfEnv.OR=${!!(cfEnv?.OPENROUTER_API_KEY)}, process.env.OR=${!!process.env.OPENROUTER_API_KEY}`);
    
    return { zaiKey, openrouterKey };
}

function getProviders(keys: AIKeys): AIProvider[] {
    const providers: AIProvider[] = [];

    // 1️⃣ Z.AI (أساسي)
    if (keys.zaiKey) {
        const zaiKey = keys.zaiKey;
        providers.push({
            name: 'Z.AI (GLM-4.7)',
            url: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
            model: 'GLM-4.7',
            getHeaders: () => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${zaiKey}`,
            }),
            timeout: 30000,
        });
    }

    // 2️⃣ OpenRouter مجاني + مدفوع (احتياطي)
    if (keys.openrouterKey) {
        const orKey = keys.openrouterKey;
        providers.push({
            name: 'OpenRouter (minimax-m2.5:free)',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'minimax/minimax-m2.5:free',
            getHeaders: () => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${orKey}`,
                'HTTP-Referer': 'https://cv.abdalgani.com',
            }),
            timeout: 20000,
        });

        // 3️⃣ OpenRouter مدفوع (آخر خيار)
        providers.push({
            name: 'OpenRouter (gemini-3.1-flash-lite)',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'google/gemini-3.1-flash-lite',
            getHeaders: () => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${orKey}`,
                'HTTP-Referer': 'https://cv.abdalgani.com',
            }),
            timeout: 25000,
        });
    }

    return providers;
}

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResult {
    content: string;
    provider: string;
    elapsed: number;
}

/**
 * يرسل الطلب للـ AI مع سلسلة fallback تلقائية
 */
export async function callAI(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number },
    keys?: AIKeys
): Promise<AIResult> {
    const providers = getProviders(keys ?? resolveKeys());

    if (providers.length === 0) {
        throw new Error('لا يوجد مفتاح AI مُعدّ — أضف ZAI_API_KEY أو OPENROUTER_API_KEY');
    }

    const errors: string[] = [];

    for (const provider of providers) {
        const start = Date.now();
        console.log(`🤖 Trying ${provider.name}...`);

        try {
            const headers = provider.getHeaders();
            console.log(`📤 ${provider.name} headers:`, JSON.stringify(Object.keys(headers)), 'Auth:', headers['Authorization']?.substring(0, 20) + '...');
            const response = await fetch(provider.url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: provider.model,
                    messages,
                    temperature: options?.temperature ?? 0.3,
                    max_tokens: options?.maxTokens ?? 3000,
                    stream: false,
                }),
                signal: AbortSignal.timeout(provider.timeout),
            });

            const elapsed = Date.now() - start;

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorBody.substring(0, 100)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            // تحقق أن الرد ليس فارغاً
            if (!content || content.trim().length < 10) {
                throw new Error('الرد فارغ أو قصير جداً');
            }

            console.log(`✅ ${provider.name} responded in ${elapsed}ms (${content.length} chars)`);
            return { content, provider: provider.name, elapsed };

        } catch (error) {
            const elapsed = Date.now() - start;
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`⚠️ ${provider.name} failed after ${elapsed}ms: ${msg}`);
            errors.push(`${provider.name}: ${msg}`);
            // ← يتابع للمزود التالي تلقائياً
        }
    }

    // كل المزودين فشلوا
    throw new Error(`فشل جميع مزودي AI:\n${errors.join('\n')}`);
}

/**
 * يرسل الطلب للـ AI مع دعم streaming — يرجع الـ response الخام
 * للمزود الأول الناجح (يتابع عند فشل المزود)
 */
export async function callAIStream(
    messages: AIMessage[],
    options?: { temperature?: number },
    keys?: AIKeys
): Promise<Response> {
    const providers = getProviders(keys ?? resolveKeys());

    if (providers.length === 0) {
        throw new Error('لا يوجد مفتاح AI مُعدّ — أضف ZAI_API_KEY أو OPENROUTER_API_KEY');
    }

    const errors: string[] = [];

    for (const provider of providers) {
        const start = Date.now();
        console.log(`🤖 Trying ${provider.name} (stream)...`);

        try {
            const response = await fetch(provider.url, {
                method: 'POST',
                headers: provider.getHeaders(),
                body: JSON.stringify({
                    model: provider.model,
                    messages,
                    temperature: options?.temperature ?? 0.7,
                    stream: true,
                }),
                signal: AbortSignal.timeout(provider.timeout),
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorBody.substring(0, 100)}`);
            }

            const elapsed = Date.now() - start;
            console.log(`✅ ${provider.name} stream started in ${elapsed}ms`);
            return response;

        } catch (error) {
            const elapsed = Date.now() - start;
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`⚠️ ${provider.name} stream failed after ${elapsed}ms: ${msg}`);
            errors.push(`${provider.name}: ${msg}`);
        }
    }

    throw new Error(`فشل جميع مزودي AI:\n${errors.join('\n')}`);
}

/**
 * يستخرج JSON من رد AI (يتعامل مع markdown fences)
 */
export function parseAIJson(content: string): Record<string, unknown> {
    // إزالة markdown code fences
    const cleaned = content
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('لا يوجد JSON في رد AI');
    }

    return JSON.parse(jsonMatch[0]);
}
