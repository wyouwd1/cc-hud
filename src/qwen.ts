import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_DIR = '.cache/cc-hud';
const TTL = 5 * 60 * 1000; // 5 min — same as other backends
const TIMEOUT_MS = 2000;

function cacheFile(): string {
  return join(homedir(), CACHE_DIR, 'qwen-balance.json');
}

interface CacheEntry {
  balance: string;
  ts: number;
}

// Critical isolation: non-Qwen backends skip the whole module
function isQwen(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && (base.includes('dashscope') || base.includes('qwen'));
}

function readCache(): CacheEntry | null {
  try {
    return JSON.parse(readFileSync(cacheFile(), 'utf8')) as CacheEntry;
  } catch { return null; }
}

function writeCache(balance: string): void {
  try {
    mkdirSync(join(homedir(), CACHE_DIR), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ balance, ts: Date.now() }));
  } catch { /* best effort */ }
}

/**
 * Extract balance value from various API response shapes.
 * Qwen/DashScope billing API may return balance in different formats
 * depending on the endpoint and response version.
 */
function extractBalance(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Top-level fields
  const candidates = [
    d.balance,
    d.remainingBalance,
    d.remaining_balance,
    d.amount,
    d.total_balance,
    // nested response.data
    ...(() => {
      const inner = d.data as Record<string, unknown> | undefined;
      if (!inner || typeof inner !== 'object') return [];
      return [inner.balance, inner.remainingBalance, inner.remaining_balance, inner.amount, inner.total_balance];
    })(),
  ];

  for (const val of candidates) {
    if (typeof val === 'number') return `¥${val.toFixed(2)}`;
    if (typeof val === 'string' && val.trim()) {
      return val.trim().startsWith('¥') ? val.trim() : `¥${val.trim()}`;
    }
  }
  return null;
}

async function fetchBalance(apiKey: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // DashScope billing API — the exact endpoint may vary;
    // cc-hud silently returns null on any error, so wrong endpoints
    // degrade gracefully without breaking the status line.
    const resp = await fetch('https://dashscope.aliyuncs.com/api/v1/billing/query', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal: ctrl.signal,
    });
    if (!resp.ok) return null;
    return extractBalance(await resp.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    timer.unref();
  }
}

/**
 * Returns the Qwen/DashScope account balance formatted as ¥XX.XX
 * if the ANTHROPIC_BASE_URL indicates a Qwen backend.
 *
 * Returns null otherwise. Results are cached for 5 minutes with stale
 * fallback — silent on any failure, never blocks Claude Code.
 */
export async function getQwenBalance(): Promise<string | null> {
  if (!isQwen()) return null;

  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;

  const cached = readCache();

  // Fresh cache — instant return (99.9% of calls)
  if (cached && Date.now() - cached.ts < TTL) {
    return cached.balance;
  }

  // Cache miss — fetch balance, fall back to stale cache on failure
  const balance = await fetchBalance(apiKey);
  if (balance) {
    writeCache(balance);
    return balance;
  }

  return cached?.balance ?? null;
}
