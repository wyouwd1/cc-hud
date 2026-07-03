# SPEC: 阿里云百炼 Coding Plan 额度适配

## 1. 目标

为 cc-hud 新增阿里云百炼（Bailian）「Coding Plan（编码计划）」套餐的额度采集与显示，遵循现有后端额度模块的统一模式。

## 2. 背景

cc-hud 已支持 7 个后端额度/余额采集模块：

| 模块 | 检测条件 (`ANTHROPIC_BASE_URL`) | 认证方式 | 输出类型 |
|------|-------------------------------|---------|---------|
| qwen.ts | `dashscope` / `qwen` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 余额字符串 (¥xx.xx) |
| balance.ts (DeepSeek) | `deepseek` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 余额字符串 |
| glm.ts (GLM) | `bigmodel.cn` / `api.z.ai` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 余额字符串 |
| moonshot.ts | `moonshot` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 余额字符串 |
| groq.ts | `groq` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 用量数值 |
| mmx.ts (MiniMax) | `minimax` | `ANTHROPIC_AUTH_TOKEN` (API Key) | 配额对象 (5h/7d) |
| opencode.ts | `OPENCODE_AUTH` env | 独立 Cookie | 配额对象 (滚动/每周/每月) |

## 3. 百炼 Coding Plan 接入点

用户配置 Claude Code 使用百炼 Coding Plan 时，设置：

```
ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic
ANTHROPIC_AUTH_TOKEN=sk-<dashscope-api-key>
```

使用的 API 兼容端点：
- OpenAI 兼容：`https://coding.dashscope.aliyuncs.com/v1`
- Anthropic 兼容：`https://coding.dashscope.aliyuncs.com/apps/anthropic`

Coding Plan 本质是 DashScope（通义千问）平台上的预付费配额套餐，额度查询可直接使用 DashScope 标准账单 API。

## 4. 检测与认证

| 字段 | 方式 |
|------|------|
| 检测 | `ANTHROPIC_BASE_URL` 包含 `coding.dashscope.aliyuncs.com` |
| API Key | `ANTHROPIC_AUTH_TOKEN`（DashScope API Key） |
| 额度 API | `GET https://dashscope.aliyuncs.com/api/v1/billing/query`（同 qwen.ts） |

与 qwen.ts 的关系：
- qwen.ts 检测 `dashscope` / `qwen`（覆盖通用 DashScope 用户）
- bailian.ts 检测 `coding.dashscope.aliyuncs.com`（仅 Coding Plan 用户）
- 两者调用相同的 billing endpoint
- 优先级：bailian.ts 更具体，应排在 qwen.ts 之前

## 5. 模块设计

### 文件：`src/bailian.ts`

遵循最简模式（参考 qwen.ts，33 行）：

```typescript
import { readCached, writeCached, fetchWithTimeout, extractBalance, TTL } from './cache.js';

function isBailianCoding(): boolean {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !!base && base.includes('coding.dashscope.aliyuncs.com');
}

export async function getBailianBalance(): Promise<string | null> {
  if (!isBailianCoding()) return null;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) return null;

  const cached = readCached<{ balance: string; ts: number }>('bailian-balance');
  if (cached && Date.now() - cached.ts < TTL) return cached.balance;

  try {
    const resp = await fetchWithTimeout('https://dashscope.aliyuncs.com/api/v1/billing/query', {
      headers: { Authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (resp.ok) {
      const balance = extractBalance(await resp.json());
      if (balance) {
        writeCached('bailian-balance', { balance, ts: Date.now() });
        return balance;
      }
    }
  } catch {}

  return cached?.balance ?? null;
}
```

### 与 qwen.ts 的差异

| 维度 | qwen.ts | bailian.ts |
|------|---------|------------|
| 检测条件 | `dashscope` / `qwen` | `coding.dashscope.aliyuncs.com` |
| API 端点 | 同上 | 同上 (`dashscope.aliyuncs.com/api/v1/billing/query`) |
| 缓存键 | `qwen-balance` | `bailian-balance` |
| 优先级 | 通用 DashScope | 仅 Coding Plan（更具体） |

## 6. 集成到 index.ts

在 `getExtraSegment()` 优先级链中，bailian.ts 应**排在 qwen.ts 之前**（因为 `coding.dashscope.aliyuncs.com` 也包含 `dashscope`，bailian 更具体先匹配）：

```typescript
const getExtraSegment = async (): Promise<string | null> =>
  readExtraFile()
    ?? await getBailianBalance()    // 新增，在 qwen 之前
    ?? await getQwenBalance()
    ?? await getMoonshotBalance()
    ?? await getGroqUsage()
    ?? await getExtra()
    ?? await getGlmBalance();
```

为什么排 qwen 前面：如果用户用 `ANTHROPIC_BASE_URL=coding.dashscope.aliyuncs.com`，这个 URL 同时包含 `dashscope`，qwen.ts 的 `isQwen()` 也会返回 true。但 bailian.ts 是专门为 Coding Plan 优化的，应该优先匹配。

## 7. 实施步骤

### Step 1：新建 `src/bailian.ts`
- 30 行代码，风格与 qwen.ts 完全一致
- 检测条件 `coding.dashscope.aliyuncs.com`
- 缓存键 `bailian-balance`

### Step 2：集成到 `index.ts`
- 导入 `getBailianBalance`
- 加入 `getExtraSegment()` 链（qwen 前面）

### Step 3：单元测试
- 检测函数测试（`coding.dashscope.aliyuncs.com` 返回 true，不含的返回 false）
- 余额提取测试（使用模拟响应数据，复用 `cache.ts` 的 `extractBalance`）
- 优先级测试（bailian 在 qwen 之前匹配）

### Step 4：编译验证
- `npm run build` 通过
- `npm test` 通过

## 8. 验收标准

- [ ] `isBailianCoding()` 正确识别 `coding.dashscope.aliyuncs.com`
- [ ] 未配置 Coding Plan 时模块静默返回 null
- [ ] 余额提取与 qwen.ts 一致（复用 `extractBalance`）
- [ ] 缓存 5 分钟内不重复请求
- [ ] 网络错误静默降级
- [ ] bailian 在 qwen 之前匹配，避免误抢
- [ ] `npm run build` + `npm test` 通过
- [ ] 代码量 ≈ 30 行，无外部依赖
