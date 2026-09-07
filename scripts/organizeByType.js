#!/usr/bin/env node
/**
 * organizeByType.js
 *
 * Organizes a messy folder by moving files into sub-folders named after
 * their file type (Images, Documents, Videos, Audio, Archives, Code, Others).
 *
 * Usage:
 *   node scripts/organizeByType.js <folderPath> [--recursive] [--dry-run]
 *
 * Options:
 *   --recursive  Also organize files inside sub-folders of the target
 *                folder (sub-folders that are not themselves category
 *                folders created by this script).
 *   --dry-run    Only print what would happen, without moving any files.
 *
 * Example:
 *   node scripts/organizeByType.js ~/Downloads
 *   node scripts/organizeByType.js ~/Downloads --recursive --dry-run
 */

const fs = require('fs');
const path = require('path');

// Category name -> list of file extensions (without the dot, lowercase)
const CATEGORIES = {
  Images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'tif', 'heic', 'heif', 'ico', 'raw'],
  Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'md'],
  Videos: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  Code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'html', 'css', 'json', 'sh', 'rb', 'go', 'php'],
};

const CATEGORY_NAMES = new Set([...Object.keys(CATEGORIES), 'Others']);

// Build a fast extension -> category lookup.
const EXT_TO_CATEGORY = {};
for (const [category, extensions] of Object.entries(CATEGORIES)) {
  for (const ext of extensions) {
    EXT_TO_CATEGORY[ext] = category;
  }
}

function categoryForFile(fileName) {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (!ext) return 'Others';
  return EXT_TO_CATEGORY[ext] || 'Others';
}

function uniqueDestination(destDir, fileName) {
  let candidate = path.join(destDir, fileName);
  if (!fs.existsSync(candidate)) return candidate;

  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${base} (${counter})${ext}`);
    counter += 1;
  }
  return candidate;
}

function organizeFolder(targetDir, { recursive = false, dryRun = false } = {}) {
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error(`הנתיב שסופק אינו תיקייה קיימת: ${targetDir}`);
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const moves = [];

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      // Skip the category folders this script itself manages, so re-running
      // it is safe (idempotent) and we never move a category folder into
      // another category folder.
      if (CATEGORY_NAMES.has(entry.name)) continue;

      if (recursive) {
        moves.push(...organizeFolder(fullPath, { recursive, dryRun }));
      }
      continue;
    }

    if (!entry.isFile()) continue;
    // Skip hidden files (e.g. .DS_Store, .gitkeep)
    if (entry.name.startsWith('.')) continue;

    const category = categoryForFile(entry.name);
    const destDir = path.join(targetDir, category);
    const destPath = uniqueDestination(destDir, entry.name);

    if (!dryRun) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(fullPath, destPath);
    }

    moves.push({ from: fullPath, to: destPath, category });
  }

  return moves;
}

function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const recursive = args.includes('--recursive');
  const dryRun = args.includes('--dry-run');

  if (positional.length === 0) {
    console.error('שימוש: node scripts/organizeByType.js <folderPath> [--recursive] [--dry-run]');
    process.exit(1);
  }

  const targetDir = path.resolve(positional[0]);

  try {
    const moves = organizeFolder(targetDir, { recursive, dryRun });

    if (moves.length === 0) {
      console.log('לא נמצאו קבצים למיון בתיקייה שצוינה.');
      return;
    }

    const summary = {};
    for (const move of moves) {
      summary[move.category] = (summary[move.category] || 0) + 1;
      const arrow = dryRun ? '(יועבר)' : '->';
      console.log(`${move.from} ${arrow} ${move.to}`);
    }

    console.log('\nסיכום:');
    for (const [category, count] of Object.entries(summary)) {
      console.log(`  ${category}: ${count} קבצים`);
    }

    if (dryRun) {
      console.log('\n(הרצת תצוגה מקדימה בלבד - לא הועבר אף קובץ. הריצו בלי --dry-run כדי לבצע בפועל.)');
    }
  } catch (err) {
    console.error(`שגיאה: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { organizeFolder, categoryForFile };
