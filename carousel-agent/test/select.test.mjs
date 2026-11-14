import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  median,
  isCommentBait,
  creatorBaseline,
  evaluateAll,
  selectCarousel,
} from '../scripts/lib/select.mjs';

const NOW = 1_800_000_000;
const DAY = 86400;
const cfg = { ...DEFAULT_CONFIG };

let seq = 0;
function post(over = {}) {
  seq += 1;
  return {
    id: `p${seq}`,
    code: `C${seq}`,
    url: `https://www.instagram.com/p/C${seq}/`,
    handle: 'creator',
    type: 'carousel',
    slideCount: 8,
    slideUrls: [],
    likes: 300,
    comments: 20,
    takenAt: NOW - 5 * DAY,
    caption: 'כיתוב רגיל',
    ...over,
  };
}

// A creator whose last N regular posts have the given likes/comments.
function creator(handle, candidates, { baseLikes = 300, baseComments = 20, n = 10 } = {}) {
  const base = Array.from({ length: n }, (_, i) =>
    post({ handle, type: 'image', slideCount: 1, likes: baseLikes, comments: baseComments, takenAt: NOW - (10 + i) * DAY }),
  );
  return { handle, posts: [...base, ...candidates.map((c) => ({ ...c, handle }))] };
}

function pick(creators, opts = {}) {
  return selectCarousel({ creators, cfg, nowSec: NOW, ...opts });
}

test('median: odd, even, empty, ignores non-numbers', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([null, undefined, 5]), 5);
});

test('isCommentBait: Hebrew and English CTAs, not normal captions', () => {
  assert.equal(isCommentBait('תגיבו GUIDE ואשלח לכם'), true);
  assert.equal(isCommentBait('כתבו בתגובות ואני אכוון אתכם'), true);
  assert.equal(isCommentBait('כתבו "מדריך" בתגובות'), true);
  assert.equal(isCommentBait('Comment GUIDE and I will DM it'), true);
  assert.equal(isCommentBait('שמרו את הפוסט הזה, תזדקקו לו'), false);
  assert.equal(isCommentBait(''), false);
  assert.equal(isCommentBait(undefined), false);
});

test('passes: above floor and >= 3x creator median', () => {
  const c = creator('a', [post({ likes: 1500, comments: 40 })]);
  const r = pick([c]);
  assert.ok(r.pick);
  assert.equal(r.window_days, 30);
  assert.equal(r.pick.ratio, 5);
});

test('fails floor: 900 likes / 100 comments', () => {
  const c = creator('a', [post({ likes: 900, comments: 100 })], { baseLikes: 100 });
  const r = pick([c]);
  assert.equal(r.pick, null);
  assert.ok(r.rejection_reasons.below_floor >= 1);
});

test('fails outlier: 1200 likes but creator median is 600 (2x)', () => {
  const c = creator('a', [post({ likes: 1200 })], { baseLikes: 600 });
  const r = pick([c]);
  assert.equal(r.pick, null);
  assert.ok(r.rejection_reasons.not_outlier >= 1);
});

test('floor can be met by comments alone (no bait)', () => {
  const c = creator('a', [post({ likes: 400, comments: 200 })], { baseLikes: 100 });
  const r = pick([c]);
  assert.ok(r.pick);
  assert.equal(r.pick.ratio, 4);
});

test('hidden likes: falls back to comments vs comment baseline, flagged', () => {
  const ok = creator('a', [post({ likes: null, comments: 300 })], { baseComments: 50 });
  const r1 = pick([ok]);
  assert.ok(r1.pick);
  assert.ok(r1.pick.flags.includes('likes_hidden'));
  assert.equal(r1.pick.metric, 'comments');

  const notOutlier = creator('b', [post({ likes: null, comments: 300 })], { baseComments: 120 });
  assert.equal(pick([notOutlier]).pick, null);
});

test('comment bait: comments do not count, likes floor must be met', () => {
  const baitCaption = 'תגיבו GUIDE ואשלח לכם את המדריך';
  const weak = creator('a', [post({ likes: 500, comments: 400, caption: baitCaption })], { baseLikes: 100 });
  const r1 = pick([weak]);
  assert.equal(r1.pick, null);
  assert.ok(r1.rejection_reasons.comment_bait_needs_likes >= 1);

  const strong = creator('b', [post({ likes: 1500, comments: 400, caption: baitCaption })], { baseLikes: 100 });
  const r2 = pick([strong]);
  assert.ok(r2.pick);
  assert.ok(r2.pick.flags.includes('comment_bait'));

  const hiddenBait = creator('c', [post({ likes: null, comments: 900, caption: baitCaption })], { baseComments: 20 });
  assert.equal(pick([hiddenBait]).pick, null);
});

test('rejects already-used carousels (by id or code)', () => {
  const p = post({ likes: 2000 });
  const c = creator('a', [p]);
  assert.equal(pick([c], { seen: new Set([p.id]) }).pick, null);
  assert.equal(pick([c], { seen: new Set([p.code]) }).pick, null);
  assert.ok(pick([c], { seen: new Set(['other']) }).pick);
});

test('window widens 30 -> 60 -> 90 but thresholds stay put', () => {
  const old45 = post({ likes: 2000, takenAt: NOW - 45 * DAY });
  const r = pick([creator('a', [old45])]);
  assert.ok(r.pick);
  assert.equal(r.window_days, 60);
  assert.equal(r.widened, true);

  const old80 = post({ likes: 2000, takenAt: NOW - 80 * DAY });
  assert.equal(pick([creator('a', [old80])]).window_days, 90);

  const old100 = post({ likes: 2000, takenAt: NOW - 100 * DAY });
  const none = pick([creator('a', [old100])]);
  assert.equal(none.pick, null);
  assert.ok(none.rejection_reasons.outside_window >= 1);

  // 800 likes stays rejected at every window: the floor is never lowered.
  const weak = post({ likes: 800, comments: 100, takenAt: NOW - 85 * DAY });
  assert.equal(pick([creator('a', [weak], { baseLikes: 100 })]).pick, null);
});

test('only carousels with enough slides count', () => {
  const video = post({ type: 'video', slideCount: 1, likes: 5000 });
  const short = post({ slideCount: 2, likes: 5000 });
  const r = pick([creator('a', [video, short])]);
  assert.equal(r.pick, null);
  assert.equal(r.considered_carousels, 1); // the video is not even considered
  assert.ok(r.rejection_reasons.too_few_slides >= 1);
});

test('baseline excludes the candidate itself and uses the latest N others', () => {
  const cand = post({ likes: 1000 });
  const c = creator('a', [cand], { baseLikes: 100, n: 25 });
  const b = creatorBaseline(c.posts, cand, cfg);
  assert.equal(b.n, cfg.baseline_posts);
  assert.equal(b.medianLikes, 100); // not pulled up by the 1000-like candidate
});

test('insufficient baseline (<5 other posts) is rejected, not guessed', () => {
  const c = creator('a', [post({ likes: 5000 })], { n: 3 });
  const r = pick([c]);
  assert.equal(r.pick, null);
  assert.ok(r.rejection_reasons.insufficient_baseline >= 1);
});

test('ranking: highest ratio to own baseline wins; backups follow', () => {
  const big = creator('big', [post({ likes: 3000 })], { baseLikes: 1000 }); // 3x
  const small = creator('small', [post({ likes: 1500 })], { baseLikes: 100 }); // 15x
  const mid = creator('mid', [post({ likes: 2000 })], { baseLikes: 200 }); // 10x
  const r = pick([big, small, mid]);
  assert.equal(r.pick.handle, 'small');
  assert.deepEqual(
    r.backups.map((b) => b.handle),
    ['mid', 'big'],
  );
  assert.equal(r.passing_count, 3);
});

test('evaluateAll skips non-carousels', () => {
  const c = creator('a', [post({ type: 'video', slideCount: 1 }), post({ likes: 2000 })]);
  const rows = evaluateAll([c], cfg, { nowSec: NOW, windowDays: 30 });
  assert.equal(rows.length, 1);
});
