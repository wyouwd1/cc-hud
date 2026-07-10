# SPEC: 自定义模型（cc-switch 代理）名称正确显示

## 1. 目标

cc-hud 当前从 Claude Code stdin JSON 的 `model.id` / `display_name` 读取模型名。当用户通过 cc-switch 等代理使用自定义模型（如 deepseek-v4-flash）时，Claude Code 仍将 `model.id` 报告为 `claude-opus-4-8[1M]`，导致 hud 错误显示为「Opus 4.8」而非实际模型名。

要求：当 `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` 环境变量存在时，以此值作为模型显示名，替代从 stdin 解析的结果。

## 2. 背景

### 2.1 数据流

```
cc-switch                              cc-hud
   │                                      │
   │ 设定 ANTHROPIC_DEFAULT_OPUS_MODEL    │
   │   = claude-opus-4-8[1M]             │
   │ 设定 ANTHROPIC_DEFAULT_OPUS_MODEL   │
   │   _NAME = deepseek-v4-flash         │
   │                                      │
Claude Code                               │
   │ 发送 stdin JSON 给 cc-hud           │
   │ model.id = claude-opus-4-8[1M]      │
   │                                      ▼
                                    当前: 解析为 Opus 4.8 ✗
                                    目标: 显示 deepseek-v4-flash ✓
```

### 2.2 相关环境变量（Claude Code 内置机制）

| 变量 | 值 | 含义 |
|------|-----|------|
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `claude-opus-4-8[1M]` | 自定义模型在 cc 内部的 ID |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | `deepseek-v4-flash` | 自定义模型的实际显示名称 |
| `ANTHROPIC_BASE_URL` | `http://127.0.0.1:15721` | 代理地址（cc-switch 本地服务） |

这些变量由 cc-switch 设定，Claude Code 原生支持。`ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` 是 Claude Code v0.5+ 的标准配置项——当值非空时表示用户使用了自定义模型。

## 3. 方案设计

### 3.1 检测条件

分两步检测：

1. **是否使用本地代理**：`ANTHROPIC_BASE_URL` 包含 `127.0.0.1` 或 `localhost`
2. **实际模型名**：`ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` 的值

只有 step 1 命中时，才用 step 2 的值覆盖模型显示名。这样确保仅在本地代理场景下生效，不影响直连 Anthropic API 的用户。

### 3.2 修改范围

`src/model.ts` — 新增 `proxyModelName()` 函数，在 `shortModelName()` 中优先检测。

### 3.3 核心逻辑

```typescript
const PROXY_HOSTS = ['127.0.0.1', 'localhost'];

function isLocalProxy(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? '';
  return PROXY_HOSTS.some(h => baseUrl.includes(h));
}

function proxyModelName(): string | null {
  if (!isLocalProxy()) return null;
  const raw = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME;
  if (!raw) return null;
  // 如果 raw 能通过 tryParse 美化（如 deepseek-v4-flash → DeepSeek V4 Flash），使用美化结果
  const parsed = tryParse(raw);
  if (parsed) return parsed.name;
  // 否则直接返回原始值
  return raw.trim() || null;
}
```

在 `shortModelName()` 中，代理模型名 > stdin 解析：

```typescript
export function shortModelName(displayName?: string, id?: string): ModelName {
  // 1. 本地代理模式下，使用 ANTHROPIC_DEFAULT_OPUS_MODEL_NAME 显示实际模型
  const proxyName = proxyModelName();
  if (proxyName) {
    const variant = id ? tryParse(id)?.variant ?? null : null;
    return { name: proxyName, variant };
  }
  // 2. 原逻辑：try id → try display_name → fallback
  ...
}
```

### 3.3 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 环境变量 vs 检测 ANTHROPIC_BASE_URL | 环境变量 | BASE_URL 只是代理地址，不包含模型信息；OPUS_MODEL_NAME 是 Claude Code 原生语义 |
| 优先级 | env > id > display_name | 环境变量是用户/代理主动设定的，代表「实际是什么模型」，优先级应最高 |
| variant 处理 | 从原 id 提取 | `[1M]` 表示上下文容量，与模型本身无关，应保留 |
| 模型名美化 | 通过 tryParse | 已有的 deepseek/glm/mm 解析器能提供更友好的展示（deepseek-v4-flash → DeepSeek V4 Flash） |

### 3.4 边界情况

| 情况 | 行为 |
|------|------|
| env 未设置 | 完全回退当前行为，零侵入 |
| env 为空字符串 | 视为未设置，回退 |
| env 值不规范（非已知模式） | 直接显示原始值，不崩溃 |
| 同时使用 DeepSeek/GLM/MiniMax 配额模块 | 模型名替换互不影响，各模块独立 |

## 4. 测试

### 4.1 单元测试（`tests/model.test.ts`）

- `isLocalProxy()` 在 `ANTHROPIC_BASE_URL` 含 `127.0.0.1`/`localhost` 时返回 true
- `isLocalProxy()` 在 BASE_URL 为 `api.anthropic.com` 或未设置时返回 false
- `proxyModelName()` 在非本地代理模式下返回 null
- `proxyModelName()` 在本地代理 + `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` 设置时返回模型名
- `proxyModelName()` 在本地代理 + env 未设置时返回 null
- `proxyModelName()` 在本地代理 + env 为空字符串时返回 null
- `shortModelName()` 在 proxy 模式下模型名来自 env，variant 仍从 id 提取
- 代理模式下 `deepseek-v4-flash` → `DeepSeek V4 Flash`（经 tryParse 美化）

### 4.2 集成验证

- 设置 `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME=deepseek-v4-flash` 后运行 cc-hud，模型名显示为「DeepSeek V4 Flash」
- 不设置该变量时，行为完全不变

## 5. 实施步骤

### Step 1：修改 `src/model.ts`
- 新增 `envModelName()` 函数
- 修改 `shortModelName()` 添加环境变量优先逻辑
- 导出 `envModelName()` 供测试

### Step 2：编写测试
- 在 `tests/model.test.ts` 中新增 env 相关测试用例
- mock `process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME`

### Step 3：编译验证
- `npm run build` 通过
- `npm test` 通过

## 6. 验收标准

- [ ] `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` 设置时模型名正确显示为深层模型名
- [ ] 不设置该变量时行为零变化
- [ ] variant（如 `(1M)`）不受影响，正确渲染
- [ ] env 值与 tryParse 任一模式匹配时使用美化名，否则显示原始值
- [ ] `npm run build` + `npm test` 通过
- [ ] 改动量 ≤ 30 行

## 7. 不涉及的范围（Out of scope）

- Sonnet/Haiku 的自定义模型覆盖（`ANTHROPIC_DEFAULT_SONNET_MODEL_NAME` 等）— 当前 Opus 自定义最常用，后续可按需扩展
- 修改 cc-switch 或其他代理行为 — 仅从 cc-hud 侧解决
- cc-hud 加载时主动检测代理类型 — 不依赖任何代理特定逻辑
