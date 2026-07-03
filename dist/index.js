import { readStdin } from './stdin.js';
import { parseAgents } from './transcript.js';
import { render } from './render.js';
import { shortModelName } from './model.js';
import { getExtra } from './balance.js';
import { getMmxQuota } from './mmx.js';
import { getGlmBalance } from './glm.js';
import { getOpenCodeQuota } from './opencode.js';
import { getBailianQuota } from './bailian.js';
import { getQwenBalance } from './qwen.js';
import { getMoonshotBalance } from './moonshot.js';
import { getGroqUsage } from './groq.js';
import { readFileSync } from 'node:fs';
// Hard timeout — never block Claude Code
const TIMEOUT_MS = 6000;
setTimeout(() => process.exit(0), TIMEOUT_MS).unref();
function readExtraFile() {
    const file = process.env.CC_HUD_EXTRA_FILE;
    if (!file)
        return null;
    try {
        const text = readFileSync(file, 'utf8').trim();
        return text || null;
    }
    catch {
        return null;
    }
}
async function main() {
    const data = await readStdin();
    // Parse transcript in parallel with render prep — no dependency
    const agentsPromise = parseAgents(data.transcript_path);
    // current_usage is null before the first API call, and again after /compact
    // until the next API call repopulates it. We rely on used_percentage as the
    // canonical field — if it's present, render it. Only fall back to "—" when
    // even used_percentage is missing (true "we don't know yet").
    const cw = data.context_window;
    const contextPercent = (cw?.used_percentage != null)
        ? Math.round(cw.used_percentage)
        : null;
    const agents = await agentsPromise;
    const toMs = (ts) => {
        if (ts == null)
            return null;
        return ts < 1e12 ? ts * 1000 : ts;
    };
    const modelName = shortModelName(data.model?.display_name, data.model?.id);
    // Fetch from various backend-specific sources in parallel —
    // each module returns null when it doesn't apply (fast path).
    // Extra segment: explicit CC_HUD_EXTRA_FILE > Qwen > Moonshot > Groq > DeepSeek > GLM
    const getExtraSegment = async () => readExtraFile()
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
    const renderData = {
        model: modelName.name,
        modelVariant: modelName.variant,
        contextPercent,
        agents,
        // Priority: built-in rate limits > OpenCode quota > MiniMax quota > Bailian quota
        fiveHourPercent: data.rate_limits?.five_hour?.used_percentage
            ?? ocQuota?.rollingPercent ?? mmQuota?.fiveHourUsedPct ?? blQuota?.rollingPercent ?? null,
        sevenDayPercent: data.rate_limits?.seven_day?.used_percentage
            ?? ocQuota?.weeklyPercent ?? mmQuota?.sevenDayUsedPct ?? blQuota?.weeklyPercent ?? null,
        fiveHourResetsAt: toMs(data.rate_limits?.five_hour?.resets_at)
            ?? ocQuota?.rollingResetsAt ?? mmQuota?.fiveHourResetsAt ?? blQuota?.rollingResetsAt ?? null,
        sevenDayResetsAt: toMs(data.rate_limits?.seven_day?.resets_at)
            ?? ocQuota?.weeklyResetsAt ?? mmQuota?.sevenDayResetsAt ?? blQuota?.weeklyResetsAt ?? null,
        extra,
        monthlyPercent: ocQuota?.monthlyPercent ?? blQuota?.monthlyPercent ?? null,
        monthlyResetsAt: ocQuota?.monthlyResetsAt ?? blQuota?.monthlyResetsAt ?? null,
    };
    console.log(render(renderData));
}
main().catch(() => process.exit(0));
