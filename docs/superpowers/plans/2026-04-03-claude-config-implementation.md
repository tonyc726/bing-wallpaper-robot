# Claude Code Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all CDA-project artifacts with bing-wallpaper-robot-specific configuration, add real hooks, clean MCP, and finalize templates.

**Architecture:** Delete 3 mismatched agents, rewrite 2 agents + 1 kept (python-dev), add settings.json with executable hooks, add command index, add react-component template, clean MCP servers.

**Tech Stack:** Claude Code agents, hooks via settings.json, MCP server management, TypeScript/Python/React templates

---

### Task 1: Delete CDA project agents

**Files:**
- Delete: `.claude/agents/frontend-developer.md`
- Delete: `.claude/agents/typescript-pro.md`
- Delete: `.claude/agents/git-flow-manager.md`

```bash
rm .claude/agents/frontend-developer.md .claude/agents/typescript-pro.md .claude/agents/git-flow-manager.md
```

- [ ] **Step 1: Delete 3 CDA agent files**
- [ ] **Step 2: Commit**

```bash
git add -A .claude/agents/
git commit -m "chore(claude code): 删除 CDA 项目遗留 agents"
```

---

### Task 2: Rewrite typescript-dev.md

**Files:**
- Create: `.claude/agents/typescript-dev.md`

```markdown
---
name: typescript-dev
description: TypeScript specialist for bing-wallpaper-robot crawler. Enforces strict typing, no `any`, TypeORM patterns, pnpm workflows, and ESLint/Prettier compliance.
tools: Read, Write, Edit, Bash
model: sonnet
---

TypeScript specialist for bing-wallpaper-robot crawler pipeline.

## Tech Stack

| Category | Technology |
| --- | --- |
| Package Manager | **pnpm** v9+ |
| Runtime | Node.js 22+ via ts-node |
| ORM | TypeORM 0.3 + SQLite3 |
| Linting | ESLint 8 + alloy config |
| Formatting | Prettier 3 |
| Target | ES6, CommonJS modules |
| Decorators | Enabled (TypeORM requirement) |

## Code Conventions

### Type Conventions

| Scenario | Use | Example |
| --- | --- | --- |
| Object structures | `interface` | `interface Wallpaper { id: string }` |
| Unions | `type` | `type Region = 'cn' | 'us' | 'jp'` |
| Function types | `type` | `type ProcessFn = (path: string) => Promise<void>` |

No `any` — use `unknown` with type guards.

### Naming

| Category | Convention | Example |
| --- | --- | --- |
| Types/Interfaces | PascalCase | `Wallpaper`, `AnalyticsRecord` |
| Variables/Functions | camelCase | `fetchWallpaper`, `uploadToImageKit` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_REGIONS` |
| Boolean props | is/has/can prefix | `isNew`, `hasSimilar` |

### Directory Structure

```
crawler/
├── index.ts                  # Entry point (fetch pipeline)
├── makePreviewJSON.ts        # JSON data generator
├── database.ts               # TypeORM DataSource config
├── models/
│   ├── entities/
│   │   ├── Wallpaper.ts      # Main entity (UUID PK)
│   │   ├── Analytics.ts      # Image analysis (hash, color)
│   │   └── Imagekit.ts       # CDN metadata
│   └── migrations/           # TypeORM migrations
├── utils/
│   ├── exec-python.ts         # Python script wrapper
│   ├── is-similar-image.ts    # Hamming distance dedup
│   ├── upload-to-imagekit.ts  # ImageKit SDK integration
│   ├── download-image.ts      # HTTP image downloader
│   └── transform-filename-*.ts
├── types/                     # TypeScript type definitions
└── tyorm-run-migration.ts     # Migration runner
```

### TypeORM Patterns

```typescript
// Entity pattern
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity()
export class Wallpaper {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  filename!: string;

  @Column({ type: 'datetime' })
  date!: Date;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

// Repository pattern — use injection
const wallpaperRepo = dataSource.getRepository(Wallpaper);
const wallpaper = await wallpaperRepo.findOne({ where: { id } });
```

### Migration Workflow

```bash
# Generate migration after entity changes
pnpm run migration:generate -- MigrationName

# Run migration
pnpm run migration:run

# Revert if needed
pnpm run migration:revert

# Custom runner (project-specific)
pnpm run run-migration
```

### Error Handling

```typescript
// Retry with fallback
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastError;
}
```

### No Magic Numbers

```typescript
// ✅ Correct
const MAX_RETRY_COUNT = 5;
const THUMBNAIL_SIZE = 256;
const REGIONS = ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'it-IT', 'es-ES'] as const;

// ❌ Wrong: hardcoded
for (let i = 0; i < 5; i++) { }
const url = `https://...256x256...`;
```

## Checklist

- [ ] No `any`, use `unknown` with type guards
- [ ] PascalCase for types, camelCase for variables/functions
- [ ] Extract magic numbers as constants
- [ ] TypeORM: decorators enabled, `!:` for non-null properties
- [ ] Error handling with retry logic for network operations
- [ ] Follow existing patterns in `crawler/`
```

- [ ] **Step 1: Write typescript-dev.md**
- [ ] **Step 2: Commit**

```bash
git add .claude/agents/typescript-dev.md
git commit -m "feat(claude code): 新增 typescript-dev agent（crawler/ TS 规范）"
```

---

### Task 3: Rewrite frontend-dev.md

**Files:**
- Create: `.claude/agents/frontend-dev.md`

```markdown
---
name: frontend-dev
description: Frontend specialist for bing-wallpaper-robot. Expert in Vite 5.x, React 18, TypeScript 5.x, MUI 5.x, nuqs URL state, and framer-motion animations.
tools: Read, Write, Edit, Bash
model: sonnet
---

Frontend specialist for bing-wallpaper-robot website.

## Tech Stack

| Category | Technology |
| --- | --- |
| Build Tool | **Vite 5.x** |
| Framework | **React 18.2+** |
| Language | **TypeScript 5.3+** (strict) |
| UI Library | **MUI 5.x** (@mui/material) |
| Styling | **@emotion/react + @emotion/styled** |
| URL State | **nuqs 2.x** (search params) |
| Animation | **framer-motion 12.x** |
| PWA | **vite-plugin-pwa + workbox** |

## Project Structure

```
website/
├── src/
│   ├── App.tsx                 # Main application (NuqsAdapter)
│   ├── main.tsx                # Entry point
│   ├── components/
│   │   ├── WallpaperCard.tsx    # Individual wallpaper card
│   │   ├── WallpaperGrid.tsx    # Masonry grid with search/filter
│   │   └── ImageDialog.tsx      # Full-screen preview
│   ├── theme/
│   │   └── index.ts             # MUI theme configuration
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── public/
│   └── wallpapers.json          # Static data (generated by makePreviewJSON.ts)
├── vite.config.ts               # Vite build config (port 3000)
└── package.json
```

## URL State Management (nuqs)

```typescript
import { useQueryState } from 'nuqs';

// Search: ?q=关键词
const [search, setSearch] = useQueryState('q', { defaultValue: '' });

// Sort: ?sort=date-desc (date-asc, date-desc, color, title)
const [sort, setSort] = useQueryState('sort', { defaultValue: 'date-desc' });

// Year filter: ?year=2025 (all, 2024, 2023...)
const [year, setYear] = useQueryState('year', { defaultValue: 'all' });
```

URL state is shareable — filters are preserved in bookmarks and shared links.

## MUI Patterns

```typescript
// Component with MUI styling
import { Box, Card, CardMedia, Typography, useTheme } from '@mui/material';
import { createUseStyles } from 'react-jss';

const useStyles = createUseStyles(() => ({
  card: {
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: theme.shadows[8],
    },
  },
}));

export const WallpaperCard: React.FC<WallpaperCardProps> = ({ wallpaper }) => {
  const classes = useStyles();
  const theme = useTheme();

  return (
    <Card className={classes.card}>
      <CardMedia
        component="img"
        image={wallpaper.thumbnailUrl}
        alt={wallpaper.title}
      />
      <Typography variant="subtitle1">{wallpaper.title}</Typography>
    </Card>
  );
};
```

## Framer Motion Patterns

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Card entrance animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ duration: 0.3 }}
>
  {children}
</motion.div>
```

## PWA Configuration

- Uses `navigateFallbackDenylist` to exclude chunks and index.json
- Avoids Service Worker intercepting navigation to API routes
- Dynamic import paths use `new URL('./chunks/xxx.js', window.location.href).href`

## Checklist

- [ ] No `any`, strict TypeScript
- [ ] URL state via nuqs (shareable links)
- [ ] MUI components over custom CSS
- [ ] Framer motion for animations (not CSS keyframes)
- [ ] PWA navigation rules correct (no index.html fallback for chunks)
- [ ] Dynamic import paths resolve correctly in all deployments
```

- [ ] **Step 1: Write frontend-dev.md**
- [ ] **Step 2: Commit**

```bash
git add .claude/agents/frontend-dev.md
git commit -m "feat(claude code): 新增 frontend-dev agent（website/ 前端规范）"
```

---

### Task 4: Create settings.json with hooks

**Files:**
- Create: `.claude/settings.json`

```json
{
  "hooks": {
    "pre-commit": {
      "commands": [
        "pnpm format:check",
        "pnpm lint"
      ]
    },
    "post-startup": {
      "commands": [
        "test -d node_modules || echo 'WARNING: Run pnpm install'",
        "which uv || echo 'WARNING: uv not found — required for Python crawler scripts'",
        "test -d crawler/.venv || echo 'WARNING: Run cd crawler && uv sync'"
      ]
    }
  }
}
```

- [ ] **Step 1: Write settings.json**
- [ ] **Step 2: Commit**

```bash
git add .claude/settings.json
git commit -m "feat(claude code): 添加 hooks 配置（pre-commit + post-startup）"
```

---

### Task 5: Add command index and react-component template

**Files:**
- Create: `.claude/commands/_index.md`
- Create: `.claude/templates/react-component.tsx`

**_index.md content:**

```markdown
# Slash Commands Index

| Command | Purpose | Key Files |
| --- | --- | --- |
| `/deploy` | 验证代码 + 准备提交 | 全项目 |
| `/fetch-bing` | 手动拉取 Bing 壁纸数据 | crawler/index.ts |
| `/test-python` | 验证 Python 脚本环境 | crawler/*.py |
| `/new-wallpaper` | 新增壁纸字段到数据流程 | crawler/models/, crawler/makePreviewJSON.ts, website/ |
```

**react-component.tsx content:**

```typescript
/**
 * @module ComponentName
 * @category Component
 * @description Brief description of what this component does
 */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import type { Wallpaper } from '../types';

export interface ComponentNameProps {
  /** Wallpaper data to display */
  wallpaper: Wallpaper;
  /** Click handler for preview */
  onPreview?: (id: string) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Description of the component
 */
export const ComponentName: React.FC<ComponentNameProps> = ({
  wallpaper,
  onPreview,
  isLoading = false,
}) => {
  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <Box
        sx={{ cursor: 'pointer' }}
        onClick={() => onPreview?.(wallpaper.id)}
      >
        <img
          src={wallpaper.thumbnailUrl}
          alt={wallpaper.title}
          loading="lazy"
        />
        <Typography variant="caption">{wallpaper.title}</Typography>
      </Box>
    </motion.div>
  );
};
```

- [ ] **Step 1: Write command index**
- [ ] **Step 2: Write react component template**
- [ ] **Step 3: Commit**

```bash
git add .claude/commands/_index.md .claude/templates/react-component.tsx
git commit -m "feat(claude code): 新增命令索引和 React 组件模板"
```

---

### Task 6: Clean MCP servers

**Files:**
- Modify: `.claude/settings.local.json` — remove `"Ant Design Components"` from `enabledMcpjsonServers`

Current:
```json
"enabledMcpjsonServers": [
  "context7",
  "sequential-thinking",
  "playwright",
  "chrome-devtools",
  "Ant Design Components"
]
```

Replace with:
```json
"enabledMcpjsonServers": [
  "context7",
  "sequential-thinking",
  "playwright",
  "chrome-devtools"
]
```

- [ ] **Step 1: Edit settings.local.json to remove Ant Design**
- [ ] **Step 2: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore(claude code): 移除未使用的 Ant Design MCP 服务器"
```

---

### Task 7: Final verification and commit

- [ ] **Step 1: Verify file structure**

Run:
```bash
find .claude/ -type f | sort
```

Expected:
```
.claude/CLAUDE.md
.claude/agents/frontend-dev.md
.claude/agents/python-dev.md
.claude/agents/typescript-dev.md
.claude/commands/_index.md
.claude/commands/deploy.md
.claude/commands/fetch-bing.md
.claude/commands/new-wallpaper.md
.claude/commands/test-python.md
.claude/hooks/post-startup.md
.claude/hooks/pre-commit.md
.claude/settings.json
.claude/settings.local.json
.claude/templates/python-script.py
.claude/templates/react-component.tsx
.claude/templates/typeorm-entity.ts
```

- [ ] **Step 2: Verify no CDA references remain**

```bash
grep -r "chromatogram\|ChromatogramChart\|UmiJS\|CDA\|low-code" .claude/ 2>/dev/null
```

Expected: No matches

- [ ] **Step 3: Final status check**

```bash
git status
```

- [ ] **Step 4: Final commit if any remaining changes**

---

## Spec Coverage Check

| Spec Requirement | Covered By Task |
| --- | --- |
| Delete 3 CDA agents | Task 1 |
| Rewrite typescript-dev.md | Task 2 |
| Rewrite frontend-dev.md | Task 3 |
| Add settings.json with hooks | Task 4 |
| Add command index | Task 5 |
| Add react-component template | Task 5 |
| Clean MCP servers | Task 6 |
| Final verification | Task 7 |

## Type Consistency Check

All types referenced across tasks are self-contained within each agent file. No cross-file type dependencies in the plan.
