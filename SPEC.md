# Spec: cc-hud 独立维护方案

## Objective

接管 cc-hud 的独立维护。原作者（Water/WaterTian）已停止维护，需要：

1. **审计仓库全貌** — 所有分支、提交、标签、贡献者
2. **清理分支结构** — 合并有价值的特性分支，删除临时分支
3. **建立自主维护管线** — 脱离上游，独立发布版本
4. **为未来上架插件市场做准备**

## 审计结果

### 远程仓库

| 远程 | URL | 角色 |
|------|-----|------|
| `origin` | `git@github.com:wyouwd1/cc-hud.git` | 主仓库（后续迁移到组织账号） |
| ~~`upstream`~~ | ~~`https://github.com/WaterTian/cc-hud.git`~~ | ❌ 完全解绑 |

### 分支一览

| 分支 | 基于 | 超前/落后 | 说明 |
|------|------|-----------|------|
| `main` | `v0.5.1` | = `upstream/main` | 与上游同步 |
| `feat/opencode-quota` | `v0.5.1` +4 commits | 超前 main 4 commits | OpenCode 订阅配额显示（核心特性） |
| `docs/cc-hud-extra-file-windows` | `v0.5.1` | 已合并入 feat/opencode-quota | Windows 路径文档 |

### 标签（17 个）

从 `v0.1.0` 到 `v0.5.1`，覆盖整个发布历史。所有标签均在 `main` 上。

### 贡献者

| 作者 | 邮箱 | 角色 |
|------|------|------|
| Water | changewater@qq.com | 原作者（已停止维护） |
| wyoud1 | wyoud1@qq.com | 你的另一个账号 |
| 熊崽 | wyoud1@qq.com | 你本人 |

### 特性分支的核心变更

`feat/opencode-quota` vs `main`（+409 / -51 行，9 个文件）：

```
新增: src/opencode.ts     — OpenCode Go 订阅配额采集
新增: dist/opencode.js    — 编译产物
修改: src/index.ts        — 集成 OpenCode 数据流
修改: src/render.ts       — 渲染 OpenCode 配额信息
修改: src/types.ts        — 类型扩展
修改: dist/index.js       — 编译产物
修改: dist/render.js      — 编译产物
修改: README.md           — 文档
修改: package-lock.json   — 依赖锁
```

## 方案

### 1. 分支清理策略

| 操作 | 分支 | 理由 |
|------|------|------|
| **合并 → 删除** | `feat/opencode-quota` → `main` | 核心特性，值得合入主线 |
| **合并 → 删除** | `docs/cc-hud-extra-file-windows` → `main` | 文档，已合并入 feat 分支 |
| **保留** | `main` | 稳定发布线 |
| **可选删除** | `origin/feat/opencode-quota`、`origin/docs/cc-hud-extra-file-windows` | 远程清理 |
| **删除** | `upstream/main` | 完全解绑 |

### 2. 版本策略

脱离上游后，版本号从 `v0.6.0` 起跳（基于 v0.5.1 + OpenCode 特性）：

```
v0.6.0  — 合并 OpenCode 配额显示 + 分支清理
v0.6.x  — 后续 bug 修复
v0.7.0  — 新特性
v1.0.0  — 稳定版（上架市场条件成熟时）
```

### 3. 发布流程

```
开发 → 版本 bump → 编译 → 打 tag → GitHub Releases → （未来）插件市场
```

- 不再往 `upstream` 提交 PR
- `origin/main` 作为唯一 truth source
- 每个版本打 annotated tag + GitHub Release

### 4. 插件市场

目前 cc-hud 已在 Claude Code 插件市场注册（有 `marketplace.json`），可被 `claude plugins:install cc-hud` 发现。后续上架需确保：

- `marketplace.json` / `plugin.json` 中的 `owner` 字段改为你的 GitHub 账号
- 更新 `repository` URL 指向你的 fork
- 在 Claude Code 插件市场提交审核

## Commands

```bash
# 审计
git log --all --oneline --graph --decorate
git branch -a
git tag -l

# 合并特性分支
git checkout main
git merge feat/opencode-quota

# 版本发布
npm version 0.6.0 -m "chore: bump to v%s — OpenCode quota display"
git push origin main --tags

# 构建
npm run build        # tsc 编译
npm test             # node --test
```

## Project Structure

```
.                      # 保持现有结构不变
├── src/               # TypeScript 源码
├── dist/              # 编译产物（提交到仓库）
├── .claude-plugin/    # 插件清单
├── commands/          # setup 文档
├── scripts/           # launcher
└── tests/             # 测试
```

## Code Style

保持现有风格不变（见 `CLAUDE.md`）：
- TypeScript strict mode
- ESM + ES2022
- 零外部依赖
- Catppuccin Mocha 配色
- 不可变数据模式
- 中文注释，英文代码

## Testing Strategy

- `node --test` 内置测试运行器
- 现有 render / model / mmx / glm / launcher 测试
- 为 OpenCode 新增对应测试
- 保持 80%+ 覆盖率

## Boundaries

### Always
- 合入 main 前必须通过 `npm test`
- 版本发布必须打 annotated tag
- 每个版本写 CHANGELOG / Release Notes
- 编译 `dist/` 提交到仓库（保持与插件市场兼容）

### Ask first
- 引入外部依赖
- 修改插件清单结构
- 删除上游保留的参考分支

### Never
- 往 `upstream` 提交任何内容（已完全解绑）
- 删除 Git 历史（rebase、force push 到 main）
- 提交未编译的版本

## Success Criteria

- [ ] `feat/opencode-quota` 合入 `main` 并删除特性分支
- [ ] 远程临时分支清理完毕
- [ ] 发布第一个独立版本 `v0.6.0`
- [ ] GitHub Releases 可用
- [ ] 所有现有测试通过
- [ ] OpenCode 配额显示有对应测试覆盖
- [ ] `plugin.json` 的 owner 更新为你
- [ ] `CHANGELOG.md` 已建立（Keep a Changelog 格式）
- [ ] 仓库已迁移到组织账号
- [ ] `upstream` remote 已删除
