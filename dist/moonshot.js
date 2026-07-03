import { readCached, writeCached, fetchWithTimeout, extractBalance, TTL } from './cache.js';
function isMoonshot() {
    const base = process.env.ANTHROPIC_BASE_URL;
    return !!base && base.includes('moonshot');
}
export async function getMoonshotBalance() {
    if (!isMoonshot())
        return null;
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey)
        return null;
    const cached = readCached('moonshot-balance');
    if (cached && Date.now() - cached.ts < TTL)
        return cached.balance;
    try {
        const resp = await fetchWithTimeout('https://api.moonshot.cn/v1/billing/balance', {
            headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
        });
        if (resp.ok) {
            const balance = extractBalance(await resp.json());
            if (balance) {
                writeCached('moonshot-balance', { balance, ts: Date.now() });
                return balance;
            }
        }
    }
    catch { }
    return cached?.balance ?? null;
}
