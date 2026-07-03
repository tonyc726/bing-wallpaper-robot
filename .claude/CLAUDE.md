# .claude/CLAUDE.md — Project-Specific Context

> This file supplements the root `CLAUDE.md` with current-state information that changes frequently.

## 🤝 AI 协作文档区(必读 · 每次会话优先查阅)

**在开始任何工作前,先读 [`docs/ai/README.md`](../docs/ai/README.md)** —— 那里有进度看板、决策记录与会话交接,能让你无缝接上未完成的工作,不必从零重建上下文。

协作四规则:

1. **开场先看板**:进入会话先读 `docs/ai/README.md` 的进度看板,了解整体进度、阻塞点与待办项。
2. **推进即更新**:完成或变更某项时,同步更新看板状态(✅/⏳/⏸️/🔴)。
3. **收尾留交接**:会话结束时,在 `docs/ai/sessions/` 追加一篇当日交接(决策脉络 + 已完成 + 下一步)。
4. **构建安全 & 公开部署**:`docs/ai/` 不受 `pnpm run build` 影响(`scripts/copy-build.mjs` 只清理白名单,非白名单目录原样保留),可放心写入;但它会随站点一并公开部署,**切勿在其中写入任何密钥或敏感凭证**。

---

## Current Development State (2026-04-03)

- **v3.1+** — React + Vite frontend with nuqs URL state management
- **Architecture split**: `crawler/` (Python image analysis) + `website/` (React frontend) + root (Node.js TypeORM backend)
- **No test framework** currently configured — all verification is manual via dev server + browser

## Critical File Quick Reference

| Task | Files |
| --- | --- |
| Add wallpaper field | `crawler/database.ts`, entity in `crawler/models/`, migration |
| Change image analysis | `crawler/*.py` scripts |
| Modify frontend UI | `website/src/components/`, `website/src/App.tsx` |
| Change data pipeline | `crawler/index.ts`, `crawler/makePreviewJSON.ts` |
| Frontend theme | `website/src/theme/index.ts` |
| URL state/params | `crawler/utils/add-or-update-wallpaper.ts`, `website/` |

## Common Commands Cheat Sheet

```bash
# Python
cd crawler && uv sync                          # Install deps
uv run python getImageHash.py <path>           # Test hash script
uv run ruff check . ; uv run ruff format .     # Lint + format

# Frontend
pnpm dev                                       # Dev server (localhost:3000)
pnpm build:frontend                            # Build website
pnpm build:data                                # Generate JSON from DB

# Backend / Full pipeline
pnpm start                                     # Fetch + build (full pipeline)
pnpm fetch-data                                # Fetch Bing data only

# Code quality
pnpm format:lint                               # Format + lint all
pnpm format:check                              # Check only
```

## Known Issues / TODOs

- No automated test suite
- Python scripts lack unit tests
