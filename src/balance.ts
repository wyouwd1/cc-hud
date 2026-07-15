import { withCache, fetchWithTimeout } from './cache.js';

export async function getExtra(): Promise<string | null> {
  if (!process.env.ANTHROPIC_BASE_URL?.includes('deepseek')) return null;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;
  return withCache('ds-balance', async () => {
    try {
      const resp = await fetchWithTimeout('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { balance_infos?: { total_balance?: string }[] };
        const total = data?.balance_infos?.[0]?.total_balance;
        if (total) return `¥${total}`;
      }
    } catch {}
    return null;
  });
}
