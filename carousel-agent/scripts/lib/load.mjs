// Shared loading: read config, then page through each profile's posts ONLY as far as needed.
// Every API call costs a ScrapeCreators credit, so we stop as soon as the feed covers the
// requested window and holds enough posts for the creator's baseline.
import { readFile } from 'node:fs/promises';
import { scGet } from './scrapecreators.mjs';
import { normalizePost, extractItems, extractCursor } from './normalize.mjs';
import { DEFAULT_CONFIG } from './select.mjs';

const DAY = 86400;

export async function loadConfig(path) {
  const cfg = JSON.parse(await readFile(path, 'utf8'));
  return {
    profiles: (cfg.profiles || []).map((h) => String(h).replace(/^@/, '').trim()).filter(Boolean),
    sc: {
      posts_path: '/v2/instagram/user/posts', // verified live 2026-11-14
      handle_param: 'handle',
      cursor_param: 'next_max_id',
      max_pages: 8, // hard cap on credits per profile per run
      ...(cfg.scrapecreators || {}),
    },
    thresholds: { ...DEFAULT_CONFIG, ...(cfg.thresholds || {}) },
  };
}

export function createFeed(handle) {
  return { handle, posts: [], cursor: null, exhausted: false, calls: 0, followers: null, error: null, frontier: null, pages: [] };
}

// Page until the feed reaches back `untilDays` and holds >= minPosts posts (or runs out / hits max_pages).
// "Frontier" = timestamp of the last post of the latest page. We deliberately do not use the minimum
// timestamp, because pinned posts sit at the top of the feed with old dates.
export async function ensureLoaded(feed, config, { untilDays, nowSec }) {
  const minPosts = config.thresholds.baseline_posts + 1;
  while (!feed.exhausted && feed.calls < config.sc.max_pages) {
    const covered = feed.frontier !== null && feed.posts.length >= minPosts && feed.frontier <= nowSec - untilDays * DAY;
    if (covered) return;

    const body = await scGet(config.sc.posts_path, {
      [config.sc.handle_param]: feed.handle,
      [config.sc.cursor_param]: feed.cursor,
    });
    feed.calls += 1;
    const raw = extractItems(body);
    const posts = raw.map((r) => normalizePost(r, feed.handle)).filter((p) => p.id);
    feed.posts.push(...posts);
    if (posts.length) feed.frontier = posts[posts.length - 1].takenAt;
    if (feed.followers === null && typeof body?.user?.follower_count === 'number') feed.followers = body.user.follower_count;
    feed.cursor = extractCursor(body);
    if (!feed.cursor || body?.more_available === false || raw.length === 0) feed.exhausted = true;
    feed.pages.push({
      items: raw.length,
      more_available: body?.more_available ?? null,
      has_cursor: Boolean(feed.cursor),
      oldest_days_ago: posts.length ? Math.round((nowSec - Math.min(...posts.map((p) => p.takenAt || nowSec))) / DAY) : null,
    });
  }
}

// Load every profile to cover `untilDays`. A failing profile is recorded and skipped.
export async function loadFeeds(config, { handles, untilDays, nowSec, feeds = new Map() }) {
  const errors = [];
  for (const handle of handles || config.profiles) {
    const feed = feeds.get(handle) || createFeed(handle);
    feeds.set(handle, feed);
    if (feed.error) continue;
    try {
      await ensureLoaded(feed, config, { untilDays, nowSec });
    } catch (err) {
      feed.error = String(err.message || err);
    }
  }
  for (const f of feeds.values()) if (f.error) errors.push({ handle: f.handle, error: f.error });
  const creators = [...feeds.values()]
    .filter((f) => !f.error)
    .map((f) => ({ handle: f.handle, posts: f.posts, followers: f.followers, calls: f.calls, exhausted: f.exhausted, pages: f.pages }));
  const calls = [...feeds.values()].reduce((n, f) => n + f.calls, 0);
  return { creators, errors, calls, feeds };
}
