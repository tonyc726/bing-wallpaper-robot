# pre-commit Hook

Trigger: Before committing changes.

## Execution

1. 检查是否有 `src/.umi/` 或 `node_modules/` 被暂存 — 如果有，提醒 `git restore --staged`
2. 运行 `pnpm format:check` — 确认代码格式正确
3. 提醒使用 Conventional Commits: `type(scope): subject`
   - `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `perf` / `ci`
   - scope 示例: `crawler`, `website`, `database`, `deps`, `config`
