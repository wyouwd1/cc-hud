import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_DIR = '.cache/cc-hud';
const TTL = 5 * 60 * 1000; // 5 min — same as other backends
const TIMEOUT_MS = 2000;

function cacheFile(): string {
  return join(homedir(), CACHE_DIR, 'groq-usage.json');
}

interface CacheEntry {
  usage: string;
  ts: number;
}

// Critical isolation: non-Groq backends skip the whole module
function isGroq(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && base.includes('groq');
}

function readCache(): CacheEntry | null {
  try {
    return JSON.parse(readFileSync(cacheFile(), 'utf8')) as CacheEntry;
  } catch { return null; }
}

function writeCache(usage: string): void {
  try {
    mkdirSync(join(homedir(), CACHE_DIR), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify({ usage, ts: Date.now() }));
  } catch { /* best effort */ }
}

/**
 * Extract usage info from various API response shapes.
 * Groq may return rate limit or quota information.
 */
function extractUsage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Common usage patterns
  const candidates = [
    // Usage / quota
    d.remaining_requests,
    d.remaining_tokens,
    d.usage,
    d.total_usage,
    d.quota_remaining,
    // Rate limit info
    ...(() => {
      const inner = d.data as Record<string, unknown> | undefined;
      if (!inner || typeof inner !== 'object') return [];
      return [inner.remaining_requests, inner.remaining_tokens, inner.usage, inner.quota_remaining];
    })(),
  ];

  for (const val of candidates) {
    if (typeof val === 'number') return `${val}`;
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

async function fetchUsage(apiKey: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Groq usage API — exact endpoint may vary;
    // cc-hud silently returns null on any error.
    const resp = await fetch('https://api.groq.com/v1/user/usage', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal: ctrl.signal,
    });
    if (!resp.ok) return null;
    return extractUsage(await resp.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    timer.unref();
  }
}

/**
 * Returns the Groq usage/quota information as a formatted string
 * if the ANTHROPIC_BASE_URL indicates a Groq backend.
 *
 * Returns null otherwise. Results are cached for 5 minutes with stale
 * fallback — silent on any failure, never blocks Claude Code.
 */
export async function getGroqUsage(): Promise<string | null> {
  if (!isGroq()) return null;

  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;

  const cached = readCache();

  if (cached && Date.now() - cached.ts < TTL) {
    return cached.usage;
  }

  const usage = await fetchUsage(apiKey);
  if (usage) {
    writeCache(usage);
    return usage;
  }

  return cached?.usage ?? null;
}
