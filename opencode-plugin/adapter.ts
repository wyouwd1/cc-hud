import type { RenderData } from '../src/types.js';
import { render } from '../dist/render.js';
import { SessionCollector, type SessionState } from './session.js';
import { getOpenCodeQuota, type OpenCodeQuota } from './quota.js';
import { getExtra } from '../dist/balance.js';
import { getGlmBalance } from '../dist/glm.js';
import { getMmxQuota } from '../dist/mmx.js';
import { getBailianQuota } from '../dist/bailian.js';
import { getQwenBalance } from '../dist/qwen.js';
import { getMoonshotBalance } from '../dist/moonshot.js';
import { getGroqUsage } from '../dist/groq.js';
import { loadConfig } from './config.js';

function fallback<T>(...sources: (T | null | undefined)[]): T | null {
  for (const s of sources) {
    if (s != null) return s;
  }
  return null;
}

export async function buildRenderData(collector: SessionCollector): Promise<string> {
  const config = loadConfig();

  // 设置环境变量供后端模块使用（它们读 CC_HUD_THEME 等）
  process.env.CC_HUD_THEME = config.theme;
  if (config.compact) process.env.CC_HUD_COMPACT = '1';

  const state = collector.getState();

  // 并行获取所有外部数据
  const [ocQuota, mmQuota, blQuota, extra] = await Promise.all([
    getOpenCodeQuota(),
    getMmxQuota(),
    getBailianQuota(),
    (async () =>
      (await getExtra())
      ?? (await getGlmBalance())
      ?? (await getQwenBalance())
      ?? (await getMoonshotBalance())
      ?? (await getGroqUsage())
    )(),
  ]);

  const renderData: RenderData = {
    model: state.modelName,
    modelVariant: state.modelVariant,
    contextPercent: state.contextPercent,
    agents: state.agents,
    fiveHourPercent: fallback(
      ocQuota?.rollingPercent,
      mmQuota?.fiveHourUsedPct,
      blQuota?.rollingPercent,
    ),
    sevenDayPercent: fallback(
      ocQuota?.weeklyPercent,
      mmQuota?.sevenDayUsedPct,
      blQuota?.weeklyPercent,
    ),
    fiveHourResetsAt: fallback(
      ocQuota?.rollingResetsAt,
      mmQuota?.fiveHourResetsAt,
      blQuota?.rollingResetsAt,
    ),
    sevenDayResetsAt: fallback(
      ocQuota?.weeklyResetsAt,
      mmQuota?.sevenDayResetsAt,
      blQuota?.weeklyResetsAt,
    ),
    monthlyPercent: fallback(ocQuota?.monthlyPercent, blQuota?.monthlyPercent),
    monthlyResetsAt: fallback(ocQuota?.monthlyResetsAt, blQuota?.monthlyResetsAt),
    extra,
    effortLevel: state.effortLevel,
  };

  return render(renderData);
}
