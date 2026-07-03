import { readCached, writeCached, fetchWithTimeout, TTL } from './cache.js';

const API_HOST = 'https://bailian-cs.console.aliyun.com/data/api.json';

export interface BailianQuota {
  rollingPercent: number;
  rollingResetsAt: number;
  weeklyPercent: number;
  weeklyResetsAt: number;
  monthlyPercent: number;
  monthlyResetsAt: number;
}

function isBailian(): boolean {
  return !!process.env.CC_HUD_BAILIAN_COOKIE;
}

function cookie(): string {
  return process.env.CC_HUD_BAILIAN_COOKIE ?? '';
}

function secToken(): string | null {
  return process.env.CC_HUD_BAILIAN_SEC_TOKEN ?? null;
}

function region(): string {
  return process.env.CC_HUD_BAILIAN_REGION ?? 'cn-beijing';
}

interface CodingPlanQuotaInfo {
  per5HourUsedQuota: number;
  per5HourTotalQuota: number;
  per5HourQuotaNextRefreshTime: number;
  perWeekUsedQuota: number;
  perWeekTotalQuota: number;
  perWeekQuotaNextRefreshTime: number;
  perBillMonthUsedQuota: number;
  perBillMonthTotalQuota: number;
  perBillMonthQuotaNextRefreshTime: number;
}

function aggregatePlan(info: CodingPlanQuotaInfo): BailianQuota {
  return {
    rollingPercent: Math.round((info.per5HourUsedQuota / info.per5HourTotalQuota) * 100),
    rollingResetsAt: info.per5HourQuotaNextRefreshTime,
    weeklyPercent: Math.round((info.perWeekUsedQuota / info.perWeekTotalQuota) * 100),
    weeklyResetsAt: info.perWeekQuotaNextRefreshTime,
    monthlyPercent: Math.round((info.perBillMonthUsedQuota / info.perBillMonthTotalQuota) * 100),
    monthlyResetsAt: info.perBillMonthQuotaNextRefreshTime,
  };
}

async function fetchQuota(): Promise<BailianQuota | null> {
  const ck = cookie();
  const token = secToken();
  if (!ck || !token) return null;

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

    if (!resp.ok) return null;

    const raw = await resp.json() as Record<string, unknown>;
    if (raw.code !== '200') return null;

    const data = raw.data as Record<string, unknown> | undefined;
    const dataV2 = data?.DataV2 as Record<string, unknown> | undefined;
    const v2Data = dataV2?.data as Record<string, unknown> | undefined;
    const innerData = v2Data?.data as Record<string, unknown> | undefined;
    const instances = innerData?.codingPlanInstanceInfos as Array<Record<string, unknown>> | undefined;

    if (!instances || instances.length === 0) return null;

    const quotaInfo = instances[0].codingPlanQuotaInfo as CodingPlanQuotaInfo | undefined;
    if (!quotaInfo) return null;

    return aggregatePlan(quotaInfo);
  } catch {
    return null;
  }
}

export async function getBailianQuota(): Promise<BailianQuota | null> {
  if (!isBailian()) return null;

  const cached = readCached<{ payload: BailianQuota; ts: number }>('bailian-quota');
  if (cached && Date.now() - cached.ts < TTL) return cached.payload;

  const quota = await fetchQuota();
  if (quota) {
    writeCached('bailian-quota', { payload: quota, ts: Date.now() });
    return quota;
  }

  return cached?.payload ?? null;
}
