# ToDo: 阿里云百炼 Coding Plan 额度适配

## Phase 1: 核心模块

- [ ] **T1** — 新建 `src/bailian.ts`（~80 行，含 isBailian/aggregatePlan/fetchQuota/getBailianQuota）

## Phase 2: 集成与渲染

- [ ] **T2** — 集成到 `src/index.ts`（~10 行，Promise.all + 优先级链）
- [ ] **T3** — 验证渲染倒计时兼容性

## Phase 3: 测试

- [ ] **T4** — 编写单元测试 `tests/bailian.test.ts`（~180 行，隔离/解析/降级/缓存）
- [ ] **T5** — 完整测试套件验证（`npm test`）

## Phase 4: 文档

- [ ] **T6** — 更新 README + commands/setup.md
