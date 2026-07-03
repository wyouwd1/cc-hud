import { readCached, writeCached, fetchWithTimeout, TTL } from './cache.js';
export async function getExtra() {
    if (!process.env.ANTHROPIC_BASE_URL?.includes('deepseek'))
        return null;
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey)
        return null;
    const cached = readCached('ds-balance');
    if (cached && Date.now() - cached.ts < TTL)
        return cached.balance;
    try {
        const resp = await fetchWithTimeout('https://api.deepseek.com/user/balance', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (resp.ok) {
            const data = (await resp.json());
            const total = data?.balance_infos?.[0]?.total_balance;
            if (total) {
                const formatted = `¥${total}`;
                writeCached('ds-balance', { balance: formatted, ts: Date.now() });
                return formatted;
            }
        }
    }
    catch { }
    return cached?.balance ?? null;
}
