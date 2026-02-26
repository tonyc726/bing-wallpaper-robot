import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('website/dist');
const destDir = path.resolve('docs');

console.log('Copying build from', srcDir, 'to', destDir);

if (!fs.existsSync(srcDir)) {
  console.error('❌ Frontend build not found. Run pnpm run build:frontend first.');
  process.exit(1);
}

// 复制文件
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
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

try {
  // 清空 docs 目录（除了 thumbs 等其他文件）
  if (fs.existsSync(destDir)) {
    const files = fs.readdirSync(destDir);
    for (const file of files) {
      if (file !== 'thumbs' && !fs.statSync(path.join(destDir, file)).isDirectory()) {
        fs.unlinkSync(path.join(destDir, file));
      }
    }
  }

  copyRecursive(srcDir, destDir);
  console.log('✅ Build successfully copied to docs/');
  console.log(`   Total files copied: ${fs.readdirSync(destDir, { recursive: true }).length}`);
} catch (error) {
  console.error('❌ Error copying build:', error);
  process.exit(1);
}
