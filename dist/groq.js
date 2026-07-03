import { readCached, writeCached, fetchWithTimeout, TTL } from './cache.js';
function isGroq() {
    const base = process.env.ANTHROPIC_BASE_URL;
    return !!base && base.includes('groq');
}
function extractUsage(data) {
    if (!data || typeof data !== 'object')
        return null;
    const d = data;
    const inner = d.data;
    const candidates = [
        d.remaining_requests,
        d.remaining_tokens,
        d.usage,
        d.total_usage,
        d.quota_remaining,
        inner?.remaining_requests,
        inner?.remaining_tokens,
        inner?.usage,
        inner?.quota_remaining,
    ];
    for (const val of candidates) {
        if (typeof val === 'number')
            return `${val}`;
        if (typeof val === 'string' && val.trim())
            return val.trim();
    }
    return null;
}
async function fetchUsage(apiKey) {
    try {
        const resp = await fetchWithTimeout('https://api.groq.com/v1/user/usage', {
            headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
        });
        if (!resp.ok)
            return null;
        return extractUsage(await resp.json());
    }
    catch {
        return null;
    }
}
export async function getGroqUsage() {
    if (!isGroq())
        return null;
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey)
        return null;
    const cached = readCached('groq-usage');
    if (cached && Date.now() - cached.ts < TTL)
        return cached.usage;
    const usage = await fetchUsage(apiKey);
    if (usage) {
        writeCached('groq-usage', { usage, ts: Date.now() });
        return usage;
    }
    return cached?.usage ?? null;
}
