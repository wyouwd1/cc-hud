# CLAUDE.md — cc-hud 项目指令

## 项目概述

cc-hud — 精简的 Claude Code 单行状态栏插件，显示模型名称、上下文用量、活跃子代理、速率限制。

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript（strict） |
| 运行时 | Node.js ≥ 18 |
| 构建 | tsc（ESM, ES2022） |
| 依赖 | 零外部依赖，仅 Node.js 内置模块 |
| 测试 | node --test（内置测试运行器） |
| 配色 | Catppuccin Mocha（ANSI 256 色） |

## 项目结构

```
.claude-plugin/plugin.json  — 插件清单
commands/setup.md           — 安装配置命令（v0.5.0+ 写 launcher 到 ~/.claude/bin/）
src/
  index.ts                  — 入口：stdin → 解析 → 渲染 → stdout
  stdin.ts                  — 解析 stdin JSON
  transcript.ts             — 读 transcript JSONL 尾部 64KB，提取活跃 agent
  render.ts                 — 单行紧凑渲染（1/8 精度进度条 + ANSI 颜色）
  model.ts                  — 模型名美化（claude-opus-4-7[1m] → Opus 4.7 (1M)）
  balance.ts / glm.ts / mmx.ts  — DeepSeek / GLM / MiniMax 余额或配额采集
  types.ts                  — 类型定义
scripts/launcher.cjs        — 稳定路径 launcher（setup 复制到 ~/.claude/bin/cc-hud-launcher.cjs）
dist/                       — 编译输出（提交到仓库）
tests/*.test.ts(.cjs)       — node:test 单元测试（render / model / mmx / glm / launcher）
```

## 已支持的后端额度采集

| 模块 | 检测方式 | 认证 | API 类型 | 输出 |
|------|---------|------|---------|------|
| balance.ts | `ANTHROPIC_BASE_URL` 含 `deepseek` | `ANTHROPIC_AUTH_TOKEN` | REST API | 余额字符串 ¥xx.xx |
| glm.ts | `ANTHROPIC_BASE_URL` 含 `bigmodel.cn`/`api.z.ai` | `ANTHROPIC_AUTH_TOKEN` | REST API | 余额字符串 ¥xx.xx |
| qwen.ts | `ANTHROPIC_BASE_URL` 含 `dashscope`/`qwen` | `ANTHROPIC_AUTH_TOKEN` | REST API | 余额字符串 ¥xx.xx |
| moonshot.ts | `ANTHROPIC_BASE_URL` 含 `moonshot` | `ANTHROPIC_AUTH_TOKEN` | REST API | 余额字符串 ¥xx.xx |
| groq.ts | `ANTHROPIC_BASE_URL` 含 `groq` | `ANTHROPIC_AUTH_TOKEN` | REST API | 用量数值 |
| mmx.ts | `ANTHROPIC_BASE_URL` 含 `minimax` | `ANTHROPIC_AUTH_TOKEN` | REST API | BailianQuota 对象（3 档百分比+重置时间） |
| opencode.ts | `OPENCODE_AUTH` 环境变量 | Cookie | 抓取 HTML 页面 | BailianQuota 对象 |
| bailian.ts | `CC_HUD_BAILIAN_COOKIE` 环境变量 | 阿里云登录 Cookie | 控制台 POST API | BailianQuota 对象 |

### 百炼 Coding Plan 经验记录

**认证方式特殊：** 百炼不使用 API Key 查询额度，而是通过阿里云控制台 Cookie 认证。这与 opencode.ts 类似，但与其余 API Key 模块不同。

**API 地址：**
- 模型调用端点：`https://coding.dashscope.aliyuncs.com/apps/anthropic`（用户配在 `ANTHROPIC_BASE_URL`）
- 额度查询端点：`https://bailian-cs.console.aliyun.com/data/api.json`（控制台 API，走 POST）

**响应路径深：** 配额数据在 `data.DataV2.data.data.codingPlanInstanceInfos[0].codingPlanQuotaInfo`，需要 5 层 `.` 嵌套访问。

**3 档额度映射：**
```
per5HourUsedQuota / per5HourTotalQuota → rollingPercent
perWeekUsedQuota / perWeekTotalQuota   → weeklyPercent
perBillMonthUsedQuota / ...            → monthlyPercent
```

**环境变量：** 需要用户从浏览器 F12 手动复制 `CC_HUD_BAILIAN_COOKIE` 和 `CC_HUD_BAILIAN_SEC_TOKEN`，有有效期限制。

**集成注意：** 所有 3 档都走 `RenderData` 的 `fiveHourPercent`/`sevenDayPercent`/`monthlyPercent` 字段，与 OpenCode、MiniMax 共享同一优先级链。优先级：Claude 原生 > OpenCode > MiniMax > 百炼。

## 数据流

```
Claude Code → stdin JSON → cc-hud → stdout → 状态栏
           ↘ transcript JSONL（尾部 64KB → 活跃 agent）
```

## 性能与稳定性

- **无状态** — 每次调用都是独立进程，无内存泄漏风险
- **尾部读取** — 只读 transcript 最后 64KB，不全量解析
- **字符串预过滤** — 跳过不含 agent 数据的行，减少 ~90% JSON.parse
- **2s 硬超时** — setTimeout + unref()，异常时强制退出不阻塞 Claude Code
- **所有 IO try-catch** — 失败静默降级，不崩溃

## 环境

- Windows 11，运行时使用 Node.js，不要使用 Bun（内存崩溃问题）
- Claude Code 必须通过 npm 安装（`npm i -g @anthropic-ai/claude-code`），不要使用原生安装器（native installer）
  - 原生安装器的 `claude.exe` 内嵌 Bun 运行时，会触发 `pas panic: deallocation did fail` 崩溃
  - npm 版使用系统 Node.js，稳定无此问题

## 语言约定

继承全局规则 `~/.claude/rules/common/language.md`：

| 内容 | 要求 |
|------|------|
| 回答/讨论 | 简体中文 |
| 提交信息 | 中文 |
| 代码注释 | 中文 |
| 变量/函数命名 | 英文 |
| 技术术语 | 保持英文（TypeScript、Node.js、ANSI 等） |
| 日志/错误消息 | 中文 |
