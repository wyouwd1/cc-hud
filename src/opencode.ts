import { readCached, writeCached, fetchWithTimeout, TTL } from './cache.js';
import { isLocalProxy } from './proxy.js';

const TIMEOUT_MS = 5000; // OpenCode workspace page is a full HTML render (~1-2s)

export interface OpenCodeQuota {
  rollingPercent: number;
  rollingResetsAt: number;
  weeklyPercent: number;
  weeklyResetsAt: number;
  monthlyPercent: number;
  monthlyResetsAt: number;
}

/** OPENCODE_AUTH 凭证已配置 */
function hasCredentials(): boolean {
  return !!process.env.OPENCODE_AUTH;
}

/** 是否已静音 OpenCode 引导提示 */
export function isHintSilenced(): boolean {
  return process.env.CC_HUD_SKIP_OC_HINT === '1';
}

/** 是否需要显示引导提示（本地代理 + 无凭证 + 未静音） */
export function needsGuidance(): boolean {
  return isLocalProxy() && !hasCredentials() && !isHintSilenced();
}

/** 获取 extra 段引导文字 */
export function getOpenCodeHint(): string | null {
  if (!needsGuidance()) return null;
  return 'OC need auth → opencode.ai/go?ref=TN4ZD3A7YH';
}

/** 获取独立指引行（多行纯文本，供 AI 读取） */
export function getOpenCodeGuidanceLine(): string | null {
  if (!needsGuidance()) return null;
  return [
    '[cc-hud] ⚠ OpenCode Go 本地代理已检测到，但未配置配额凭证。',
    '  配置方式：访问 https://opencode.ai/go?ref=TN4ZD3A7YH ，',
    '  从浏览器开发者工具 Network 标签页复制 cURL 请求，',
    '  提取 cookie 中的 auth 值设置为 OPENCODE_AUTH。',
    '  设置 CC_HUD_SKIP_OC_HINT=1 可关闭此提示。',
  ].join('\n');
}

/** OpenCode 相关功能的全局开关（有凭证或本地代理特征） */
export function isOpenCode(): boolean {
  return hasCredentials() || isLocalProxy();
}

function wsId(): string {
  return process.env.OPENCODE_WS || 'wrk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';
}

function authCookie(): string | null {
  const auth = process.env.OPENCODE_AUTH;
  if (!auth) return null;
  return `oc_locale=zh; auth=${encodeURIComponent(auth)}`;
}

/**
 * Extract usage data from the OpenCode workspace HTML page.
 *
 * The page embeds inline JS assignments like:
 *   rollingUsage:$R[30]={status:"ok",resetInSec:5647,usagePercent:7}
 *   weeklyUsage:$R[31]={status:"ok",resetInSec:245174,usagePercent:25}
 *   monthlyUsage:$R[32]={status:"ok",resetInSec:597495,usagePercent:98}
 */
function extractQuota(html: string): OpenCodeQuota | null {
  const OBJECT_RE = /\{status:"[^"]+",resetInSec:(\d+),usagePercent:(\d+)\}/;

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
  if (!cookie) return null;

  try {
    const resp = await fetchWithTimeout(`https://opencode.ai/workspace/${wsId()}/go`, {
      headers: {
        accept: 'text/html',
        cookie,
        'user-agent': 'cc-hud/1.0',
      },
    }, TIMEOUT_MS);
    if (!resp.ok) return null;
    return extractQuota(await resp.text());
  } catch { return null; }
}

export async function getOpenCodeQuota(): Promise<OpenCodeQuota | null> {
  if (!isOpenCode()) return null;

  const cached = readCached<{ payload: OpenCodeQuota; ts: number }>('oc-quota');
  if (cached && Date.now() - cached.ts < TTL) return cached.payload;

  const quota = await fetchQuota();
  if (quota) {
    writeCached('oc-quota', { payload: quota, ts: Date.now() });
    return quota;
  }
  return cached?.payload ?? null;
}
