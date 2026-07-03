# OpenCode Go 配额显示 — AI 安装指引

> 本文件供 AI 代理在用户安装 cc-hud 时读取和执行。
> 目标：自动检测用户是否在使用 OpenCode Go，并在需要时引导用户配置配额显示。

---

## 1. 概述

OpenCode Go (`https://opencode.ai`) 是一个 Anthropic API 代理服务，提供订阅制配额（rolling / weekly / monthly）。cc-hud 的 `src/opencode.ts` 模块通过抓取 OpenCode 工作区页面上的内联 JS 变量（`rollingUsage`、`weeklyUsage`、`monthlyUsage`）提取配额数据。

状态栏显示效果：
```
[Sonnet 4.6] ██░░░░░░░░ 20% (1M) │ 5h:7% (1.7h) │ 7d:25% (2.8d) │ 月:39% (8.8d)
```

## 2. 自动检测：用户是否在用 OpenCode Go

AI 需要检查以下位置（按优先级）：

| 检查目标 | 检测方法 | 判断条件 |
|---------|---------|---------|
| `ANTHROPIC_BASE_URL` 环境变量 | `process.env.ANTHROPIC_BASE_URL` | 包含 `opencode.ai` |
| Claude Code `settings.json` 中的 `env` 字段 | 读取 `~/.claude/settings.json` → `env.ANTHROPIC_BASE_URL` | 包含 `opencode.ai` |
| 用户正在使用的 API 端点（对话中提及） | 直接询问用户 | 包含 `opencode.ai` |

**判定逻辑：** 以上任一匹配 → 用户在使用 OpenCode Go。

## 3. 所需环境变量

cc-hud 需要两个环境变量来拉取 OpenCode 配额：

### 3.1 `OPENCODE_AUTH`（必需）

OpenCode 网站的认证 Cookie，用于通过身份验证。

- **来源：** 用户浏览器中 opencode.ai 的 `auth` cookie
- **获取方法：** 见下文第 4 节
- **格式：** 一串 JWT 或会话令牌字符串（不含 `auth=` 前缀）

### 3.2 `OPENCODE_WS`（可选）

OpenCode 工作区 ID。

- **来源：** 用户 OpenCode 工作区的 URL
- **格式：** `wrk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **默认值：** `wrk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`（占位符，不设置也可工作，但显示的不是用户自己的数据）
- **获取方法：** 登录 opencode.ai → 浏览器地址栏 `/workspace/<workspace_id>/go` 中的 `<workspace_id>`

## 4. AI 引导用户获取配置值的对话流程

### 步骤 1：确认 + 询问意愿

```
检测到您使用了 OpenCode Go（API 端点指向 opencode.ai）。
cc-hud 可以显示您的 OpenCode 订阅配额（5h / 7d / 月）。

是否要开启配额显示？[Y/n]
```

→ 用户拒绝 → 跳过，不写入任何配置。
→ 用户同意 → 进入步骤 2。

### 步骤 2：引导获取 `OPENCODE_AUTH`

```
请在浏览器中执行以下操作：

1. 登录 https://opencode.ai
2. 打开开发者工具（F12）
3. 切换到 Application / 存储（Storage）选项卡
4. 在左侧找到 Cookies → opencode.ai
5. 找到名为 `auth` 的 Cookie
6. 复制它的值（一长串字符串，通常以 eyJ... 开头）

把这个值告诉我，我帮你配置。
```

**容错：** 如果用户找不到，可以改用 JavaScript 方式：
```
在 opencode.ai 已登录状态下，打开控制台（Console）输入：
  document.cookie.split('; ').find(c => c.startsWith('auth='))?.slice(5)

把输出的值告诉我。
```

### 步骤 3：引导获取 `OPENCODE_WS`（可选）

```
还想显示月度配额（月:98%）吗？
如果需要，请把工作区 ID 告诉我：

1. 登录 https://opencode.ai
2. 进入任意工作区
3. 浏览器地址栏的 URL 是：
   https://opencode.ai/workspace/<这里的工作区ID>/go
4. 复制那个 ID（以 wrk_ 开头）

不需要的话也可以跳过，cc-hud 会使用默认值。
```

### 步骤 4：写入配置

将获取到的值写入 `~/.claude/settings.json`：

```json
{
  "env": {
    "OPENCODE_AUTH": "<用户提供的auth值>",
    "OPENCODE_WS": "<用户提供的工作区ID>"
  }
}
```

⚠️ **注意：**
- `settings.json` 中已有其他 `env` 键 → **合并写入**，不要覆盖
- `settings.json` 中已有 `OPENCODE_AUTH` → 询问是否覆盖
- 不要写入到 `settings.local.json`（不会被 Claude Code 读取）

### 步骤 5：验证

配置完成后，让用户运行以下命令测试：

```bash
node -e "
process.env.OPENCODE_AUTH='<刚刚设置的值>';
process.env.OPENCODE_WS='<工作区ID>';
import('./path/to/cc-hud/dist/opencode.js').then(m => 
  m.getOpenCodeQuota().then(console.log)
);
"
```

或者直接 /reload-plugins 后在状态栏查看是否出现 `5h:X% │ 7d:Y% │ 月:Z%` 格式的配额信息。

---

## 5. 边界情况与错误处理

| 情况 | AI 应如何处理 |
|------|-------------|
| `OPENCODE_AUTH` 过期 | 显示 `Go —` 或完全不显示配额。提示用户重新获取 Cookie |
| 用户没有 OpenCode 账号 | 跳过。不影响其他功能 |
| 用户拒绝提供信息 | 跳过。不影响其他功能 |
| `OPENCODE_WS` 使用默认值 | 配额数据可能不准。温和提示最好设置自己的工作区 ID |
| 网络请求超时 | 静默降级，不影响其他字段显示 |
| 用户在使用多个代理 | 优先显示 OpenCode 配额（在 index.ts 中优先级高于 MiniMax） |

## 6. 技术细节

**数据源：** `https://opencode.ai/workspace/{wsId}/go` 页面 HTML 中的内联 JS：

```js
rollingUsage:$R[30]={status:"ok",resetInSec:5647,usagePercent:7}
weeklyUsage:$R[31]={status:"ok",resetInSec:245174,usagePercent:25}
monthlyUsage:$R[32]={status:"ok",resetInSec:597495,usagePercent:98}
```

**缓存：** 每次请求结果缓存 5 分钟（`TTL = 5 * 60 * 1000`），避免频繁请求。

**超时：** 5 秒（OpenCode 页面需要完整 HTML 渲染）。

**静默降级链：** `getOpenCodeQuota()` → `getMmxQuota()` → `null`（见 `src/index.ts:76-86`）

## 7. 相关文件

| 文件 | 用途 |
|------|------|
| `src/opencode.ts` | 核心实现：解析 env、抓取页面、提取配额、缓存 |
| `src/index.ts` | 入口：调用 getOpenCodeQuota 并合并到 RenderData |
| `src/types.ts` | OpenCodeQuota 接口定义及 RenderData 中的字段 |
| `src/cache.ts` | 共享缓存和网络请求工具 |
| `tests/opencode.test.ts` | 单元测试 |

---

*版本：1.0 — 供 AI 代理在 cc-hud 安装 / 设置流程中使用*
