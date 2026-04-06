# .claude/CLAUDE.md — Project-Specific Context

> This file supplements the root `CLAUDE.md` with current-state information that changes frequently.

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
