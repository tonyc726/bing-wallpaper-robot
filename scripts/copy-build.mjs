import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('website/dist');
const destDir = path.resolve('docs');

// 这些是由爬虫/数据生成脚本维护的目录，构建时不能清除
// website/dist 里不会有这些目录，所以 copyRecursive 也不会覆盖
const PRESERVE_DIRS = new Set(['thumbs', 'chunks']);

// 这些是由爬虫/数据生成脚本维护的文件，构建时不能删除
const PRESERVE_FILES = new Set(['index.json', 'utils.js', 'index.js', 'all.js', '_headers']);

// 这些是 Vite 构建产物目录，每次需要完整清空以避免残留文件
const BUILD_DIRS = new Set(['assets']);

console.log('Copying build from', srcDir, 'to', destDir);

if (!fs.existsSync(srcDir)) {
  console.error('❌ Frontend build not found. Run pnpm run build:frontend first.');
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const destDirPath = path.dirname(dest);
    if (!fs.existsSync(destDirPath)) {
      fs.mkdirSync(destDirPath, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(destDir)) {
    const entries = fs.readdirSync(destDir);
    for (const entry of entries) {
      const fullPath = path.join(destDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (BUILD_DIRS.has(entry)) {
          // 构建产物目录：完整删除，防止旧文件残留（如过期的 assets/chunks/）
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`🗑️  Cleaned build dir: docs/${entry}/`);
        } else if (PRESERVE_DIRS.has(entry)) {
          // 数据目录：保留（由爬虫维护）
          console.log(`⏭️  Preserved data dir: docs/${entry}/`);
        }
        // 其他目录忽略
      } else {
        // 根目录文件：检查是否需要保留
        const fileName = path.basename(fullPath);
        if (PRESERVE_FILES.has(fileName)) {
          console.log(`⏭️  Preserved data file: docs/${fileName}`);
        } else {
          // 删除其他文件（index.html、sw.js 等每次都会重新生成）
          fs.unlinkSync(fullPath);
        }
      }
    }
  }

  copyRecursive(srcDir, destDir);
  console.log('✅ Build successfully copied to docs/');
  console.log(`   Total files: ${fs.readdirSync(destDir, { recursive: true }).length}`);
} catch (error) {
  console.error('❌ Error copying build:', error);
  process.exit(1);
}
