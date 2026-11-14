// Shared loading: read config, fetch + normalize every profile's recent posts.
import { readFile } from 'node:fs/promises';
import { scGet } from './scrapecreators.mjs';
import { normalizePost, extractItems, extractCursor } from './normalize.mjs';
import { DEFAULT_CONFIG } from './select.mjs';

export async function loadConfig(path) {
  const cfg = JSON.parse(await readFile(path, 'utf8'));
  return {
    profiles: (cfg.profiles || []).map((h) => String(h).replace(/^@/, '').trim()).filter(Boolean),
    sc: {
      // UNVERIFIED defaults: confirm in Phase 0a against a live response, then pin here.
      posts_path: '/v2/instagram/user/posts',
      handle_param: 'handle',
      cursor_param: 'next_max_id',
      max_pages: 3,
      ...(cfg.scrapecreators || {}),
    },
    thresholds: { ...DEFAULT_CONFIG, ...(cfg.thresholds || {}) },
  };
}

// Returns { creators: [{handle, posts}], errors: [{handle, error}], calls }.
export async function loadCreators(config, { handles } = {}) {
  const creators = [];
  const errors = [];
  let calls = 0;

  for (const handle of handles || config.profiles) {
    try {
      const raw = [];
      let cursor = null;
      for (let page = 0; page < config.sc.max_pages; page++) {
        const body = await scGet(config.sc.posts_path, {
          [config.sc.handle_param]: handle,
          [config.sc.cursor_param]: cursor,
        });
        calls += 1;
        raw.push(...extractItems(body));
        cursor = extractCursor(body);
        if (!cursor) break;
      }
      const posts = raw.map((r) => normalizePost(r, handle)).filter((p) => p.id);
      creators.push({ handle, posts });
    } catch (err) {
      errors.push({ handle, error: String(err.message || err) });
    }
  }
  return { creators, errors, calls };
}
