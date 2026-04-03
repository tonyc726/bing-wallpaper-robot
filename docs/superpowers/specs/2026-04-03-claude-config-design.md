# Design Document: Claude Code Configuration for bing-wallpaper-robot

**Date:** 2026-04-03
**Status:** Draft

## Context

项目 `.claude/` 配置存在 3 个严重问题：
1. 3 个 agents 是 CDA（色谱分析）项目遗留，与当前项目完全不匹配
2. hooks 是纯文档，无真实可执行配置
3. MCP 服务器列表包含未使用的 Ant Design（当前项目用 MUI）

## Architecture

### Agents (3 total, by directory responsibility)

| Agent | Scope | Key Tech |
| --- | --- | --- |
| typescript-dev | `crawler/**/*.ts` | TypeORM, SQLite, pnpm, ESLint, Prettier |
| frontend-dev | `website/` | Vite + MUI + React 18 + nuqs + framer-motion |
| python-dev | `crawler/*.py` | uv + Ruff + Pillow/ImageHash/scikit-image |

Each agent file contains:
- Frontmatter: name, description, tools (minimal), model
- Project-specific patterns (not generic knowledge)
- Code templates and naming conventions
- Checklist for code review

### Hooks (2 hooks via settings.json)

| Hook | Commands | Purpose |
| --- | --- | --- |
| pre-commit | `pnpm format:check` + `pnpm lint` | 防止提交格式错误代码 |
| post-startup | 检查 `node_modules/` + `uv` | 提醒缺失环境依赖 |

Configuration lives in `.claude/settings.json`, committed to git for team sharing.
Sensitive config (API keys, model selection) stays in `.settings.local.json`, git-ignored.

### Commands (4 + 1 index)

| Command | Purpose |
| --- | --- |
| /deploy | 验证代码 + 准备提交 |
| /fetch-bing | 手动拉取 Bing 数据 |
| /test-python | 验证 Python 环境 |
| /new-wallpaper | 新增壁纸字段流程 |
| _index.md | 所有命令速查索引 |

### MCP Servers (cleanup)

Remove: Ant Design Components (project uses MUI, not Ant Design)
Keep: context7, playwright, chrome-devtools, sequential-thinking

### Templates (3 total)

- `python-script.py` — Python 脚本模板
- `typeorm-entity.ts` — TypeORM Entity 模板
- `react-component.tsx` — React 组件模板（新增）

## Implementation Order

1. Delete 3 CDA agents
2. Rewrite typescript-dev.md
3. Rewrite frontend-dev.md
4. Add react-component.tsx template
5. Add command _index.md
6. Create .claude/settings.json with hooks
7. Clean up hooks docs (remove "executable" claims)
8. Update .gitignore for settings.json (or remove if should be committed)
9. Clean up MCP servers (remove Ant Design)

## Verification

- `find .claude/ -type f` — 所有文件存在且内容匹配项目
- Hook 执行测试 — 手动模拟 pre-commit 流程
- MCP 清理后确认不报错
