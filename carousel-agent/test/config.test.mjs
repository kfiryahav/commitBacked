import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG } from '../scripts/lib/select.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));

test('profiles.json is valid and its thresholds match the agreed defaults', async () => {
  const cfg = await readJson('config/profiles.json');
  assert.ok(Array.isArray(cfg.profiles));
  for (const h of cfg.profiles) assert.match(h, /^[A-Za-z0-9._]+$/, `handle looks wrong: ${h}`);
  assert.deepEqual(cfg.thresholds, {
    min_likes: DEFAULT_CONFIG.min_likes,
    min_comments: DEFAULT_CONFIG.min_comments,
    outlier_multiple: DEFAULT_CONFIG.outlier_multiple,
    baseline_posts: DEFAULT_CONFIG.baseline_posts,
    min_baseline_posts: DEFAULT_CONFIG.min_baseline_posts,
    min_slides: DEFAULT_CONFIG.min_slides,
    windows_days: DEFAULT_CONFIG.windows_days,
    backups: DEFAULT_CONFIG.backups,
  });
});

test('canva.json: 6 slides, every editable element has max_chars, originals never edited', async () => {
  const c = await readJson('config/canva.json');
  assert.equal(c.design.id, 'DAHUC57-RDg');
  assert.equal(c.design.never_edit_original, true);
  assert.equal(c.slides.length, 6);
  assert.deepEqual(
    c.slides.map((s) => s.n),
    [1, 2, 3, 4, 5, 6],
  );
  for (const s of c.slides) {
    for (const e of s.elements) {
      const isText = e.original !== undefined && !e.keep && e.type !== 'shape' && e.type !== 'image';
      if (isText) assert.ok(Number.isInteger(e.max_chars) && e.max_chars > 0, `slide ${s.n} ${e.role} needs max_chars`);
      if (isText) assert.ok(e.original.length <= e.max_chars + 130, `slide ${s.n} ${e.role} original wildly exceeds max_chars`);
    }
  }
});

test('every original text in canva.json fits its own max_chars (the design natively fits them)', async () => {
  const c = await readJson('config/canva.json');
  for (const s of c.slides) {
    for (const e of s.elements) {
      if (e.max_chars && e.original && !e.keep) {
        assert.ok(e.original.replace(/\s+/g, ' ').length <= e.max_chars + 5, `slide ${s.n} ${e.role}: original (${e.original.length}) > max_chars (${e.max_chars})`);
      }
    }
  }
});
