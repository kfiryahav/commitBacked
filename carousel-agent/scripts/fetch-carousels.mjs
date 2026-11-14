#!/usr/bin/env node
// Step 2 of the daily run: fetch every profile, apply the selection rule, write out/candidates.json.
//
//   node carousel-agent/scripts/fetch-carousels.mjs [--config path] [--seen out/seen.json]
//                                                   [--out out/candidates.json] [--handles a,b]
//
// seen.json is a JSON array of post ids/codes already used (the agent copies it from Drive first).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadCreators } from './lib/load.mjs';
import { selectCarousel } from './lib/select.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const configPath = arg('config', resolve(root, 'config/profiles.json'));
const seenPath = arg('seen', resolve(root, 'out/seen.json'));
const outPath = arg('out', resolve(root, 'out/candidates.json'));
const handles = arg('handles') ? arg('handles').split(',') : undefined;

async function readSeen(path) {
  try {
    return new Set(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return new Set();
  }
}

const config = await loadConfig(configPath);
if ((handles || config.profiles).length === 0) {
  console.error('No profiles configured. Add handles to carousel-agent/config/profiles.json.');
  process.exit(2);
}

const seen = await readSeen(seenPath);
const { creators, errors, calls } = await loadCreators(config, { handles });
const nowSec = Math.floor(Date.now() / 1000);
const result = selectCarousel({ creators, seen, cfg: config.thresholds, nowSec });

const slim = (r) =>
  r && {
    handle: r.handle,
    url: r.post.url,
    id: r.post.id,
    code: r.post.code,
    likes: r.post.likes,
    comments: r.post.comments,
    slideCount: r.post.slideCount,
    takenAt: r.post.takenAt,
    caption: r.post.caption,
    slideUrls: r.post.slideUrls,
    ratio_vs_own_median: r.ratio && Number(r.ratio.toFixed(2)),
    metric: r.metric,
    flags: r.flags,
    baseline: r.baseline,
  };

const out = {
  generated_at: new Date(nowSec * 1000).toISOString(),
  window_days: result.window_days,
  widened: result.widened,
  passing_count: result.passing_count,
  considered_carousels: result.considered_carousels,
  pick: slim(result.pick),
  backups: result.backups.map(slim),
  rejection_reasons: result.rejection_reasons || null,
  profiles_ok: creators.map((c) => ({ handle: c.handle, posts: c.posts.length })),
  profile_errors: errors,
  api_calls: calls,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(out, null, 2));

if (!out.pick) {
  console.log(`NO_PICK: nothing passed the rule up to ${out.window_days} days. Reasons: ${JSON.stringify(out.rejection_reasons)}`);
} else {
  console.log(
    `PICK: @${out.pick.handle} ${out.pick.url} likes=${out.pick.likes} comments=${out.pick.comments} ` +
      `x${out.pick.ratio_vs_own_median} vs own median (window ${out.window_days}d, ${out.passing_count} passing)`,
  );
}
if (errors.length) console.log(`PROFILE_ERRORS: ${errors.map((e) => `@${e.handle}: ${e.error}`).join(' | ')}`);
console.log(`Wrote ${outPath}`);
// Exit non-zero only when every profile failed (e.g. bad key / out of credits).
process.exit(creators.length === 0 ? 3 : 0);
