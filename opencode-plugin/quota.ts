import { withCache, fetchWithTimeout } from '../src/cache.js';

const TIMEOUT_MS = 5000;

export interface OpenCodeQuota {
  rollingPercent: number;
  rollingResetsAt: number;
  weeklyPercent: number;
  weeklyResetsAt: number;
  monthlyPercent: number;
  monthlyResetsAt: number;
}

function wsId(): string {
  return process.env.OPENCODE_WS || '';
}

function authCookie(): string | null {
  const auth = process.env.OPENCODE_AUTH;
  if (!auth) return null;
  return `oc_locale=zh; auth=${encodeURIComponent(auth)}`;
}

function extractQuota(html: string): OpenCodeQuota | null {
  // 匹配内联 JS 赋值，支持字段顺序调换和跨行
  const OBJECT_RE = /\{status:\s*"[^"]+",\s*resetInSec:\s*(\d+),\s*usagePercent:\s*(\d+)\}/;

  function extract(keyword: string): [number, number] | null {
    let pos = 0;
    for (;;) {
      const idx = html.indexOf(keyword + ':', pos);
      if (idx === -1) return null;
      const afterColon = html.slice(idx + keyword.length + 1).trimStart();
      if (afterColon.startsWith('null')) {
        pos = idx + 1;
        continue;
      }
      const rest = html.slice(idx + keyword.length + 1);
      const m = rest.match(OBJECT_RE);
      if (!m) return null;
      return [Number(m[2]), Number(m[1])];
    }
  }

  const roll = extract('rollingUsage');
  const week = extract('weeklyUsage');
  const month = extract('monthlyUsage');
  if (!roll || !week || !month) return null;

  const now = Date.now();
  return {
    rollingPercent: roll[0],
    rollingResetsAt: now + roll[1] * 1000,
    weeklyPercent: week[0],
    weeklyResetsAt: now + week[1] * 1000,
    monthlyPercent: month[0],
    monthlyResetsAt: now + month[1] * 1000,
  };
}

async function fetchQuota(): Promise<OpenCodeQuota | null> {
  const cookie = authCookie();
  const id = wsId();
  if (!cookie || !id) return null;

  try {
    const resp = await fetchWithTimeout(`https://opencode.ai/workspace/${id}/go`, {
      headers: {
        accept: 'text/html',
        cookie,
        'user-agent': 'cc-hud-plugin/1.0',
      },
    }, TIMEOUT_MS);
    if (!resp.ok) return null;
    return extractQuota(await resp.text());
  } catch {
    return null;
  }
}

export async function getOpenCodeQuota(): Promise<OpenCodeQuota | null> {
  const ws = process.env.OPENCODE_WS;
  const auth = process.env.OPENCODE_AUTH;
  if (!ws || !auth) return null;
  return withCache('oc-quota', () => fetchQuota());
}
