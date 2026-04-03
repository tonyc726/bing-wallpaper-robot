# /test-python

验证爬虫 Python 脚本环境是否正常。

## Execution

1. 确认 `uv` 可用: `which uv`
2. 确认依赖已安装: `cd crawler && uv sync`
3. 找一张测试图片，运行各脚本验证输出:
   - `uv run python crawler/getImageHash.py <test_image>`
   - `uv run python crawler/dominantColor.py <test_image>`
   - `uv run python crawler/computeColorHist.py <test_image>`
   - `uv run python crawler/ssim-compare.py <image_a> <image_b>`
4. 检查 stdout 格式是否符合预期（单行可解析值，无错误信息）
5. Ruff 检查: `cd crawler && uv run ruff check . && uv run ruff format --check .`
