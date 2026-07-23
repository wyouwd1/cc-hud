import { readStdin } from './stdin.js';
import { parseAgents } from './transcript.js';
import { render } from './render.js';
import { shortModelName } from './model.js';
import { getExtra } from './balance.js';
import { getMmxQuota } from './mmx.js';
import { getGlmBalance } from './glm.js';
import { getOpenCodeQuota, getOpenCodeHint, getOpenCodeGuidanceLine } from './opencode.js';
import { getBailianQuota } from './bailian.js';
import { getQwenBalance } from './qwen.js';
import { getMoonshotBalance } from './moonshot.js';
import { getGroqUsage } from './groq.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { TIMEOUT_MS, EFFORT_LABELS } from './constants.js';
import { toMs } from './timestamp.js';
import type { RenderData } from './types.js';

// Hard timeout — never block Claude Code
setTimeout(() => process.exit(0), TIMEOUT_MS).unref();

/** 优先级回退链：返回第一个非 null/undefined 的值 */
function fallback<T>(...sources: (T | null | undefined)[]): T | null {
  for (const s of sources) {
    if (s != null) return s;
  }
  return null;
}

function readExtraFile(): string | null {
  const file = process.env.CC_HUD_EXTRA_FILE;
  if (!file) return null;
  try {
    const text = readFileSync(file, 'utf8').trim();
    return text || null;
  } catch {
    return null;
  }
}

/** 从 ~/.claude/settings.json 读取实时 effortLevel（用户通过 /model 设置的最新值） */
function readSettingsEffortLevel(): string | null {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const text = readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.effortLevel === 'string' && parsed.effortLevel.trim()) {
      return parsed.effortLevel.trim();
    }
  } catch {}
  return null;
}

async function main(): Promise<void> {
  const data = await readStdin();

  // Parse transcript in parallel with render prep — no dependency
  const agentsPromise = parseAgents(data.transcript_path);

  // current_usage is null before the first API call, and again after /compact
  // until the next API call repopulates it. We rely on used_percentage as the
  // canonical field — if it's present, render it. Only fall back to "—" when
  // even used_percentage is missing (true "we don't know yet").
  const cw = data.context_window;
  const contextPercent: number | null = (cw?.used_percentage != null)
    ? Math.round(cw.used_percentage)
    : null;
  const agents = await agentsPromise;

  const modelName = shortModelName(data.model?.display_name, data.model?.id);

  // OpenCode 引导提示（同步，不涉及网络 IO）
  const ocHint = getOpenCodeHint();

  // 输出独立指引行供 AI 读取（状态栏行在最后的 console.log）
  const guidanceLine = getOpenCodeGuidanceLine();
  if (guidanceLine) {
    console.log(guidanceLine);
  }

  // Fetch from various backend-specific sources in parallel —
  // each module returns null when it doesn't apply (fast path).
  // Extra segment: explicit CC_HUD_EXTRA_FILE > OpenCode hint > Qwen > Moonshot > Groq > DeepSeek > GLM
  const getExtraSegment = async (): Promise<string | null> =>
    readExtraFile()
      ?? ocHint
      ?? await getQwenBalance()
      ?? await getMoonshotBalance()
      ?? await getGroqUsage()
      ?? await getExtra()
      ?? await getGlmBalance();

  const [ocQuota, mmQuota, blQuota, extra] = await Promise.all([
    getOpenCodeQuota(),
    getMmxQuota(),
    getBailianQuota(),
    getExtraSegment(),
  ]);

  // Effort level: settings.json 的 effortLevel 是用户通过 /model 设置的实时值；
  // stdin 的 effort.level 来自环境变量 CLAUDE_CODE_EFFORT_LEVEL（会话启动后不变）。
  // 优先使用 settings.json 的实时值。
  const rawEffort = readSettingsEffortLevel() ?? data.effort?.level;
  const effortLevel: string | null = rawEffort
    ? EFFORT_LABELS[rawEffort.toLowerCase()] ?? rawEffort.charAt(0).toUpperCase() + rawEffort.slice(1)
    : null;

  const renderData: RenderData = {
    model: modelName.name,
    modelVariant: modelName.variant,
    contextPercent,
    agents,
    fiveHourPercent: fallback(
      data.rate_limits?.five_hour?.used_percentage,
      ocQuota?.rollingPercent, mmQuota?.fiveHourUsedPct, blQuota?.rollingPercent,
    ),
    sevenDayPercent: fallback(
      data.rate_limits?.seven_day?.used_percentage,
      ocQuota?.weeklyPercent, mmQuota?.sevenDayUsedPct, blQuota?.weeklyPercent,
    ),
    fiveHourResetsAt: fallback(
      toMs(data.rate_limits?.five_hour?.resets_at),
      ocQuota?.rollingResetsAt, mmQuota?.fiveHourResetsAt, blQuota?.rollingResetsAt,
    ),
    sevenDayResetsAt: fallback(
      toMs(data.rate_limits?.seven_day?.resets_at),
      ocQuota?.weeklyResetsAt, mmQuota?.sevenDayResetsAt, blQuota?.weeklyResetsAt,
    ),
    monthlyPercent: fallback(ocQuota?.monthlyPercent, blQuota?.monthlyPercent),
    monthlyResetsAt: fallback(ocQuota?.monthlyResetsAt, blQuota?.monthlyResetsAt),
    extra,
    effortLevel,
  };

  console.log(render(renderData));
}

main().catch(() => process.exit(0));
