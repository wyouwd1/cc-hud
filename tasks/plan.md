# Implementation Plan: cc-hud OpenCode 插件兼容

## Overview

将 cc-hud 从「Claude Code 独立进程插件」改造为「OpenCode 进程内 TypeScript 插件」，
在保留 Claude Code 版全部功能的前提下，让 cc-hud 也能在 OpenCode Go 中通过 tmux 状态栏渲染。

## Architecture Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 插件形式 | TypeScript 模块导出 `Plugin` | 符合 `@opencode-ai/plugin` 标准 |
| 输出方式 | 原子写入 `~/.cc-hud-status` 文件 | tmux `status-right '#(cat ...)'` 零依赖 |
| 数据来源 | OpenCode 事件优先 + 后端 API 补充 + SQLite 兜底 | 事件延迟最低，后端 API 覆盖余额/配额，SQLite 保底 |
| 代码复用 | `opencode-plugin/` import `dist/` 编译产物 | 零重复，共享 render/model/cache 等核心逻辑 |
| npm 包 | 沿用 `@wyouwd1/cc-hud`，一个包两个入口 | 不增加 npm 包数量，用户统一管理 |
| 配置 | `opencode.json` 的 `cc-hud` 节 + 环境变量兼容 | 环境变量优先，opencode.json 后备，渐进迁移 |
| 配额采集 | 先调研 OpenCode 官方 API，无则保留 HTML scraping | 减少对 HTML 结构的脆弱依赖 |

## 可复用模块清单

### 直接 import（零修改）

| 模块 | 使用场景 |
|------|---------|
| `dist/render.js` → `render()` | 渲染 ANSI 状态行，输入 RenderData 输出 string |
| `dist/model.js` → `shortModelName()` | 模型 ID → 人类可读名称 |
| `dist/cache.js` → `withCache()`, `fetchWithTimeout()`, `extractBalance()` | API 缓存和 HTTP 请求 |
| `dist/constants.js` → `EFFORT_LABELS`, `TIMEOUT_MS` | 常量映射 |
| `dist/timestamp.js` → `toMs()` | 秒→毫秒时间戳转换 |
| `dist/proxy.js` → `isLocalProxy()` | 本地代理检测 |
| `dist/balance.js` → `getExtra()` | DeepSeek 余额 |
| `dist/glm.js` → `getGlmBalance()` | GLM 余额 |
| `dist/mmx.js` → `getMmxQuota()` | MiniMax 配额 |
| `dist/bailian.js` → `getBailianQuota()` | 百炼 Coding Plan |
| `dist/qwen.js` → `getQwenBalance()` | Qwen 余额 |
| `dist/moonshot.js` → `getMoonshotBalance()` | Moonshot 余额 |
| `dist/groq.js` → `getGroqUsage()` | Groq 用量 |

### 需插件内重写

| 原模块 | 原因 | 插件内替代 |
|--------|------|-----------|
| `stdin.ts` | OpenCode 无 stdin JSON | `session.ts` 从事件采集 |
| `transcript.ts` | OpenCode 用 SQLite 非 JSONL | `session.ts` + `sqlite.ts` |
| `opencode.ts` 的 HTML scraping | 改为官方 API | `quota.ts` |

## 依赖图

```
Step 1 status-writer.ts ──────────────┐
                                      │
Step 2 config.ts ─────────────────────┤
                                      ├──→ Step 7 index.ts
Step 3 session.ts ─────┐              │       │
                        ├──→ Step 6   │       └──→ Step 9 安装
Step 4 message.ts ─────┘    adapter   │
                        │    .ts      │
Step 5 quota.ts ────────┘            │
                                      │
Step 8 sqlite.ts (兜底,可选) ──────────┘
```

顺序约束：
- Step 1、2 无依赖 → 可并行
- Step 3、4、5 无依赖 → 可并行
- Step 6 依赖 3、4、5 的输出
- Step 7 依赖 1、2、6
- Step 8 完全独立，可后续加入
- Step 9、10 在 7 之后

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| OpenCode 事件 payload 字段未知 | 高 | Step 3 先写事件 dump 插件，摸清字段再正式编码 |
| OpenCode 订阅配额无官方 API | 中 | 保留现有 HTML scraping，`quota.ts` 内部切换 |
| Bun 运行时兼容 Node.js 代码 | 低 | 现有代码只用 `node:fs/promises` `fetch` 等通用 API |
| contextPercent 无法精确获取 | 中 | 标记为 `~` 近似值，与精确值区分 |

## 开放问题

1. OpenCode 的 `session.updated` 事件具体 payload 结构是什么？
2. OpenCode 是否有官方配额 REST API？
3. npm 包是否需要创建独立的 `@wyouwd1/cc-hud-opencode` 包？
