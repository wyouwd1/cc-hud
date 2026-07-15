import { withCache, fetchWithTimeout } from './cache.js';
const API_HOST = 'https://bailian-cs.console.aliyun.com/data/api.json';
function isBailian() {
    return !!process.env.CC_HUD_BAILIAN_COOKIE;
}
function cookie() {
    return process.env.CC_HUD_BAILIAN_COOKIE ?? '';
}
function secToken() {
    return process.env.CC_HUD_BAILIAN_SEC_TOKEN ?? null;
}
function region() {
    return process.env.CC_HUD_BAILIAN_REGION ?? 'cn-beijing';
}
function aggregatePlan(info) {
    return {
        rollingPercent: Math.round((info.per5HourUsedQuota / info.per5HourTotalQuota) * 100),
        rollingResetsAt: info.per5HourQuotaNextRefreshTime,
        weeklyPercent: Math.round((info.perWeekUsedQuota / info.perWeekTotalQuota) * 100),
        weeklyResetsAt: info.perWeekQuotaNextRefreshTime,
        monthlyPercent: Math.round((info.perBillMonthUsedQuota / info.perBillMonthTotalQuota) * 100),
        monthlyResetsAt: info.perBillMonthQuotaNextRefreshTime,
    };
}
async function fetchQuota() {
    const ck = cookie();
    const token = secToken();
    if (!ck || !token)
        return null;
    const params = encodeURIComponent(JSON.stringify({
        Api: 'zeldaEasy.bailian-commerce.codingPlan.queryCodingPlanInstanceInfoV2',
        V: '1.0',
        Data: {
            queryCodingPlanInstanceInfoRequest: {
                commodityCode: 'sfm_codingplan_public_cn',
                onlyLatestOne: true,
            },
            cornerstoneParam: {
                protocol: 'V2',
                console: 'ONE_CONSOLE',
                productCode: 'p_efm',
                domain: 'bailian.console.aliyun.com',
                consoleSite: 'BAILIAN_ALIYUN',
                xsp_lang: 'zh-CN',
            },
        },
    }));
    const body = `params=${params}&region=${region()}&sec_token=${token}`;
    try {
        const resp = await fetchWithTimeout(API_HOST, {
            method: 'POST',
            headers: {
                accept: '*/*',
                'content-type': 'application/x-www-form-urlencoded',
                cookie: ck,
                origin: 'https://bailian.console.aliyun.com',
                referer: 'https://bailian.console.aliyun.com/cn-beijing?tab=plan',
                'user-agent': 'cc-hud/1.0',
            },
            body,
        }, 3000);
        if (!resp.ok)
            return null;
        const raw = await resp.json();
        if (raw.code !== '200')
            return null;
        const data = raw.data;
        const dataV2 = data?.DataV2;
        const v2Data = dataV2?.data;
        const innerData = v2Data?.data;
        const instances = innerData?.codingPlanInstanceInfos;
        if (!instances || instances.length === 0)
            return null;
        const quotaInfo = instances[0].codingPlanQuotaInfo;
        if (!quotaInfo)
            return null;
        return aggregatePlan(quotaInfo);
    }
    catch {
        return null;
    }
}
export async function getBailianQuota() {
    if (!isBailian())
        return null;
    return withCache('bailian-quota', () => fetchQuota());
}
