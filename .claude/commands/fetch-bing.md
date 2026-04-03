# /fetch-bing

手动拉取 Bing 壁纸数据并更新本地。

## Execution

1. `pnpm fetch-data` — 从 Bing API 抓取当日数据（8 个地区）
2. `pnpm build:data` — 从数据库生成 JSON 数据
3. `pnpm build:copy` — 复制前端构建到 `docs/` 并保留 thumbs/
4. 检查 `docs/` 输出，确认新壁纸已入库
5. 如有异常，查看 `logs/` 或终端错误输出
