/**
 * 全局索引算法测试脚本
 * 直接运行: node test-algorithms.js
 */

// 模拟 indexData
// monthList 按从新到旧排序（最新在前）
const mockIndexData = {
  totalWallpapers: 153,  // 31 + 30 + 30 + 31 + 31 = 153
  lastModified: '2025-11-11T00:00:00Z',
  monthList: ['2025-11', '2025-10', '2025-09', '2025-08', '2025-07'],  // 从新到旧
  chunks: {
    '2025-11': { recordCount: 31 },  // 最新
    '2025-10': { recordCount: 30 },
    '2025-09': { recordCount: 30 },
    '2025-08': { recordCount: 31 },
    '2025-07': { recordCount: 31 }   // 最旧
  }
};

/**
 * 构建全局索引表
 */
function buildGlobalIndex(indexData) {
  const index = {};
  let globalPos = 0;

  // 按照 monthList 的顺序遍历（从新到旧）
  for (const month of indexData.monthList) {
    const metadata = indexData.chunks[month];
    if (!metadata) continue;

    const recordCount = metadata.recordCount;

    for (let localPos = 0; localPos < recordCount; localPos++) {
      const wallpaperId = `${month}-${String(localPos).padStart(3, '0')}`;

      index[wallpaperId] = {
        month,
        globalIndex: globalPos,
        localIndex: localPos
      };
      globalPos++;
    }
  }

  return index;
}

/**
 * 计算加载范围
 */
function calculateLoadRange(lastWallpaperId, itemsPerPage, globalIndex, indexData) {
  const lastInfo = globalIndex[lastWallpaperId];
  if (!lastInfo) {
    console.error(`[Error] Wallpaper ID not found: ${lastWallpaperId}`);
    return { targetMonths: [], needsDownload: [] };
  }

  const startGlobalIndex = lastInfo.globalIndex + 1;
  const endGlobalIndex = startGlobalIndex + itemsPerPage - 1;

  console.log(`[calculateLoadRange] Range: ${startGlobalIndex} - ${endGlobalIndex}`);

  const targetMonths = [];

  // 遍历所有壁纸ID，找到在范围内的壁纸
  const rangeByMonth = new Map();

  for (const [wallpaperId, info] of Object.entries(globalIndex)) {
    const idx = info.globalIndex;

    // 检查是否在加载范围内
    if (idx >= startGlobalIndex && idx <= endGlobalIndex) {
      const month = info.month;
      const existing = rangeByMonth.get(month);

      if (existing) {
        existing.min = Math.min(existing.min, info.localIndex);
        existing.max = Math.max(existing.max, info.localIndex);
      } else {
        rangeByMonth.set(month, { min: info.localIndex, max: info.localIndex });
      }
    }
  }

  // 构建结果
  for (const [month, range] of rangeByMonth) {
    const startOffset = range.min;
    const endOffset = range.max;
    const count = endOffset - startOffset + 1;

    targetMonths.push({
      month,
      startOffset,
      endOffset,
      count
    });

    console.log(`[calculateLoadRange] Month ${month}: offset ${startOffset}-${endOffset}, count ${count}`);
  }

  // 按monthList的顺序排序
  targetMonths.sort((a, b) => {
    const aIndex = indexData.monthList.indexOf(a.month);
    const bIndex = indexData.monthList.indexOf(b.month);
    return aIndex - bIndex;
  });

  return { targetMonths, needsDownload: [] };
}

// ==================== 测试函数 ====================

function testBuildGlobalIndex() {
  console.log('\n=== 测试: buildGlobalIndex ===');

  const index = buildGlobalIndex(mockIndexData);

  // 验证索引数量
  const indexCount = Object.keys(index).length;
  console.log(`索引数量: ${indexCount} / 预期: 153`);
  console.assert(indexCount === 153, '❌ 索引数量不正确');

  // 验证第一个壁纸（最新：2025-11-000）
  const first = index['2025-11-000'];
  console.log('第一个壁纸 (2025-11-000):', first);
  console.assert(first.month === '2025-11', '❌ 月份不正确');
  console.assert(first.globalIndex === 0, '❌ 全局索引不正确');
  console.assert(first.localIndex === 0, '❌ 本地索引不正确');

  // 验证中间壁纸（2025-10-015）
  const middle = index['2025-10-015'];
  console.log('中间壁纸 (2025-10-015):', middle);
  console.assert(middle.globalIndex === 46, '❌ 中间索引计算错误'); // 2025-11的31张 + 2025-10的15张

  // 验证最后一个壁纸（最旧：2025-07-030）
  const last = index['2025-07-030'];
  console.log('最后一个壁纸 (2025-07-030):', last);
  console.assert(last.globalIndex === 152, '❌ 最后索引计算错误'); // 153张，索引从0开始

  console.log('✅ buildGlobalIndex 测试通过\n');
  return true;
}

function testCalculateLoadRange() {
  console.log('\n=== 测试: calculateLoadRange ===');

  const index = buildGlobalIndex(mockIndexData);

  // 测试1: 跨月场景（从2025-09最后一张开始）
  console.log('\n--- 测试1: 跨月场景 (2025-09-029 → 加载24张) ---');
  const result1 = calculateLoadRange('2025-09-029', 24, index, mockIndexData);

  console.log('结果数量:', result1.targetMonths.length);

  // 2025-09-029是最后一张，globalIndex 90
  // 加载24张：91-114，都在2025-08内
  const result1Month1 = result1.targetMonths[0];
  console.assert(result1Month1.month === '2025-08', '❌ 应该是2025-08');
  console.assert(result1Month1.startOffset === 0, '❌ 起始位置错误');
  console.assert(result1Month1.endOffset === 23, '❌ 结束位置错误');
  console.assert(result1Month1.count === 24, '❌ 数量错误');

  const total1 = result1.targetMonths.reduce((sum, m) => sum + m.count, 0);
  console.assert(total1 === 24, '❌ 总数应该是24');

  // 测试2: 单月场景
  console.log('\n--- 测试2: 单月场景 (2025-09-005 → 加载10张) ---');
  const result2 = calculateLoadRange('2025-09-005', 10, index, mockIndexData);

  console.assert(result2.targetMonths.length === 1, '❌ 应该在同一个月内');
  console.assert(result2.targetMonths[0].month === '2025-09', '❌ 应该是2025-09');
  console.assert(result2.targetMonths[0].startOffset === 6, '❌ 起始位置错误 (从6开始)');
  console.assert(result2.targetMonths[0].endOffset === 15, '❌ 结束位置错误 (到15结束，共10张)');
  console.assert(result2.targetMonths[0].count === 10, '❌ 应该加载10张');

  // 测试3: 边界情况（跨月）
  console.log('\n--- 测试3: 边界情况 (2025-11-029 → 加载2张) ---');
  const result3 = calculateLoadRange('2025-11-029', 2, index, mockIndexData);

  console.assert(result3.targetMonths.length === 2, '❌ 应该跨2个月（2025-11最后1张 + 2025-10第1张）');

  const result3Month1 = result3.targetMonths[0];
  console.assert(result3Month1.month === '2025-11', '❌ 第一个月应该是2025-11');
  console.assert(result3Month1.startOffset === 30, '❌ 起始位置错误');
  console.assert(result3Month1.endOffset === 30, '❌ 结束位置错误');
  console.assert(result3Month1.count === 1, '❌ 第一段数量错误');

  const result3Month2 = result3.targetMonths[1];
  console.assert(result3Month2.month === '2025-10', '❌ 第二个月应该是2025-10');
  console.assert(result3Month2.startOffset === 0, '❌ 起始位置错误');
  console.assert(result3Month2.endOffset === 0, '❌ 结束位置错误');
  console.assert(result3Month2.count === 1, '❌ 第二段数量错误');

  // 测试4: 无效ID
  console.log('\n--- 测试4: 无效ID处理 ---');
  const result4 = calculateLoadRange('invalid-id', 24, index, mockIndexData);
  console.assert(result4.targetMonths.length === 0, '❌ 无效ID应返回空数组');

  console.log('✅ calculateLoadRange 测试通过\n');
  return true;
}

function testPerformance() {
  console.log('\n=== 性能测试 ===');

  // 构建大数据集
  const largeIndexData = {
    totalWallpapers: 1000,
    monthList: Array.from({ length: 34 }, (_, i) => `2023-${String(12 - i).padStart(2, '0')}`),
    chunks: Object.fromEntries(
      Array.from({ length: 34 }, (_, i) => [
        `2023-${String(12 - i).padStart(2, '0')}`,
        { recordCount: 30 }
      ])
    )
  };

  // 测试构建性能
  const start = performance.now();
  const index = buildGlobalIndex(largeIndexData);
  const buildTime = performance.now() - start;

  console.log(`构建1000条索引耗时: ${buildTime.toFixed(2)}ms`);
  console.assert(buildTime < 10, '❌ 构建时间应该小于10ms');

  // 测试查询性能
  const queryStart = performance.now();
  for (let i = 0; i < 100; i++) {
    calculateLoadRange('2023-01-015', 24, index, largeIndexData);
  }
  const queryTime = performance.now() - queryStart;

  console.log(`100次查询耗时: ${queryTime.toFixed(2)}ms`);
  console.assert(queryTime < 100, '❌ 查询时间应该小于100ms');

  console.log('✅ 性能测试通过\n');
  return true;
}

// ==================== 运行测试 ====================

function runAllTests() {
  console.log('╔════════════════════════════════════╗');
  console.log('║   全局索引算法测试套件 v3.0+       ║');
  console.log('╚════════════════════════════════════╝');

  let passed = 0;
  let failed = 0;

  try {
    if (testBuildGlobalIndex()) passed++;
  } catch (error) {
    console.error('❌ buildGlobalIndex 测试失败:', error);
    failed++;
  }

  try {
    if (testCalculateLoadRange()) passed++;
  } catch (error) {
    console.error('❌ calculateLoadRange 测试失败:', error);
    failed++;
  }

  try {
    if (testPerformance()) passed++;
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    failed++;
  }

  console.log('\n╔════════════════════════════════════╗');
  console.log('║           测试结果                 ║');
  console.log('╠════════════════════════════════════╣');
  console.log(`║  通过: ${passed}                          ║`);
  console.log(`║  失败: ${failed}                          ║`);
  console.log('╚════════════════════════════════════╝');

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  有测试失败\n');
    process.exit(1);
  }
}

runAllTests();
