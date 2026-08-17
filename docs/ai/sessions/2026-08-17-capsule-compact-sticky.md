# 会话交接:工具栏吸顶收缩 + 移动端 mini 形态(2026-08-17)

> 分支:`feat/wordmark-loading-animation`(在字标动画分支上继续)

## 需求脉络

用户提出工具栏(灵动胶囊)两点诉求:

1. **滚动吸顶**:页面下滚时工具栏需要动画效果达到「吸顶」;
2. **移动端 mini 形态**:默认迷你,聚焦操作时切换为完全状态。

经确认选择了「**收缩为迷你胶囊吸顶**」+「**移动端点击搜索图标展开**」方案,二者合并为一个统一的紧凑态(compact)实现。

## 关键发现:sticky 早已失效

排查中发现一个**存量 bug**:`App.tsx` 的 `<main>` 容器设置了 `overflowX: 'hidden'`,这会创建新的滚动容器上下文,导致内部**所有** `position: sticky` 失效——不仅工具栏胶囊从未真正吸顶,连 MonthSection 的月份标题吸顶(方案 B)也同样失效。

**修复**:`overflowX: 'hidden'` → `overflowX: 'clip'`(`clip` 只裁剪不创建滚动容器,出血水印的横向裁切效果不变;Safari 16+/Chrome 90+ 均支持)。

## 实现要点(全部在 `WallpaperGrid.tsx`,另有 `App.tsx` 一行)

- **统一紧凑态**:`isCompact = !isSearchExpanded && !localSearch && (isMobile || isScrolledCompact)`
  - 桌面端:下滚 >200px 且未在搜索 → 收缩为迷你 pill(🔍 + 排序图标,不透明,吸顶);上滚/点击 → 展开
  - 移动端:默认即 mini;点击展开为全宽完整态并自动聚焦;失焦且无搜索词 → 收回
- **动画(方案 A:纯 transform 交叉切换)**:mini/full 是**两个独立的 Paper 胶囊**(共享 `capsuleVisualSx` 玻璃材质),`AnimatePresence mode="popLayout"` 下各自只做 `opacity + scale`(离场 0.85 / 入场 1.04,`transformOrigin: center top`,spring 500/40/0.8)。**刻意不做尺寸 layout 补间** —— 初版用 `layout` 补间尺寸时,100px 圆角被非等比拉伸成"融化的椭圆"(变形),纯 transform 走 GPU 合成器,数学上不可能变形,性能也最好。移除了旧的「scale 0.75 + opacity 0.25 睡眠态」和 Ghost 唤醒遮罩层
- **聚焦时序坑**:compact 时 input 未挂载,`expandCapsule` 与 ⌘K 快捷键的 `focus()` 都必须包 `requestAnimationFrame`,否则聚焦落空
- 紧凑态可访问性:`role="button"` + `aria-label="展开搜索工具栏"` + `tabIndex` + Enter/Space 键盘激活
- 搜索防抖/IME 组合输入保护、URL 同步等逻辑未动

## ⚠️ 渲染死循环事故与根因分析

**现象**:滚动时 `[Perf] groupedData` 日志以 ~5Hz 持续刷屏,标签页最终崩溃。

**根因(四层)**:

1. **直接机制**:hover 唤醒 ⇄ 滚动收缩两个处理器互写同一 `isScrolledCompact` 状态。用户下滚 + 光标停在顶部中央(胶囊位置)时,两者以动画频率互相覆盖。
2. **控制论视角**:无阻尼正反馈回路 —— 状态变化改变胶囊几何,几何变化让浏览器对静止光标重新派发 hover 事件,回路无冷却/迟滞/优先级。
3. **结构根因**:多个事件源(scroll/hover/focus/click)各自凭局部信息直接写同一布尔值,无唯一裁决点;「正在滚动」强意图与「光标恰好在场」弱信号权重相同。
4. **为何现在才爆**:旧代码同样存在 hover⇄滚动互写,但旧睡眠态只是原地 opacity 渐变,每次振荡代价低、不可见;改 AnimatePresence remount 后每次振荡代价被放大几十倍,隐藏的振荡变成可见死循环。**教训:降低翻转代价是掩盖问题,不是解决问题。**

**修复(根因层)**:删除 hover 唤醒,唤醒路径收敛为「上滚 / 点击 / ⌘K」三条强意图路径(参照 Safari/Chrome 智能隐藏栏:从不用 hover 唤醒)。

**性能加固**:`visibleWallpapers = sortedWallpapers.slice(...)` 原非 memo,每次渲染产生新数组引用导致下游 `groupedData` useMemo 永远失效、每次渲染全量重算分组;已用 useMemo 包裹,依赖 `[sortedWallpapers, visibleCount]`。

## 已验证(Playwright 真实鼠标 + Chrome DevTools 实测)

- ✅ 原死循环场景(光标悬停顶部 + 15 次滚轮下滚):**0 次状态翻转,仅 2 次渲染**,稳定保持 compact
- ✅ 悬停不唤醒;上滚展开;点击展开并聚焦;静止 3s 零渲染泄漏
- ✅ 移动端:默认 mini → 点击展开全宽(0.9 视口宽)并聚焦 → 失焦收回 → 滚动无振荡
- ✅ `pnpm run build` 通过

## 下一步 / 注意

- 改动未提交,与字标动画同分支,可一并或单独 commit
- `overflowX: clip` 的修复顺带激活了月份标题的吸顶效果,部署后线上视觉会有(正向)变化
