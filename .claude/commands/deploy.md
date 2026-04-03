# /deploy

验证代码状态，准备部署。

## Execution

1. 运行 `pnpm format:lint` — 格式化和 lint
2. 运行 `pnpm build:frontend` — 构建前端
3. 运行 `git status` — 检查未提交变更
4. 列出需要提交的变更摘要
5. 提示用户是否需要自动 commit（使用 Conventional Commits 格式）
