import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_DIR = '.cache/cc-hud';
const TTL = 5 * 60 * 1000; // 5 min — same as other backends
const TIMEOUT_MS = 2000;

function cacheFile(): string {
  return join(homedir(), CACHE_DIR, 'moonshot-balance.json');
}

interface CacheEntry {
  balance: string;
  ts: number;
}

// Critical isolation: non-Moonshot backends skip the whole module
function isMoonshot(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && base.includes('moonshot');
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
 * Moonshot billing API may return balance in different formats.
 */
function extractBalance(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  const candidates = [
    d.balance,
    d.total_balance,
    d.amount,
    ...(() => {
      const inner = d.data as Record<string, unknown> | undefined;
      if (!inner || typeof inner !== 'object') return [];
      return [inner.balance, inner.total_balance, inner.amount];
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
    // Moonshot billing API — exact endpoint may vary;
    // cc-hud silently returns null on any error.
    const resp = await fetch('https://api.moonshot.cn/v1/billing/balance', {
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
 * Returns the Moonshot (Kimi) account balance formatted as ¥XX.XX
 * if the ANTHROPIC_BASE_URL indicates a Moonshot backend.
 *
 * Returns null otherwise. Results are cached for 5 minutes with stale
 * fallback — silent on any failure, never blocks Claude Code.
 */
export async function getMoonshotBalance(): Promise<string | null> {
  if (!isMoonshot()) return null;

  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;

  const cached = readCache();

  if (cached && Date.now() - cached.ts < TTL) {
    return cached.balance;
  }

  const balance = await fetchBalance(apiKey);
  if (balance) {
    writeCache(balance);
    return balance;
  }

  return cached?.balance ?? null;
}
