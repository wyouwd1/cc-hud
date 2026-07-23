# Task List: cc-hud OpenCode 插件兼容

## Phase 0: 事件探查（先摸清 OpenCode 事件结构）

- [ ] **Task 0: 事件 dump 插件**
  - 写一个最小 OpenCode 插件，注册 `event` hook，所有事件 JSON.stringify 后写入文件
  - 在 OpenCode 中实际操作（切模型、发消息、启 agent），dump 出 session.updated / message.updated 等事件的实际 payload
  - **交付物：** 事件 payload 样本文件 + 确认哪些字段可用
  - **范围：** XS（1 file）
  - **依赖：** 无

---

## Phase 1: 基础设施

- [ ] **Task 1: status-writer.ts**
  - 原子写入 `~/.cc-hud-status`：写入临时文件 → rename
  - 失败静默降级
  - **验收：** 调用后文件内容正确，并发写入不产生残缺内容
  - **验证：** `node -e "writeStatusFile('test')" && cat ~/.cc-hud-status`
  - **范围：** XS（1 file, ~20 行）
  - **依赖：** 无

- [ ] **Task 2: config.ts**
  - 读取 `opencode.json` 中 `cc-hud` 节的 theme/compact/statusFile
  - 环境变量（CC_HUD_THEME 等）优先
  - **验收：** opencode.json 有配置时正确读取，无配置时回退到环境变量/默认值
  - **范围：** XS（1 file, ~35 行）
  - **依赖：** 无

---

## Phase 2: 数据采集

- [ ] **Task 3: session.ts**
  - 基于 Task 0 摸清的事件 payload，处理 `session.updated` 和 `session.status` 事件
  - 提取：model ID、token 用量、活跃 agents、effort 级别
  - 调用 `shortModelName()` 美化模型名
  - **验收：** session 事件到达后能正确解析出所有字段
  - **范围：** S（1 file, ~60 行）
  - **依赖：** Task 0

- [ ] **Task 4: message.ts**
  - 从 `message.updated` 事件提取每条消息的 token 计数
  - 累计 input + output tokens → 推算 contextPercent
  - **验收：** 多轮消息后 contextPercent 单调递增，/compact 后重置
  - **范围：** S（1 file, ~40 行）
  - **依赖：** Task 0

- [ ] **Task 5: quota.ts**
  - 调 OpenCode 官方 API 获取 Go 订阅配额（rolling/weekly/monthly usage）
  - 若无 API 则保留现有 HTML scraping 逻辑
  - 复用 `cache.ts` 的 `withCache()` 做缓存
  - 输出 `OpenCodeQuota` 类型
  - **验收：** 返回 `{ rollingPercent, weeklyPercent, monthlyPercent, *ResetsAt }`
  - **范围：** S（1 file, ~40-80 行）
  - **依赖：** 无（独立 API 调用）

---

## Phase 3: 编排

- [ ] **Task 6: adapter.ts**
  - 整合 Task 3/4/5 的数据 → `RenderData`
  - 调用各个 backend 模块（balance/glm/mmx/bailian/qwen/moonshot/groq）
  - `fallback()` 优先级链：事件数据 > 后端 API > null
  - **验收：** `buildRenderData()` 返回完整的 `RenderData`
  - **范围：** M（1 file, ~50 行 + import 多个 backend）
  - **依赖：** Task 3, 4, 5

- [ ] **Task 7: index.ts（插件入口）**
  - 导出 `CcHudPlugin: Plugin`
  - 注册 `event` hook，事件触发 → 采集 → `render()` → 写文件
  - **验收：** OpenCode 中加载插件后，事件触发时 `~/.cc-hud-status` 自动更新
  - **范围：** XS（1 file, ~30 行）
  - **依赖：** Task 1, 2, 6

---

## Phase 4: 兜底与完善

- [ ] **Task 8: sqlite.ts（可选兜底）**
  - 只读查询 `~/.local/share/opencode/` 的 SQLite 数据库
  - 获取会话列表、最新会话数据
  - 只在事件数据不足时触发
  - **验收：** 返回数据格式与 Task 3/4 一致
  - **范围：** S（1 file, ~50 行）
  - **依赖：** 无（独立模块）

---

## Phase 5: 发布与文档

- [ ] **Task 9: 安装配置**
  - `package.json` 的 `files` 中新增 `opencode-plugin/`
  - 提供 opencode.json 配置示例 + tmux status-right 配置说明
  - **验收：** `npm publish` 后能通过 `opencode.json` 的 `plugin` 数组安装
  - **范围：** XS
  - **依赖：** Task 7

- [ ] **Task 10: README 更新**
  - 新增 OpenCode 插件安装章节
  - 注明与 Claude Code 版差异
  - troubleshooting 指南
  - **验收：** README 清晰指导用户在 OpenCode 中安装和使用
  - **范围：** XS
  - **依赖：** Task 9

---

## 检查点

### Checkpoint A（Phase 1 后）
- [ ] status-writer 写入文件正确
- [ ] config 读取 opencode.json 和环境变量均正常

### Checkpoint B（Phase 2 后）
- [ ] 事件 dump 完成，字段确认
- [ ] session 事件解析正确
- [ ] contextPercent 推算逻辑合理
- [ ] 配额数据有返回值

### Checkpoint C（Phase 3 后）
- [ ] 插件加载后 ~/.cc-hud-status 有内容
- [ ] 显示模型名/上下文条/agent/速率限制
- [ ] Claude Code 版不受影响

### Checkpoint D（全部完成后）
- [ ] 全部验收标准满足
- [ ] 文档齐全
