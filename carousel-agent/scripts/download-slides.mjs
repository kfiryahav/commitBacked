#!/usr/bin/env node
// Step 3 of the daily run: download the picked carousel's slide images so the agent can LOOK at them
// (the text lives inside the images). Partial or total failure is reported, never hidden.
//
//   node carousel-agent/scripts/download-slides.mjs [--in out/candidates.json] [--dir out/slides]
import './lib/ensure-proxy.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const inPath = arg('in', resolve(root, 'out/candidates.json'));
const dir = arg('dir', resolve(root, 'out/slides'));

const { pick } = JSON.parse(await readFile(inPath, 'utf8'));
if (!pick) {
  console.log('NO_PICK: nothing to download.');
  process.exit(0);
}

await mkdir(dir, { recursive: true });
const results = [];
for (const [i, url] of (pick.slideUrls || []).entries()) {
  const file = join(dir, `${String(i + 1).padStart(2, '0')}.jpg`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    results.push({ slide: i + 1, file, ok: true });
  } catch (err) {
    results.push({ slide: i + 1, ok: false, error: String(err.message || err) });
  }
}

const ok = results.filter((r) => r.ok).length;
const total = pick.slideUrls?.length || 0;
await writeFile(join(dir, 'manifest.json'), JSON.stringify({ source: pick.url, total, ok, results }, null, 2));

if (total === 0) console.log('NO_SLIDE_URLS: the API returned no slide image URLs. Fall back to caption only and say so.');
else if (ok === 0) console.log(`DOWNLOAD_BLOCKED: 0/${total} slides downloaded. Fall back to caption only and say so.`);
else console.log(`Downloaded ${ok}/${total} slides to ${dir}`);
