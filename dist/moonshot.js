import { withCache, fetchWithTimeout, extractBalance } from './cache.js';
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
    return withCache('moonshot-balance', async () => {
        try {
            const resp = await fetchWithTimeout('https://api.moonshot.cn/v1/billing/balance', {
                headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
            });
            if (resp.ok) {
                const balance = extractBalance(await resp.json());
                if (balance)
                    return balance;
            }
        }
        catch { }
        return null;
    });
}
