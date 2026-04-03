# post-startup Hook

Trigger: 新会话启动时。

## Execution

1. 检查 `.env` 是否存在 — 缺少则提醒配置 IMAGEKIT_\* 变量
2. 检查 `uv` 是否可用: `which uv`
3. 检查 Python 依赖: `cd crawler && uv sync`
4. 检查 Node 依赖: 确认 `node_modules/` 存在
5. 如果任一缺失，提醒用户运行 `pnpm install` 和 `cd crawler && uv sync`
