import { readCached, writeCached, fetchWithTimeout, extractBalance, TTL } from './cache.js';

function isQwen(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && (base.includes('dashscope') || base.includes('qwen'));
}

export async function getQwenBalance(): Promise<string | null> {
  if (!isQwen()) return null;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;

  const cached = readCached<{ balance: string; ts: number }>('qwen-balance');
  if (cached && Date.now() - cached.ts < TTL) return cached.balance;

  try {
    const resp = await fetchWithTimeout('https://dashscope.aliyuncs.com/api/v1/billing/query', {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (resp.ok) {
      const balance = extractBalance(await resp.json());
      if (balance) {
        writeCached('qwen-balance', { balance, ts: Date.now() });
        return balance;
      }
    }
  } catch {}

  return cached?.balance ?? null;
}
