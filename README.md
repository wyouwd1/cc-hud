<!--
  cc-hud — Claude Code 状态栏插件
  显示：模型名、上下文用量（进度条）、活跃子代理、速率限制（5h/7d/月）含重置倒计时
  纯 Node.js、零依赖、Windows 不崩溃（不用 Bun）

  关键词：claude-code plugin statusline status-bar hud monitoring context-window rate-limit reset-countdown agents windows crash-free zero-dependency catppuccin deepseek minimax glm token-plan
-->

<p align="center">
  <picture>
    <source srcset="https://raw.githubusercontent.com/wyouwd1/cc-hud/main/cc-hud-preview.svg" type="image/svg+xml" />
    <img src="https://raw.githubusercontent.com/wyouwd1/cc-hud/main/cc-hud-preview.png" alt="cc-hud 预览 — 模型、上下文条、代理、速率限制、余额" width="900" />
  </picture>
</p>

<h1 align="center">CC-HUD</h1>

<p align="center">
  <strong>Claude Code 精简单行状态栏插件</strong><br/>
  <sub>零崩溃、零依赖 — 模型 · 上下文 · 代理 · 速率限制 · 重置倒计时</sub>
</p>

<p align="center">
  <code>模型</code> &nbsp;&rarr;&nbsp; <code>上下文</code> &nbsp;&rarr;&nbsp; <code>代理</code> &nbsp;&rarr;&nbsp; <code>速率限制</code>
  <br/>
  <sub>你需要的一切，不多不少。</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@wyouwd1/cc-hud"><img src="https://img.shields.io/npm/v/@wyouwd1/cc-hud?style=flat-square&color=cb3837" alt="npm 版本" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/@wyouwd1/cc-hud"><img src="https://img.shields.io/npm/dm/@wyouwd1/cc-hud?style=flat-square&color=cb3837" alt="npm 下载量" /></a>
  &nbsp;
  <a href="#安装"><img src="https://img.shields.io/badge/安装-3_条命令-blueviolet?style=flat-square" alt="安装" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/依赖-0-brightgreen?style=flat-square" alt="零依赖" />
  &nbsp;
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=flat-square" alt="node >= 18" />
  &nbsp;
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" />
</p>

<br/>

## 为什么用 CC-HUD？

**问题：** Claude Code 的原生安装器内嵌了 [Bun](https://bun.sh)，在 **Windows** 上存在已知的内存分配器 Bug（[oven-sh/bun#25082](https://github.com/oven-sh/bun/issues/25082)）。状态栏插件（如 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud)）在 **每次 tick** 都会运行，放大了内存压力，大大增加 `pas panic` 崩溃的几率。

**解决方案：** CC-HUD 是一个**零崩溃的替代方案** — 纯 Node.js、零依赖、每次调用无状态、~60ms 渲染、2s 硬超时。专为保持状态栏稳定运行而设计，不会拖垮 Claude Code。

> [!TIP]
> **Windows 用户：** 建议用 `npm i -g @anthropic-ai/claude-code` 代替原生安装器，彻底规避 Bun 崩溃。

<br/>

## 功能

<table>
<tr>
  <td align="center" width="20%"><h3>█▌</h3><b>上下文条</b><br/><sub>1/8 精度块<br/>80 级粒度</sub></td>
  <td align="center" width="20%"><h3>◧</h3><b>颜色</b><br/><sub><a href="https://github.com/catppuccin/catppuccin">Catppuccin Mocha</a><br/>双色渐变</sub></td>
  <td align="center" width="20%"><h3>◐</h3><b>代理</b><br/><sub>运行中的子代理<br/>含类型和模型</sub></td>
  <td align="center" width="20%"><h3>%</h3><b>速率限制</b><br/><sub>5h / 7d / 月<br/>+ 重置倒计时</sub></td>
  <td align="center" width="20%"><h3>0</h3><b>依赖</b><br/><sub>零。仅用<br/>Node 内置模块</sub></td>
</tr>
</table>

<br/>

## 安装

在 Claude Code 中执行：

```
/plugin marketplace add wyoud1/cc-hud
/plugin install cc-hud@cc-hud
/reload-plugins
/cc-hud:setup        # 幂等，可重复运行
```

**完成** — 无需重启；`/reload-plugins` 热加载 HUD。

> [!NOTE]
> `/cc-hud:setup` 会在 `~/.claude/bin/cc-hud-launcher.cjs` 安装一个小型启动器，并将 `statusLine.command` 指向它。该命令是**幂等的**——重复运行会自动迁移旧版路径，已是新版则直接跳过。

### 升级

```
/plugin marketplace update cc-hud
/reload-plugins
```

> [!NOTE]
> 自 **v0.5.0** 起，`/cc-hud:setup` 安装了一个小型**启动器**位于 `~/.claude/bin/cc-hud-launcher.cjs`，并将 `statusLine.command` 指向它。启动器在每次 tick 时解析当前已安装的 cc-hud 版本，因此插件升级不再需要重新运行 `/cc-hud:setup`。
>
> 从 **≤0.4.x** 升级？重新运行 `/cc-hud:setup` **一次**——它会自动检测旧版路径并迁移到启动器。

<details>
<summary><b>通过 npm 安装</b></summary>
<br/>

```bash
npm i -g @wyouwd1/cc-hud
```

添加到 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx @wyouwd1/cc-hud",
    "padding": 2
  }
}
```

</details>

<details>
<summary><b>从源码安装</b></summary>
<br/>

```bash
git clone https://github.com/wyouwd1/cc-hud.git
cd cc-hud && npm install && npm run build
```

添加到 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/cc-hud/dist/index.js",
    "padding": 2
  }
}
```

</details>

<br/>

## 工作原理

```
Claude Code ──stdin JSON──→  ~/.claude/bin/cc-hud-launcher.cjs   ← 稳定路径 (v0.5+)
                              │ 解析当前安装的 cc-hud
                              ▼
                             cc-hud dist/index.js  ──stdout──→ 状态栏
                              ↘ transcript JSONL (尾部 64KB → 活跃代理)
```

<table>
<tr>
  <td align="center" width="25%"><b>无状态</b><br/><sub>每次 tick 全新进程<br/>零内存泄漏</sub></td>
  <td align="center" width="25%"><b>快速</b><br/><sub>~60ms 渲染<br/>300ms 去抖内完成</sub></td>
  <td align="center" width="25%"><b>安全</b><br/><sub>2s 硬超时<br/>所有 IO 都有 try-catch</sub></td>
  <td align="center" width="25%"><b>升级无忧</b><br/><sub>稳定启动器 (v0.5+)<br/>升级无需重新配置</sub></td>
</tr>
</table>

<br/>

## 自动检测的后端

cc-hud 会自动检测你的 `ANTHROPIC_BASE_URL`，自动拉取**余额 / 配额 / 订阅信息**——**零配置**，本地缓存 5 分钟。模型名称会自动美化（`glm-5.2[1m]` → `GLM 5.2 (1M)`，`MiniMax-M3` → `MiniMax M3` 等）。设置 `CC_HUD_THEME` 可切换配色方案。

<table>
<tr>
  <th>后端</th>
  <th><code>ANTHROPIC_BASE_URL</code></th>
  <th>额外字段</th>
</tr>
<tr>
  <td><b>DeepSeek</b></td>
  <td><code>https://api.deepseek.com/anthropic</code></td>
  <td>账户余额 — <code>¥13.44</code></td>
</tr>
<tr>
  <td><b>MiniMax</b></td>
  <td><code>https://api.minimaxi.com/anthropic</code></td>
  <td>Token Plan — <code>5h:17% (1.1h) │ 7d:2% (6.4d)</code></td>
</tr>
<tr>
  <td><b>GLM</b></td>
  <td><code>https://open.bigmodel.cn/api/anthropic</code><br/><code>https://api.z.ai/api/anthropic</code></td>
  <td>账户余额 — <code>¥88.50</code></td>
</tr>
<tr>
  <td><b>OpenCode Go</b></td>
  <td>通过 <code>OPENCODE_AUTH</code> 检测</td>
  <td>Go 订阅 — <code>5h:7% (1.7h) │ 7d:25% (2.8d) │ 月:98% (6.9d)</code></td>
</tr>
<tr>
  <td><b>Qwen (DashScope)</b></td>
  <td><code>https://dashscope.aliyuncs.com/compatible-mode/anthropic</code></td>
  <td>账户余额 — <code>¥88.50</code></td>
</tr>
<tr>
  <td><b>Moonshot (Kimi)</b></td>
  <td><code>https://api.moonshot.cn/anthropic</code></td>
  <td>账户余额 — <code>¥66.60</code></td>
</tr>
<tr>
  <td><b>Groq</b></td>
  <td><code>https://api.groq.com/anthropic</code></td>
  <td>用量/配额 — <code>9500</code></td>
</tr>
<tr>
  <td><b>百炼 Coding Plan</b></td>
  <td>通过 <code>CC_HUD_BAILIAN_COOKIE</code> 检测</td>
  <td>Coding Plan — <code>5h:0% (─) │ 7d:1% (2.3d) │ 月:3% (6.9d)</code></td>
</tr></table>

输出示例：

```
[DeepSeek V4 Pro] ██░░░░░░░░ 20% │ ¥13.44
[MiniMax M3]      █▎░░░░░░░░ 13% │ 5h:17% (1.1h) │ 7d:2% (6.4d)
[GLM 5.2]         ████▏░░░░░ 41% (1M) │ ¥88.50
[Qwen 2.5]        ██░░░░░░░░ 20% │ ¥88.50
[Moonshot v1]     ██░░░░░░░░ 20% │ ¥66.60
[Groq Llama]      █▎░░░░░░░░ 13% │ 9500
```

兼容 `dscode` / `mmcode` / `glmcode` / `ZCode` 或任何设置了 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` 的启动器。

### 百炼 Coding Plan

百炼 Coding Plan 套餐通过阿里云控制台 Cookie 认证，显示 5 小时/每周/每月 3 档配额及重置倒计时：

```json
// ~/.claude/settings.json
{
  "env": {
    "CC_HUD_BAILIAN_COOKIE": "login_aliyunid_ticket=xxx; tfstk=yyy; ...",
    "CC_HUD_BAILIAN_SEC_TOKEN": "xxxxx",
    "CC_HUD_BAILIAN_REGION": "cn-beijing"
  }
}
```

| 变量 | 说明 | 必须 |
|------|------|------|
| `CC_HUD_BAILIAN_COOKIE` | 阿里云登录 Cookie | 是 |
| `CC_HUD_BAILIAN_SEC_TOKEN` | 控制台请求的 `sec_token` 参数 | 是 |
| `CC_HUD_BAILIAN_REGION` | 区域，默认 `cn-beijing` | 否 |

<details>
<summary><b>如何获取 Cookie 和 sec_token（点击展开）</b></summary>

1. 浏览器打开 [百炼控制台 → Coding Plan](https://bailian.console.aliyun.com/cn-beijing?tab=plan#/efm/subscription/coding-plan)，确保已登录
2. 按 `F12` 打开开发者工具，切换到 **Network（网络）** 标签
3. 勾选 **Preserve log（保留日志）**
4. 刷新页面，在请求列表中找到 `data/api.json`（或过滤 `codingPlan`）
5. 点击该请求，在右侧面板：
   - **Cookie** → **Headers（请求头）** 标签 → `Request Headers` 下的 `cookie` 字段 → 复制整个值
   - **sec_token** → **Payload（负载）** 标签 → 找到 `sec_token` 参数 → 复制其值
6. 将 Cookie 和 sec_token 填入上方 `settings.json` 对应的环境变量

> ⚠️ Cookie 有有效期（通常几小时到几天），过期后需重新获取。建议每月更新一次。
> 如果多次获取麻烦，可写脚本定时从浏览器导出 Cookie 写入环境变量。

</details>

输出示例：

```
[Coding Plan Pro] ██░░░░░░░░ 20% │ 5h:0% (─) │ 7d:1% (2.3d) │ 月:3% (6.9d)
```

### 其他后端 / 自定义额外字段

对于未列出的后端，或需要显示自定义文本时，可设置 `CC_HUD_EXTRA_FILE` 环境变量指向一个文件，文件的第一行即为要显示的文本。该文件在每次 HUD tick 时同步读取——保持内容轻量。

```json
// ~/.claude/settings.json
{
  "env": {
    "CC_HUD_EXTRA_FILE": "C:/Users/yourname/.claude/hud/extra.txt"
  }
}
```

> [!IMPORTANT]
> **Windows 用户：** 始终使用**正斜杠**（`C:/Users/...`）或**转义反斜杠**（`C:\\Users\\...`）。原始反斜杠 `C:\Users\...` 会导致 Node.js `\0` 空字节截断，文件会静默无法读取。

额外字段出现在状态栏右侧，上下文条之后：

```
[Sonnet 4.6] ██░░░░░░░░ 20% (1M) │ 5h:7% (1.7h) │ 7d:25% (2.8d) │ 月:39% (8.8d)
```

**参考实现：**

| 脚本 | 用途 |
| --- | --- |
| [`scripts/ds-balance-cache.sh`](scripts/ds-balance-cache.sh) | 查询 DeepSeek 余额，缓存到 `CC_HUD_EXTRA_FILE` 目标 |

<br/>

## 个性化

### 主题

设置 `CC_HUD_THEME` 切换配色方案：

| 值 | 调色板 |
|-------|---------|
| `catppuccin`（默认）| Catppuccin Mocha — 绿 / 黄 / 桃 / 红 |
| `dracula` | Dracula — 绿 / 黄 / 橙 / 红 |
| `nord` | Nord — 极光绿 / 黄 / 橙 / 红 |

```json
// ~/.claude/settings.json
{
  "env": {
    "CC_HUD_THEME": "dracula"
  }
}
```

### 紧凑模式

设置 `CC_HUD_COMPACT=1` 仅显示模型名和上下文进度条——适合窄终端或极简布局：

```json
// ~/.claude/settings.json
{
  "env": {
    "CC_HUD_COMPACT": "1"
  }
}
```

输出简化为：`[Sonnet 4.6] ██░░░░░░░░ 20%`

<br/>

## 开发

```bash
npm install
npm run build        # 编译 TypeScript → dist/
npm test             # 181 个测试 (node:test)
```

项目结构：

| 路径 | 说明 |
| --- | --- |
| `src/` | TypeScript 源码 — 入口、渲染、模型美化、DeepSeek / MiniMax / GLM / OpenCode Go / Qwen / Moonshot / Groq / 百炼 |
| `scripts/launcher.cjs` | 稳定路径启动器（`/cc-hud:setup` 复制到 `~/.claude/bin/`）|
| `commands/setup.md` | `/cc-hud:setup` 斜杠命令 |
| `tests/` | `node:test` 单元测试 |
| `dist/` | 编译产物，已提交 |

<br/>

## 致谢

cc-hud 最初由 [Water](https://github.com/WaterTian)（[WaterTian/cc-hud](https://github.com/WaterTian/cc-hud)）创建。本仓库是独立维护的 fork，包含持续开发和新增功能。

<br/>

## Star 历史

<a href="https://star-history.com/#wyouwd1/cc-hud&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=wyouwd1/cc-hud&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=wyouwd1/cc-hud&type=Date" />
    <img alt="Star 历史图" src="https://api.star-history.com/svg?repos=wyouwd1/cc-hud&type=Date" width="700" />
  </picture>
</a>

<br/>

---

<p align="center">
  <sub>MIT License &copy; <a href="https://github.com/wyouwd1">熊崽</a></sub>
</p>
