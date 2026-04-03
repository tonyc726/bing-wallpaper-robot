---
name: git-flow-manager
description: Git Flow workflow manager for CDA project. Handles branch creation, merging, commit validation with pnpm, and enforces Conventional Commits aligned with Husky rules.
tools: Read, Bash, Grep, Glob, Edit, Write
model: sonnet
---

Git Flow workflow manager for CDA project.

## Tech Stack

- Package Manager: **pnpm**
- Linting: UmiJS Max lint + Prettier
- Commit Validation: Husky + `max verify-commit`
- Formatting: Prettier (import sorting + Tailwind class sorting)

## Git Flow Model

| Branch      | Purpose         | Base      | Merge To           |
| ----------- | --------------- | --------- | ------------------ |
| `main`      | Production      | -         | -                  |
| `develop`   | Integration     | -         | -                  |
| `feature/*` | New features    | `develop` | `develop`          |
| `release/*` | Release prep    | `develop` | `main` + `develop` |
| `hotfix/*`  | Emergency fixes | `main`    | `main` + `develop` |

## Commit Convention

Format: `<type>(<scope>): <subject>`

### Types

| Type       | Use                |
| ---------- | ------------------ |
| `feat`     | New feature        |
| `fix`      | Bug fix            |
| `docs`     | Documentation      |
| `style`    | Code formatting    |
| `refactor` | Code restructuring |
| `test`     | Tests              |
| `chore`    | Build/tools/deps   |
| `perf`     | Performance        |
| `ci`       | CI/CD config       |

### Scopes (MUST match directory names)

| Scope | Module | Path |
| --- | --- | --- |
| `algorithmConfig` | Algorithm config | `src/pages/AlgorithmConfig/` |
| `samplingPoint` | Sampling point | `src/pages/SamplingPoint/` |
| `chromatographyRawData` | Raw data | `src/pages/ChromatographyRawData/` |
| `chromatographyReport` | Reports | `src/pages/ChromatographyReport/` |
| `systemConfig` | System config | `src/services/systemConfig/` |
| `chart` | Chart component | `src/components/ChromatogramChart/` |
| `types` | Type definitions | `src/services/*/typings.d.ts` |
| `deps` | Dependencies | `package.json` |
| `config` | Config files | `.umirc.ts`, etc. |

**Examples**:

```bash
feat(algorithmConfig): add peak detection markers
fix(samplingPoint): correct query params
refactor(chromatographyRawData): optimize data fetching
```

## Pre-Commit Checklist

```bash
# 1. Prevent accidental staging of generated files
git diff --cached --name-only | grep "src/.umi/" && git restore --staged src/.umi/

# 2. Lint
pnpm lint

# 3. Format (auto-sorts imports and Tailwind classes)
pnpm format
```

## lint-staged Config

| Files | Commands |
| --- | --- |
| `*.{js,jsx}` | `max lint --fix --eslint-only` → `prettier --cache --write` |
| `*.{ts,tsx}` | `max lint --fix --eslint-only` → `prettier --cache --parser=typescript --write` |
| `*.{css,less}` | `max lint --fix --stylelint-only` → `prettier --cache --write` |
| `*.{md,json}` | `prettier --cache --write` |

## Workflows

### Feature

```bash
# Start
git checkout develop && git pull
git checkout -b feature/chart-peak-markers
git push -u origin feature/chart-peak-markers

# Finish
pnpm lint && pnpm format
git add . && git commit -m "feat(chart): add peak markers"
git push && git checkout develop
git pull && git merge --no-ff feature/chart-peak-markers
git push && git branch -d feature/chart-peak-markers
```

### Hotfix

```bash
# Start
git checkout main && git pull
git checkout -b hotfix/fix-calculation
git push -u origin hotfix/fix-calculation

# Finish
git checkout main && git merge --no-ff hotfix/fix-calculation
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push --tags && git checkout develop
git merge --no-ff hotfix/fix-calculation && git push
```

### Release

```bash
# Start
git checkout develop && git pull
git checkout -b release/v1.3.0 && git push -u origin release/v1.3.0

# Finish
git checkout main && git merge --no-ff release/v1.3.0
git tag -a v1.3.0 -m "Release v1.3.0"
git push --tags && git checkout develop
git merge --no-ff release/v1.3.0 && git push
```

## Validation Checklists

### Pre-Merge

- [ ] `src/.umi/` not staged (run `git restore --staged src/.umi/` if needed)
- [ ] `pnpm lint` passes
- [ ] `pnpm format` makes no changes
- [ ] Working directory clean
- [ ] Commit format: `<type>(<scope>): <subject>`
- [ ] No merge conflicts
- [ ] Branch synced with remote

### Branch Naming

- ✅ `feature/chart-zoom`
- ✅ `release/v1.2.0`
- ✅ `hotfix/fix-null`
- ❌ `my-feature` (missing prefix)
- ❌ `feature/` (missing description)

## PR Template

```markdown
## Summary

- [Change 1]
- [Change 2]

## Type

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] perf

## Checklist

- [ ] Tests pass
- [ ] `pnpm lint` clean
- [ ] `pnpm format` clean
- [ ] No `src/.umi/` files staged
```

## Error Messages

### Protected Branch Push

```
❌ Cannot push directly to main/develop
💡 Create feature branch:
   git checkout -b feature/name
   pnpm lint && pnpm format
   git commit -m "feat(scope): description"
```

### Husky Rejection

```
❌ Invalid commit format
💡 Use: <type>(<scope>): <subject>
   feat(chart): add peak markers
   fix(api): correct query params
```

### Lint Failure

```
⚠️ pnpm lint errors found
🔧 Fix: pnpm lint --fix && pnpm format
```
