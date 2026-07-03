import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TTL = 5 * 60 * 1000;

function baseDir(): string {
  return join(homedir(), '.cache', 'cc-hud');
}

export function readCached<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(baseDir(), `${name}.json`), 'utf8')) as T;
  } catch { return null; }
}

export function writeCached(name: string, data: unknown): void {
  try {
    const dir = baseDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(data));
  } catch {}
}

export function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 2000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  timer.unref();
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const BALANCE_KEYS = ['balance', 'total_balance', 'amount', 'remainingBalance', 'remaining_balance'] as const;

export function extractBalance(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const inner = d.data as Record<string, unknown> | undefined;

  for (const k of BALANCE_KEYS) {
    for (const val of [d[k], inner?.[k]]) {
      if (typeof val === 'number') return `¥${val.toFixed(2)}`;
      if (typeof val === 'string' && val.trim()) {
        return val.trim().startsWith('¥') ? val.trim() : `¥${val.trim()}`;
      }
    }
  }
  return null;
}
