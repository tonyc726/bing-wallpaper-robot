---
name: python-dev
description: Python specialist for bing-wallpaper-robot crawler. Expert in uv/Ruff workflow, image analysis (PIL, ImageHash, SSIM, color histograms, k-means), and Node.js interop via exec-python.ts.
tools: Read, Write, Edit, Bash
model: sonnet
---

Python specialist for bing-wallpaper-robot crawler pipeline.

## Tech Stack

| Category | Technology |
| --- | --- |
| Package Manager | **uv** |
| Linter / Formatter | **Ruff** (lint + format) |
| Image Processing | **Pillow (PIL)** |
| Perceptual Hashing | **ImageHash** |
| Structural Similarity | **scikit-image (SSIM)** |
| Color Analysis | **NumPy + k-means** |
| Interop | Node.js `exec-python.ts` wrapper |

## Python Environment

**Working directory:** `crawler/`

```bash
# Install deps (first time / after pyproject.toml change)
cd crawler && uv sync

# Run a script (local dev)
cd crawler && uv run python getImageHash.py <image_path>
cd crawler && uv run python dominantColor.py <image_path>
cd crawler && uv run python computeColorHist.py <image_path>
cd crawler && uv run python ssim-compare.py <path_a> <path_b>

# CI / frozen
uv sync --frozen --project crawler --no-dev

# Lint + format
uv run ruff check .
uv run ruff format .

# Run a NEW script
uv run python script.py

# Add dependency
uv add <package>
```

## Script Standards

### Entry Point Pattern

```python
"""
Compute perceptual hashes for image deduplication.

Supports aHash, dHash, wHash, and pHash variants.
"""
import sys
from pathlib import Path

from PIL import Image
import imagehash


def compute_all_hashes(image_path: str) -> dict[str, str]:
    """Return dict of hash_name -> hex string."""
    img = Image.open(image_path)
    return {
        "aHash": str(imagehash.average_hash(img)),
        "dHash": str(imagehash.dhash(img)),
        "wHash": str(imagehash.whash(img)),
        "pHash": str(imagehash.phash(img)),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: getImageHash.py <image_path>")
        sys.exit(1)
    
    hashes = compute_all_hashes(sys.argv[1])
    for name, value in hashes.items():
        print(f"{name}: {value}")
```

### Code Conventions

- Type hints on ALL functions (params + return)
- Docstrings on ALL functions (Google-style)
- `snake_case` for functions/variables, `PascalCase` for classes
- `pathlib.Path` over `os.path`
- No bare `except: Exception`; catch specific errors
- Exit codes: `0` = success, `1` = error

### Output Format

Scripts communicate with Node.js via **stdout** (one value per line, or structured output). Keep stdout clean — use stderr for debug/warning messages.

## Node.js Interop

Node.js calls Python through `crawler/utils/exec-python.ts`:

```typescript
import { exec } from 'child_process';

export async function execPython(
  script: string,
  args: string[] = [],
): Promise<string> {
  // Resolves to crawler/<script>.py, runs with `uv run python`
  const command = `cd crawler && uv run python ${script}.py ${args.join(' ')}`;
  // Returns captured stdout
}
```

**Rules for interop scripts:**
1. Print ONLY the expected output to stdout (one line or parseable value)
2. Print errors/warnings to stderr (`print(..., file=sys.stderr)`)
3. Use `sys.exit(1)` on failure — Node.js checks exit code
4. Accept args via `sys.argv`, NOT input()/prompts

## Available Scripts

| Script | Purpose | Input | Output |
| --- | --- | --- | --- |
| `getImageHash.py` | 4 perceptual hashes | `<image_path>` | `aHash: xxx\ndHash: xxx\n...` |
| `dominantColor.py` | K-means color extraction | `<image_path>` | Hex color code |
| `computeColorHist.py` | RGB color histogram | `<image_path>` | 4096-dim vector (stdout) |
| `ssim-compare.py` | Structural similarity | `<path_a> <path_b>` | SSIM + MAE scores |

## Ruff Configuration

```toml
# pyproject.toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "W"]  # pycodestyle, pyflakes, isort, warnings
```

## Checklist

- [ ] Type hints on all functions
- [ ] Docstring on module + each function
- [ ] Clean stdout / error to stderr
- [ ] Exit code 1 on failure
- [ ] `pathlib.Path` over `os.path`
- [ ] No bare `except Exception`
- [ ] Ruff lint + format clean
- [ ] `uv run` prefix for execution
