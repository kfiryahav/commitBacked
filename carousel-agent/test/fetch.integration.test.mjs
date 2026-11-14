// End-to-end test of fetch-carousels.mjs against a LOCAL fake API (no network, no real key).
// It verifies OUR code: pagination, per-profile error isolation, selection, output file.
// It does not verify the real ScrapeCreators response shape (Phase 0a).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(root, 'scripts/fetch-carousels.mjs');
const work = resolve(root, `out/test-${process.pid}`);

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

function image(i) {
  return { id: `img${i}`, code: `I${i}`, media_type: 1, like_count: 300, comment_count: 20, taken_at: NOW - (10 + i) * DAY, caption: { text: 'regular' } };
}
function carousel(id, likes, daysAgo) {
  return {
    id,
    code: `C_${id}`,
    media_type: 8,
    like_count: likes,
    comment_count: 50,
    taken_at: NOW - daysAgo * DAY,
    caption: { text: 'שמרו את זה' },
    carousel_media: [1, 2, 3, 4].map((n) => ({ image_versions2: { candidates: [{ url: `https://img.example/${id}/${n}.jpg` }] } })),
  };
}

// handle "good": page 1 = 6 images, cursor -> page 2 = 4 images + one viral carousel.
const pages = {
  good: [
    { items: Array.from({ length: 6 }, (_, i) => image(i)), next_max_id: 'p2' },
    { items: [...Array.from({ length: 4 }, (_, i) => image(i + 6)), carousel('viral', 1800, 3)] },
  ],
};

function run(args, env) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => res({ code, stdout, stderr }));
  });
}

test('fetch-carousels: paginates, isolates a failing profile, picks the viral carousel', async (t) => {
  const seenKeys = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seenKeys.push(req.headers['x-api-key']);
    const handle = url.searchParams.get('handle');
    if (handle === 'bad') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'not found' }));
    }
    const list = pages[handle];
    const idx = url.searchParams.get('next_max_id') ? 1 : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list[idx]));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    server.close();
    await rm(work, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  await mkdir(work, { recursive: true });
  const cfgPath = resolve(work, 'profiles.json');
  const outPath = resolve(work, 'candidates.json');
  const seenPath = resolve(work, 'seen.json');
  await writeFile(cfgPath, JSON.stringify({ profiles: ['good', 'bad'] }));
  await writeFile(seenPath, JSON.stringify([]));

  const r = await run(['--config', cfgPath, '--out', outPath, '--seen', seenPath], { SCRAPECREATORS_BASE: base });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /PICK: @good/);
  assert.match(r.stdout, /PROFILE_ERRORS: @bad/);

  const out = JSON.parse(await readFile(outPath, 'utf8'));
  assert.equal(out.pick.handle, 'good');
  assert.equal(out.pick.id, 'viral');
  assert.equal(out.pick.likes, 1800);
  assert.equal(out.pick.slideCount, 4);
  assert.equal(out.pick.slideUrls.length, 4);
  assert.equal(out.pick.ratio_vs_own_median, 6);
  assert.equal(out.profiles_ok[0].posts, 11); // both pages were fetched
  assert.equal(out.profile_errors.length, 1);
  assert.ok(seenKeys.every((k) => k === 'proxy-injected'), 'placeholder key header is sent when no key is set');

  // Second run with the pick marked as used: nothing else passes -> NO_PICK, thresholds untouched.
  await writeFile(seenPath, JSON.stringify(['viral']));
  const r2 = await run(['--config', cfgPath, '--out', outPath, '--seen', seenPath], { SCRAPECREATORS_BASE: base });
  assert.equal(r2.code, 0, r2.stderr);
  assert.match(r2.stdout, /NO_PICK/);
  assert.equal(JSON.parse(await readFile(outPath, 'utf8')).pick, null);
});

test('fetch-carousels: exits 2 with a clear message when no profiles are configured', async (t) => {
  await mkdir(work, { recursive: true });
  t.after(() => rm(work, { recursive: true, force: true }));
  const cfgPath = resolve(work, 'empty.json');
  await writeFile(cfgPath, JSON.stringify({ profiles: [] }));
  const r = await run(['--config', cfgPath, '--out', resolve(work, 'x.json')], {});
  assert.equal(r.code, 2);
  assert.match(r.stderr, /No profiles configured/);
});

test('fetch-carousels: exits 3 when every profile fails (bad key / no credits)', async (t) => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid api key' }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await mkdir(work, { recursive: true });
  t.after(async () => {
    server.close();
    await rm(work, { recursive: true, force: true });
  });
  const cfgPath = resolve(work, 'one.json');
  await writeFile(cfgPath, JSON.stringify({ profiles: ['anyone'] }));
  const r = await run(['--config', cfgPath, '--out', resolve(work, 'y.json')], {
    SCRAPECREATORS_BASE: `http://127.0.0.1:${server.address().port}`,
  });
  assert.equal(r.code, 3);
  assert.match(r.stdout, /PROFILE_ERRORS: @anyone: HTTP 401/);
});
