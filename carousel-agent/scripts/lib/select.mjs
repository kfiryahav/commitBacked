// Pure selection logic for the carousel agent. No I/O, no network.
// The rule is deliberately code, not model judgement: see carousel-agent/AGENT.md.
//
// Normalized post shape (produced by normalize.mjs):
//   { id, code, url, handle, type: 'carousel'|'video'|'image'|'unknown',
//     slideCount, slideUrls[], likes: number|null (null = hidden),
//     comments: number, takenAt: epoch seconds, caption }

export const DEFAULT_CONFIG = {
  min_likes: 1000, // floor: likes >= this ...
  min_comments: 150, // ... OR comments >= this
  outlier_multiple: 3, // and engagement >= N x the creator's own median
  baseline_posts: 20, // how many of the creator's latest other posts form the baseline
  min_baseline_posts: 5, // fewer than this -> cannot judge "outlier", so reject
  min_slides: 3,
  windows_days: [30, 60, 90], // widen in this order; thresholds are NEVER lowered
  backups: 2,
};

const DAY = 86400;

export function median(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// Heuristic: "comment X and I'll send it" automations inflate comment counts.
const BAIT_PATTERNS = [
  /תגיב(?:ו|י)?\s+["'״׳“”]?[\p{L}\p{N}_-]{2,}/u,
  /(?:כתבו|תכתבו|כתוב|כתבי)\s+(?:לי\s+)?(?:["'״׳“”]?[\p{L}\p{N}_-]{2,}["'״׳“”]?\s+)?בתגובות/u,
  /\bcomment\s+["'“”]?[\p{L}\p{N}_-]{2,}/iu,
  /\bcomment\s+below\b/i,
  /\bDM\s+me\b/i,
];

export function isCommentBait(caption) {
  if (!caption || typeof caption !== 'string') return false;
  return BAIT_PATTERNS.some((re) => re.test(caption));
}

// Baseline = the creator's latest N *other* posts (the candidate must not
// distort its own baseline). Any post type counts.
export function creatorBaseline(posts, candidate, cfg = DEFAULT_CONFIG) {
  const others = posts
    .filter((p) => p.id !== candidate.id)
    .sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0))
    .slice(0, cfg.baseline_posts);
  return {
    n: others.length,
    medianLikes: median(others.map((p) => p.likes)),
    medianComments: median(others.map((p) => p.comments)),
  };
}

// Judge one post. Returns { pass, reasons[], flags[], ratio, metric }.
export function evaluate(post, baseline, cfg, { nowSec, windowDays, seen = new Set() }) {
  const reasons = [];
  const flags = [];

  if (post.type !== 'carousel') reasons.push('not_carousel');
  if ((post.slideCount || 0) < cfg.min_slides) reasons.push('too_few_slides');
  if (seen.has(post.id) || (post.code && seen.has(post.code))) reasons.push('already_used');
  if (!post.takenAt || nowSec - post.takenAt > windowDays * DAY) reasons.push('outside_window');

  const likesHidden = post.likes === null || post.likes === undefined;
  const likes = likesHidden ? 0 : post.likes;
  const comments = post.comments || 0;
  const bait = isCommentBait(post.caption);
  if (likesHidden) flags.push('likes_hidden');
  if (bait) flags.push('comment_bait');

  // Floor.
  let floorOk;
  if (bait) {
    // Inflated comments do not count: the likes floor must be met on its own.
    floorOk = !likesHidden && likes >= cfg.min_likes;
    if (!floorOk) reasons.push('comment_bait_needs_likes');
  } else {
    floorOk = likesHidden ? comments >= cfg.min_comments : likes >= cfg.min_likes || comments >= cfg.min_comments;
    if (!floorOk) reasons.push('below_floor');
  }

  // Outlier vs the creator's own baseline.
  const metric = likesHidden ? 'comments' : 'likes';
  const value = likesHidden ? comments : likes;
  const med = likesHidden ? baseline.medianComments : baseline.medianLikes;
  let ratio = null;
  if (baseline.n < cfg.min_baseline_posts || med === null) {
    reasons.push('insufficient_baseline');
  } else {
    const denom = Math.max(med, 1);
    ratio = value / denom;
    if (value < cfg.outlier_multiple * denom) reasons.push('not_outlier');
  }

  return { pass: reasons.length === 0, reasons, flags, ratio, metric };
}

// Evaluate every post of every creator for one window (used by select + calibrate).
export function evaluateAll(creators, cfg, { nowSec, windowDays, seen = new Set() }) {
  const rows = [];
  for (const c of creators) {
    for (const post of c.posts) {
      if (post.type !== 'carousel') continue;
      const baseline = creatorBaseline(c.posts, post, cfg);
      rows.push({ handle: c.handle, post, baseline, ...evaluate(post, baseline, cfg, { nowSec, windowDays, seen }) });
    }
  }
  return rows;
}

function rank(a, b) {
  return (
    (b.ratio ?? 0) - (a.ratio ?? 0) ||
    (b.post.comments || 0) - (a.post.comments || 0) ||
    (b.post.takenAt || 0) - (a.post.takenAt || 0)
  );
}

export function summarizeRejections(rows) {
  const hist = {};
  for (const r of rows) for (const reason of r.reasons) hist[reason] = (hist[reason] || 0) + 1;
  return hist;
}

// Pick one carousel + backups. Widens the time window; never lowers thresholds.
export function selectCarousel({ creators, seen = new Set(), cfg = DEFAULT_CONFIG, nowSec }) {
  let lastRows = [];
  for (const windowDays of cfg.windows_days) {
    const rows = evaluateAll(creators, cfg, { nowSec, windowDays, seen });
    lastRows = rows;
    const passing = rows.filter((r) => r.pass).sort(rank);
    if (passing.length > 0) {
      return {
        window_days: windowDays,
        widened: windowDays !== cfg.windows_days[0],
        pick: passing[0],
        backups: passing.slice(1, 1 + cfg.backups),
        passing_count: passing.length,
        considered_carousels: rows.length,
      };
    }
  }
  return {
    window_days: cfg.windows_days[cfg.windows_days.length - 1],
    widened: cfg.windows_days.length > 1,
    pick: null,
    backups: [],
    passing_count: 0,
    considered_carousels: lastRows.length,
    rejection_reasons: summarizeRejections(lastRows),
  };
}
