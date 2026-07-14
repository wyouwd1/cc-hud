# SPEC: OpenCode Go 自动识别与配置引导

> 状态: 已访谈定稿 | 版本: 0.1 | 日期: 2026-07-14

---

## 1. 概述

### 1.1 问题

OpenCode Go 作为本地代理（`127.0.0.1`），有两个独特痛点：

1. **无固定域名** — 无法像 DeepSeek（`api.deepseek.com`）那样通过 `ANTHROPIC_BASE_URL` 的域名特征自动识别后端类型。
2. **配额数据在云端** — 需要用户额外提供 `OPENCODE_AUTH` cookie 才能从 opencode.ai 抓取配额。

当前用户必须**手动配置** `OPENCODE_AUTH` + `OPENCODE_WS` 才能看到配额，cc-hud 不做任何提示，新用户不知道需要配置。

### 1.2 目标

1. **智能识别** — 当 `ANTHROPIC_BASE_URL` 指向 `127.0.0.1` 时，推断用户可能在使用 OpenCode Go。
2. **配置引导** — 检测到 OpenCode Go 但未配置凭据时，在状态栏和独立指引中引导用户获取 auth cookie。
3. **可静音** — 用户确认不是 OpenCode Go 或不想配置时，可通过环境变量永久关闭提示。

### 1.3 用户旅程

```
用户使用 OpenCode Go 代理
  → cc-hud 检测到 127.0.0.1
  → 无 OPENCODE_AUTH
  → 状态栏 extra 段显示 "OC need auth → opencode.ai/go?ref=TN4ZD3A7YH"
  → stdout 输出独立指引行（AI 可见）
  → AI 读取后提示用户访问 opencode.ai 获取 curl
  → 用户配置 OPENCODE_AUTH（或设置 CC_HUD_SKIP_OC_HINT=1 静音）
```

---

## 2. 探测方式

### 2.1 判定条件

| 条件 | 值 |
|------|-----|
| 检测目标 | `ANTHROPIC_BASE_URL` 环境变量 |
| 匹配模式 | 包含 `127.0.0.1` 或 `localhost` |
| 端口范围 | 任意端口 |
| 匹配方式 | 字符串 `.includes('127.0.0.1')` |

### 2.2 不做的探测

- ❌ 不发 HTTP 请求探测本地端口（避免副作用和用户感知延迟）
- ❌ 不请求远程 `opencode.ai/go?ref=TN4ZD3A7YH` 来辅助确认
- ❌ 不探测端口号范围（OpenCode Go 默认端口 15721，但用户可能自定义）

---

## 3. 状态机

### 3.1 状态定义

```
              ┌──────────────────────────────────────────┐
              │           ANTHROPIC_BASE_URL              │
              │       包含 127.0.0.1 ?                    │
              │     ┌───┐         ┌───┐                  │
              │     │ 是│         │ 否│                  │
              │     └┬──┘         └┬──┘                  │
              │      ↓             ↓                      │
              │  ┌───────┐   ┌──────────┐                │
              │  │ 已识别  │   │ 非OpenCode│              │
              │  └───┬───┘   │  Go (A)  │                │
              │      ↓       └──────────┘                │
              │  OPENCODE_AUTH ?                         │
              │  ┌───┐     ┌───┐                        │
              │  │ 有│     │ 无│                        │
              │  └┬──┘     └┬──┘                        │
              │   ↓         ↓                            │
              │  ┌─────┐  ┌──────────┐  ┌─────────────┐ │
              │  │已配置│  │未配置(C) │  │ 已静音(E)   │ │
              │  │(B)  │  │+ 引导    │  │ CC_HUD_SKIP │ │
              │  └─────┘  └──────────┘  │ _OC_HINT=1  │ │
              │                         └─────────────┘ │
              └──────────────────────────────────────────┘
```

| 状态 | 条件 | 行为 |
|------|------|------|
| **A: 非 OpenCode Go** | `ANTHROPIC_BASE_URL` 不含 `127.0.0.1` | 当前行为不变。`isOpenCode()` → `false`，配额穿透到其他后端 |
| **B: 已识别 + 已配置** | 含 `127.0.0.1` + 有 `OPENCODE_AUTH` | `isOpenCode()` → `true`，正常通过 `getOpenCodeQuota()` 抓取配额 |
| **C: 已识别 + 未配置** | 含 `127.0.0.1` + 无 `OPENCODE_AUTH` + 无静音 | 显示引导提示 |
| **D: 边缘: 有凭证无识别** | 不含 `127.0.0.1` + 有 `OPENCODE_AUTH` | 当前行为不变（用户可能直连 opencode.ai 或在非标准代理上使用） |
| **E: 已静音** | `CC_HUD_SKIP_OC_HINT=1` | 不显示引导提示，不输出指引行 |

---

## 4. 输出设计

### 4.1 状态栏（extra 段）

仅状态 C 时显示。在 extra 段输出纯文本（不含 ANSI 颜色，由 render.ts 统一上色）：

```
OC need auth → opencode.ai/go?ref=TN4ZD3A7YH
```

在 render.ts 中渲染为 `C.teal`（Catppuccin 青色，#94e2d5）色值。

### 4.2 独立指引行（stdout）

在状态栏行之前输出一行纯文本（无 ANSI），格式：

```
[cc-hud] ⚠ OpenCode Go 本地代理已检测到。请执行以下步骤配置配额查看：
  1. 用浏览器访问 https://opencode.ai/go?ref=TN4ZD3A7YH
  2. 打开开发者工具 (F12) → Network 标签
  3. 刷新页面，找到对 go?ref=TN4ZD3A7YH 的请求
  4. 右键 → Copy as cURL (bash)
  5. 提取 cookie 中的 auth 值
  6. 设置环境变量 OPENCODE_AUTH=<auth值>
  或设置 CC_HUD_SKIP_OC_HINT=1 关闭此提示。
```

AI 读取到此指引后，转换为针对用户的自然语言提示，引导用户完成操作。

### 4.3 输出时机

- 每次 cc-hud 运行时，如果状态 C 成立，都输出指引行 + extra 段提示
- 如果状态 E（已静音），不输出任何提示

---

## 5. 实现计划

### 5.1 变更文件

| 文件 | 变更内容 |
|------|---------|
| `src/opencode.ts` | 修改 `isOpenCode()` 逻辑；新增 `getOpenCodeHint()` 函数；新增 `isOpenCodeDetected()` / `isOpenCodeSilenced()` 辅助函数 |
| `src/index.ts` | 引入 `getOpenCodeHint()`；在 extra 段 pipeline 中插入引导提示；在 `console.log` 前增加指引行输出 |
| `src/types.ts` | 无需变更（extra 字段已存在） |
| `SPEC.md` | 当前文档 |
| `CLAUDE.md` | 记录新功能说明 |

### 5.2 `src/opencode.ts` 详细设计

#### 当前 `isOpenCode()`：
```typescript
function isOpenCode(): boolean {
  return !!process.env.OPENCODE_AUTH;
}
```

#### 修改后：
```typescript
/** OPENCODE_AUTH 凭证已配置 */
function hasCredentials(): boolean {
  return !!process.env.OPENCODE_AUTH;
}

/** ANTHROPIC_BASE_URL 指向本地回环地址（可能是 OpenCode Go） */
function isLocalProxy(): boolean {
  const url = process.env.ANTHROPIC_BASE_URL ?? '';
  return url.includes('127.0.0.1');
}

/** OpenCode 相关功能的全局开关（含凭证或有本地代理特征） */
export function isOpenCode(): boolean {
  return hasCredentials() || isLocalProxy();
}

/** 是否已静音提示 */
export function isHintSilenced(): boolean {
  return process.env.CC_HUD_SKIP_OC_HINT === '1';
}

/** 是否需要显示引导（本地代理 + 无凭证 + 未静音） */
export function needsGuidance(): boolean {
  return isLocalProxy() && !hasCredentials() && !isHintSilenced();
}

/** 获取引导提示文字 */
export function getOpenCodeHint(): string | null {
  if (!needsGuidance()) return null;
  return 'OC need auth → opencode.ai/go?ref=TN4ZD3A7YH';
}

/** 获取独立指引行 */
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
```

### 5.3 `src/index.ts` 详细设计

```typescript
import { getOpenCodeQuota, getOpenCodeHint, getOpenCodeGuidanceLine } from './opencode.js';

// 在 main() 中：

// 1. 先获取引导提示（不涉及网络请求，同步返回）
const ocHint = getOpenCodeHint();

// 2. 输出独立指引行（如果有）
const guidanceLine = getOpenCodeGuidanceLine();
if (guidanceLine) {
  console.log(guidanceLine);
}

// 3. extra 段 pipeline 调整
const getExtraSegment = async (): Promise<string | null> =>
  readExtraFile()
    ?? ocHint  // 引导提示优先于其他后端余额
    ?? await getQwenBalance()
    ?? await getMoonshotBalance()
    ?? await getGroqUsage()
    ?? await getExtra()
    ?? await getGlmBalance();

// 4. 配额获取不变
const [ocQuota, mmQuota, blQuota, extra] = await Promise.all([
  getOpenCodeQuota(),
  getMmxQuota(),
  getBailianQuota(),
  getExtraSegment(),
]);
```

### 5.4 优先级顺序

extra 段优先级（从高到低）：

```
CC_HUD_EXTRA_FILE > OC 引导提示 > Qwen > Moonshot > Groq > DeepSeek > GLM
```

---

## 6. 边界情况

| # | 场景 | 处理 |
|---|------|------|
| 1 | `ANTHROPIC_BASE_URL` 未设置 | 不触发检测，正常行为 |
| 2 | `ANTHROPIC_BASE_URL` 是 `localhost` 而非 `127.0.0.1` | `isLocalProxy()` 同时检查了 `localhost`，触发检测，行为一致 |
| 3 | 用户用其他本地代理（liteLLM、自建中转） | 可能误判，但一次提示 + 可静音处理 |
| 4 | 用户设置静音后改变主意 | 取消环境变量即可恢复提示 |
| 5 | 配置了 OPENCODE_AUTH 但 ANTHROPIC_BASE_URL 不含 127.0.0.1 | 当前行为不变，正常抓取配额 |
| 6 | `CC_HUD_SKIP_OC_HINT=1` + 有凭证 | 有凭证时不显示提示，静音不影响有凭证的场景 |
| 7 | 用户通过 VPN 或代理隧道使本地出站地址非 127.0.0.1 | 不触发检测 |
| 8 | 独立指引行长文本是否影响 Claude Code 解析 | 指引行在 stdout 输出，状态栏行是最后一行。Claude Code 应取最后一行作为状态栏 |

---

## 7. 接口变化

### 7.1 新增环境变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `CC_HUD_SKIP_OC_HINT` | `0` / `1` | `0` | 设为 `1` 跳过 OpenCode Go 引导提示 |

### 7.2 新增导出函数

```typescript
// src/opencode.ts
export function isOpenCode(): boolean;       // 增强：新增本地代理检测
export function isHintSilenced(): boolean;   // 是否静音
export function needsGuidance(): boolean;    // 是否需要引导
export function getOpenCodeHint(): string | null;        // extra 段提示
export function getOpenCodeGuidanceLine(): string | null; // 独立指引行
```

### 7.3 无变化

- `RenderData` 接口不变（extra 已存在）
- `plugin.json` 不变（版本号本次不升）
- `render.ts` 不变（extra 段渲染逻辑不变）

---

## 8. 测试策略

| 类型 | 测试内容 |
|------|---------|
| 单元测试 | `isOpenCode()` 在 127.0.0.1 下返回 true |
| 单元测试 | `isOpenCode()` 在非 127.0.0.1 下仅凭凭证判定 |
| 单元测试 | `needsGuidance()` 在 127.0.0.1 + 无凭证 + 未静音 返回 true |
| 单元测试 | `needsGuidance()` 在 有凭证 / 已静音 / 非本地 返回 false |
| 单元测试 | `getOpenCodeHint()` 返回字符串格式符合预期 |
| 集成测试 | 模拟完整 pipeline，确认 extra 段包含 hint 文字 |
| 集成测试 | 设定 CC_HUD_SKIP_OC_HINT=1 后 hint 为空 |

---

## 9. 发布检查清单

- [ ] 单元测试覆盖所有状态组合
- [ ] CLAUDE.md 记录新功能
- [ ] 不破坏现有 OpenCode 配额抓取流程
- [ ] 不引入新的外部依赖
- [ ] 静默失败原则：任何异常不导致 cc-hud 崩溃

---

## 10. 未定/待决议事项

> 以下事项在实现阶段进一步确认：

1. **独立指引行的行为** — 每次调用 cc-hud 都输出指引行（静音前），用户每开一个新会话都会看到。这是预期行为。
2. **`localhost` 检测** — `isLocalProxy()` 同时检查了 `127.0.0.1` 和 `localhost`，行为已统一。
3. **指引行格式** — 当前采用 `[cc-hud] ⚠ ...` 前缀格式，Claude Code 是否能正确取最后一行作为状态栏？需验证。
