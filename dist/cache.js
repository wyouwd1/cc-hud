import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
export const TTL = 5 * 60 * 1000;
function baseDir() {
    return join(homedir(), '.cache', 'cc-hud');
}
export function readCached(name) {
    try {
        return JSON.parse(readFileSync(join(baseDir(), `${name}.json`), 'utf8'));
    }
    catch {
        return null;
    }
}
export function writeCached(name, data) {
    try {
        const dir = baseDir();
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${name}.json`), JSON.stringify(data));
    }
    catch { }
}
export function fetchWithTimeout(url, init = {}, timeoutMs = 2000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    timer.unref();
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
/** 带缓存的异步取数：读缓存 → 检查 TTL → fetch → 写缓存 → fallback */
export async function withCache(key, fetchFn, ttl = TTL) {
    const cached = readCached(key);
    const cachePayload = cached?.payload;
    const cacheTs = cached?.ts;
    if (cachePayload != null && typeof cacheTs === 'number' && Date.now() - cacheTs < ttl) {
        return cachePayload;
    }
    const fresh = await fetchFn();
    if (fresh) {
        writeCached(key, { payload: fresh, ts: Date.now() });
        return fresh;
    }
    return cached?.payload ?? null;
}
const BALANCE_KEYS = ['balance', 'total_balance', 'amount', 'remainingBalance', 'remaining_balance'];
export function extractBalance(data) {
    if (!data || typeof data !== 'object')
        return null;
    const d = data;
    const inner = d.data;
    for (const k of BALANCE_KEYS) {
        for (const val of [d[k], inner?.[k]]) {
            if (typeof val === 'number')
                return `¥${val.toFixed(2)}`;
            if (typeof val === 'string' && val.trim()) {
                return val.trim().startsWith('¥') ? val.trim() : `¥${val.trim()}`;
            }
        }
    }
    return null;
}
