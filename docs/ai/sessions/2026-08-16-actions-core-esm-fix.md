# 2026-08-16 会话交接 — 修复 fetch-data CI 崩溃(@actions/core ESM)

## 背景

每日 `fetch-data` GitHub Action 报错崩溃:

```
Error: No "exports" main defined in .../node_modules/@actions/core/package.json
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
```

## 根因

- 提交 `cfd47b0`(chore(deps): upgrade website to Vite 8 + MUI 9 and crawler toolchain)把 `@actions/core` 从 ^1.x 升到 ^3.0.1。
- **@actions/core v3 是纯 ESM 包**:`"type": "module"`,exports 只声明 `import` 条件,没有 `require`/`default` 入口。
- crawler 通过 `ts-node/register` 以 CommonJS 运行(tsconfig 为 CommonJS),`import * as core from '@actions/core'` 编译成 `require()` → 找不到 CJS 入口 → 崩溃。
- 本地 node_modules 残留旧的 1.11.1,所以**只在 CI 复现**(frozen-lockfile 全新安装)。

## 修复(分支 `fix/actions-core-esm-incompat`,PR #6)

- `package.json`:`@actions/core` 锁回 `^1.11.1`(最后支持 CJS 的版本线)。
- crawler 仅用 `setFailed` / `setOutput` / `exportVariable`,v1 完全覆盖。
- 验证:`node --require ts-node/register -e "require('@actions/core')"` 加载正常——与 CI 崩溃同一条 loader 路径。

## 下一步

- 合并 PR #6 后,当晚 18:00 UTC 的定时任务即可验证恢复。
- 若未来想把 crawler 迁移到 ESM(可解锁 @actions/core v3),是独立的大工程,本次不做。

## 经验

- **依赖 major 升级后要检查包模块格式**(CJS → ESM-only 是近年常见 breaking change),`npm view <pkg>@<ver> type exports` 一条命令即可确认。
- 本地旧 node_modules 会掩盖 lockfile 里的新依赖问题——复现 CI 故障时应先 `pnpm install --frozen-lockfile`。
