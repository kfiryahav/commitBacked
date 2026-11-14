#!/usr/bin/env node
// Calibration: how many carousels would pass the rule, per window and per creator?
// Run BEFORE scheduling. One carousel per day needs ~30 passing per month.
//
//   node carousel-agent/scripts/calibrate.mjs [--config path] [--handles a,b]
//        [--min-likes 1000] [--min-comments 150] [--multiple 3]
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadCreators } from './lib/load.mjs';
import { evaluateAll, summarizeRejections } from './lib/select.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const config = await loadConfig(arg('config', resolve(root, 'config/profiles.json')));
const cfg = {
  ...config.thresholds,
  ...(arg('min-likes') && { min_likes: Number(arg('min-likes')) }),
  ...(arg('min-comments') && { min_comments: Number(arg('min-comments')) }),
  ...(arg('multiple') && { outlier_multiple: Number(arg('multiple')) }),
};
const handles = arg('handles') ? arg('handles').split(',') : undefined;

const { creators, errors, calls } = await loadCreators(config, { handles });
const nowSec = Math.floor(Date.now() / 1000);

console.log(`Thresholds: likes>=${cfg.min_likes} OR comments>=${cfg.min_comments}, and >= ${cfg.outlier_multiple}x own median`);
console.log(`Profiles fetched: ${creators.length}, errors: ${errors.length}, API calls: ${calls}\n`);
for (const e of errors) console.log(`  ! @${e.handle}: ${e.error}`);

const maxWindow = Math.max(...cfg.windows_days);
console.log('Window   passing   per 30 days');
for (const w of cfg.windows_days) {
  const pass = evaluateAll(creators, cfg, { nowSec, windowDays: w }).filter((r) => r.pass).length;
  console.log(`${String(w).padStart(4)}d   ${String(pass).padStart(7)}   ${(pass * 30 / w).toFixed(1).padStart(10)}`);
}

const rows = evaluateAll(creators, cfg, { nowSec, windowDays: maxWindow });
const perCreator = {};
for (const r of rows) {
  perCreator[r.handle] ||= { carousels: 0, passing: 0 };
  perCreator[r.handle].carousels += 1;
  if (r.pass) perCreator[r.handle].passing += 1;
}
console.log(`\nPer creator (last ${maxWindow} days):`);
for (const [h, s] of Object.entries(perCreator).sort((a, b) => b[1].passing - a[1].passing)) {
  console.log(`  @${h.padEnd(24)} carousels=${String(s.carousels).padStart(3)}  passing=${s.passing}`);
}

// Near misses: failed on exactly one reason (excluding window/dup), useful for tuning.
const near = rows
  .filter((r) => !r.pass && r.reasons.length === 1 && !['outside_window', 'already_used'].includes(r.reasons[0]))
  .sort((a, b) => (b.post.likes || 0) - (a.post.likes || 0))
  .slice(0, 8);
console.log('\nNear misses (failed one condition):');
for (const r of near) {
  console.log(`  @${r.handle} likes=${r.post.likes} comments=${r.post.comments} -> ${r.reasons[0]}  ${r.post.url}`);
}
console.log('\nRejection reasons:', JSON.stringify(summarizeRejections(rows)));
