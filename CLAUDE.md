# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bing-wallpaper-robot** is an automated system that:

- Fetches Bing wallpaper data daily via GitHub Actions
- Stores wallpaper metadata in SQLite database using TypeORM
- Uploads images to ImageKit CDN
- Generates a static HTML gallery for preview
- Has been running continuously since 2017, with 2600+ wallpaper records

## Architecture

### Core Flow

```
GitHub Action (scheduled daily)
  ↓
fetch-data → get-multiple-bing-wallpaper-info → add-or-update-wallpaper
  ↓                              ↓
make-html ←──── upload-to-imagekit ←──── download-image
  ↓                              ↓
SQLite DB ←──── python image analysis
```

### Database Schema (TypeORM)

- **Wallpaper**: Primary entity with filename, date, title, copyright, language, etc.
- **Analytics**: One-to-one with Wallpaper - stores aHash, dHash, wHash, pHash, dominantColor
- **Imagekit**: One-to-many with Wallpaper - stores CDN metadata (fileId, dimensions)

### Key Files

**Entry Points:**

- `src/index.ts` - Main data fetching pipeline
- `src/makePreviewHTML.ts` - Generates static HTML gallery from database

**Data Flow:**

- `src/utils/get-multiple-bing-wallpaper-info.ts` - Fetches from Bing API (8 regions)
- `src/utils/add-or-update-wallpaper.ts` - 5-stage pipeline:
  1. Download thumbnail (256px)
  2. Python analysis (hashes + dominant color)
  3. Create Analytics record
  4. Detect similar images + upload to ImageKit (if new)
  5. Create Wallpaper record

**Python Scripts:**

- `src/getImageHash.py` - Computes perceptual hashes (aHash, dHash, wHash, pHash)
- `src/getImageDominantColor.py` - Extracts dominant color

**Utilities:**

- `src/utils/is-similar-image.ts` - Hamming distance comparison for deduplication
- `src/utils/upload-to-imagekit.ts` - ImageKit SDK integration
- `src/utils/download-image.ts` - HTTP image downloader
- `src/utils/transform-filename-*.ts` - Filename/ID transformation helpers

## Development

### Commands

```bash
# Install dependencies (use pnpm instead of npm)
pnpm install

# Run data fetching pipeline (main workflow)
pnpm run fetch-data

# Generate preview HTML
pnpm run make-html

# Run full workflow (fetch + generate HTML)
pnpm start

# TypeORM migrations
pnpm run migration:run        # Run pending migrations
pnpm run migration:revert     # Revert last migration
pnpm run migration:generate   # Generate new migration from schema changes
```

**Note:** This project uses **pnpm** instead of npm for faster installs and disk space efficiency.

### Dependencies

**Runtime:**

- TypeORM + SQLite3 (database)
- EJS (HTML templating)
- ImageKit SDK (CDN)
- Axios/Fetch (HTTP requests)
- date-fns, lodash (utilities)
- file-type (MIME detection)
- Python 3.9+ (for image analysis)

**Development:**

- TypeScript 4.5 (target ES6, CommonJS modules)
- ts-node (TypeScript execution)
- ESLint + alloy config
- Prettier (code formatting)
- **pnpm** v9+ (package manager - faster installs, disk space efficient)

### Python Environment

Python is required for image analysis:

```bash
# Install Python dependencies (for dev only)
pip install -r requirements.txt

# Or using the requirements.txt in root
```

The project executes Python scripts via `src/utils/exec-python.ts` which calls:

- `getImageHash.py` - Computes 4 types of perceptual hashes
- `getImageDominantColor.py` - Extracts dominant color

### Environment Variables

Required in `.env`:

```bash
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
```

GitHub Secrets (for Actions):

- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`
- `ROBOT_TOKEN` (GitHub token for commits)

### Database

**Location:** `database/bing-wallpaper.sqlite`

**Migrations:** `src/models/migrations/`

Run migrations with: `npm run run-migration`

### GitHub Actions Workflow

**File:** `.github/workflows/main.yml`

**Schedule:** Daily at 18:00 UTC

**Flow:**

1. Checkout repository
2. Setup Python 3.9
3. Setup Node.js 22.x
4. Install dependencies (`npm ci`)
5. Run `npm run fetch-data`
6. Run `npm run make-html`
7. Commit changes with auto-generated message
8. Push to `main` branch

## Configuration Files

**ormconfig.json** - TypeORM configuration for SQLite
**tsconfig.json** - TypeScript: ES6 target, CommonJS modules, decorators enabled
**.eslintrc.js** - Alloy TypeScript config + explicit-member-accessibility rule
**.prettierrc.js** - Prettier formatting rules

## Development Notes

- Uses decorators extensively (TypeORM requirement)
- Retry logic built into data fetching (5 attempts max)
- Similar image detection prevents duplicates via hash comparison
- Thumbnails stored in `docs/thumbs/` with ImageKit ID as filename
- Main gallery output: `docs/index.html` (generated daily)
- Python 3.9+ required for image hash computation
- ESLint rule `@typescript-eslint/explicit-member-accessibility` is set to "warn"

## Common Tasks

**Add a new wallpaper field:**

1. Update entity in `src/models/entities/Wallpaper.ts`
2. Generate migration: `pnpm run migration:generate`
3. Update transformation logic in `src/utils/add-or-update-wallpaper.ts`

**Modify HTML output:**

1. Edit template in `src/index.ejs`
2. Adjust data mapping in `src/makePreviewHTML.ts`

**Change Bing API parameters:**

- Modify region indices in `src/utils/get-multiple-bing-wallpaper-info.ts:30`
- Default: 8 regions (0-7)

**Update ImageKit settings:**

- Change upload folder in `src/utils/upload-to-imagekit.ts:34`
- Modify URL transformation rules in ImageKit dashboard
