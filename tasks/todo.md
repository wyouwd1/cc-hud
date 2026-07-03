# ToDo: 阿里云百炼 Coding Plan 额度适配 ✅ 全部完成

## Phase 1: 核心模块

- [x] **T1** — 新建 `src/bailian.ts`（含 isBailian/aggregatePlan/fetchQuota/getBailianQuota）

## Phase 2: 集成与渲染

- [x] **T2** — 集成到 `src/index.ts`（Promise.all + 优先级链）
- [x] **T3** — 验证渲染倒计时兼容性（render.ts 已支持 `mo` 段，无需改动）

## Phase 3: 测试

- [x] **T4** — 编写单元测试 `tests/bailian.test.ts`（17 个测试，隔离/解析/降级/缓存）
- [x] **T5** — 完整测试套件验证（`npm test` — 181 个测试全部通过）

## Phase 4: 文档

- [x] **T6** — 更新 README（百炼表格行 + 环境变量说明 + 输出示例）
