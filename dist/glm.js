import { withCache, fetchWithTimeout, extractBalance } from './cache.js';
function isGlm() {
    const base = process.env.ANTHROPIC_BASE_URL;
    return !!base && (base.includes('bigmodel.cn') || base.includes('api.z.ai'));
}
function host() {
    return process.env.ANTHROPIC_BASE_URL?.includes('api.z.ai')
        ? 'https://api.z.ai'
        : 'https://open.bigmodel.cn';
}
export async function getGlmBalance() {
    if (!isGlm())
        return null;
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey)
        return null;
    return withCache('glm-balance', async () => {
        try {
            const resp = await fetchWithTimeout(`${host()}/api/biz/account/query-customer-account-report`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (resp.ok) {
                const data = (await resp.json());
                if (!data.code || data.code === 200) {
                    const balance = extractBalance(data);
                    if (balance)
                        return balance;
                }
            }
        }
        catch { }
        return null;
    });
}
