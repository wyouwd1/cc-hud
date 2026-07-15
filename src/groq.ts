import { withCache, fetchWithTimeout } from './cache.js';

function isGroq(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && base.includes('groq');
}

function extractUsage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const inner = d.data as Record<string, unknown> | undefined;

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
    if (typeof val === 'number') return `${val}`;
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

async function fetchUsage(apiKey: string): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout('https://api.groq.com/v1/user/usage', {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (!resp.ok) return null;
    return extractUsage(await resp.json());
  } catch { return null; }
}

export async function getGroqUsage(): Promise<string | null> {
  if (!isGroq()) return null;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;
  return withCache('groq-usage', () => fetchUsage(apiKey));
}
