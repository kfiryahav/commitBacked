#!/usr/bin/env node
// Step 1 of the daily run: fetch the profiles, apply the selection rule, write out/candidates.json.
//
//   node carousel-agent/scripts/fetch-carousels.mjs [--config path] [--seen out/seen.json]
//                                                   [--out out/candidates.json] [--handles a,b]
//
// seen.json is a JSON array of post ids/codes already used (the agent copies it from Drive first).
// Credits: each page of posts costs one ScrapeCreators credit, so feeds are paged lazily and the
// time window is widened (30 -> 60 -> 90 days) only when nothing passed yet.
import './lib/ensure-proxy.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadFeeds } from './lib/load.mjs';
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
const nowSec = Math.floor(Date.now() / 1000);
const windows = config.thresholds.windows_days;

const feeds = new Map();
let loaded = { creators: [], errors: [], calls: 0 };
let result = null;
for (const w of windows) {
  loaded = await loadFeeds(config, { handles, untilDays: w, nowSec, feeds });
  if (loaded.creators.length === 0) break; // every profile failed: widening cannot help
  result = selectCarousel({ creators: loaded.creators, seen, cfg: { ...config.thresholds, windows_days: [w] }, nowSec });
  result.widened = w !== windows[0];
  if (result.pick) break;
}

const followersOf = (handle) => loaded.creators.find((c) => c.handle === handle)?.followers ?? null;
const slim = (r) =>
  r && {
    handle: r.handle,
    followers: followersOf(r.handle),
    url: r.post.url,
    id: r.post.id,
    code: r.post.code,
    likes: r.post.likes,
    comments: r.post.comments,
    slideCount: r.post.slideCount,
    slideKinds: r.post.slideKinds,
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
  window_days: result?.window_days ?? null,
  widened: result?.widened ?? false,
  passing_count: result?.passing_count ?? 0,
  considered_carousels: result?.considered_carousels ?? 0,
  pick: slim(result?.pick),
  backups: (result?.backups || []).map(slim),
  rejection_reasons: result?.rejection_reasons || null,
  profiles_ok: loaded.creators.map((c) => ({
    handle: c.handle,
    followers: c.followers,
    posts: c.posts.length,
    calls: c.calls,
    exhausted: c.exhausted,
    pages: c.pages,
  })),
  profile_errors: loaded.errors,
  api_calls: loaded.calls,
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
if (loaded.errors.length) console.log(`PROFILE_ERRORS: ${loaded.errors.map((e) => `@${e.handle}: ${e.error}`).join(' | ')}`);
console.log(`API calls (credits): ${out.api_calls}. Wrote ${outPath}`);
// Exit non-zero only when every profile failed (e.g. bad key / out of credits).
process.exit(loaded.creators.length === 0 ? 3 : 0);
