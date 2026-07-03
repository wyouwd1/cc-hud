import { readCached, writeCached, fetchWithTimeout, TTL } from './cache.js';
const HOST_CN = 'https://api.minimaxi.com';
const HOST_GLOBAL = 'https://api.minimax.io';
function isMmx() {
    return !!process.env.ANTHROPIC_BASE_URL?.includes('minimax');
}
function host() {
    return process.env.ANTHROPIC_BASE_URL?.includes('minimaxi.com') ? HOST_CN : HOST_GLOBAL;
}
function aggregatePlan(remains) {
    if (remains.length === 0)
        return null;
    const active = remains.find(m => m.current_interval_status === 1) ?? remains[0];
    const now = Date.now();
    return {
        fiveHourUsedPct: Math.max(0, 100 - active.current_interval_remaining_percent),
        fiveHourResetsAt: now + active.remains_time,
        sevenDayUsedPct: Math.max(0, 100 - active.current_weekly_remaining_percent),
        sevenDayResetsAt: now + active.weekly_remains_time,
    };
}
async function fetchQuota(apiKey) {
    try {
        const resp = await fetchWithTimeout(`${host()}/v1/token_plan/remains`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!resp.ok)
            return null;
        const data = (await resp.json());
        return aggregatePlan(data.model_remains ?? []);
    }
    catch {
        return null;
    }
}
export async function getMmxQuota() {
    if (!isMmx())
        return null;
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey)
        return null;
    const cached = readCached('mmx-quota');
    if (cached && Date.now() - cached.ts < TTL)
        return cached.payload;
    const quota = await fetchQuota(apiKey);
    if (quota) {
        writeCached('mmx-quota', { payload: quota, ts: Date.now() });
        return quota;
    }
    return cached?.payload ?? null;
}
