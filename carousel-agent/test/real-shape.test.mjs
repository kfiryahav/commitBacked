// Tests against a trimmed copy of a REAL ScrapeCreators response (captured 2026-11-14).
// Unlike the synthetic fixtures in normalize.test.mjs, this proves the normalizer and the
// selection rule behave correctly on the actual shape of the API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePost, extractItems, extractCursor } from '../scripts/lib/normalize.mjs';
import { DEFAULT_CONFIG, selectCarousel } from '../scripts/lib/select.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const real = JSON.parse(await readFile(resolve(here, 'fixtures/real-posts.json'), 'utf8'));
const posts = extractItems(real).map((r) => normalizePost(r, 'nick_saraev'));
const NOW = Math.max(...posts.map((p) => p.takenAt)) + 3600;

test('real response: envelope, cursor and follower count', () => {
  assert.equal(posts.length, 12);
  assert.equal(extractCursor(real), 'sc:redacted');
  assert.equal(real.user.follower_count, 741730);
});

test('real response: 2 carousels, 10 reels, correct counts and slide data', () => {
  const carousels = posts.filter((p) => p.type === 'carousel');
  assert.equal(carousels.length, 2);
  assert.equal(posts.filter((p) => p.type === 'video').length, 10);

  const c = carousels.find((p) => p.code === 'DfnGcVfDzyG');
  assert.equal(c.likes, 5322);
  assert.equal(c.comments, 6388);
  assert.equal(c.slideCount, 8);
  assert.equal(c.slideUrls.length, 8);
  assert.equal(c.url, 'https://www.instagram.com/p/DfnGcVfDzyG/');
  assert.match(c.caption, /^Comment "FABLE"/);
  // Mixed slides: the real carousel has image AND video slides (video = poster frame only).
  assert.ok(c.slideKinds.includes('image') && c.slideKinds.includes('video'));
  // Picks the >=720px candidate (1440 wide), not the 480px thumbnail.
  assert.match(c.slideUrls[0], /-1440\.jpg$/);
});

test('real response: the rule picks the FABLE carousel as a comment-bait outlier, rejects the other', () => {
  const r = selectCarousel({ creators: [{ handle: 'nick_saraev', posts }], cfg: DEFAULT_CONFIG, nowSec: NOW });
  assert.ok(r.pick, 'expected a pick');
  assert.equal(r.pick.post.code, 'DfnGcVfDzyG');
  assert.deepEqual(r.pick.flags, ['comment_bait']);
  assert.ok(r.pick.ratio > 3 && r.pick.ratio < 3.5, `ratio ${r.pick.ratio}`);
  assert.equal(r.window_days, 30);
  assert.equal(r.backups.length, 0); // the 2,769-like carousel is only ~1.7x his median
});
