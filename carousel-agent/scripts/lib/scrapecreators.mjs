// Thin ScrapeCreators client. Zero dependencies (Node 20+ built-in fetch).
//
// Auth: in the cloud environment the credential is injected by the network proxy
// for api.scrapecreators.com, so the header value below is only a placeholder.
// Locally, set SCRAPECREATORS_API_KEY. Never commit a real key.

import { readFileSync } from 'node:fs';

const BASE = process.env.SCRAPECREATORS_BASE || 'https://api.scrapecreators.com';

// Local runs: the key may live in a git-ignored .env file (SCRAPECREATORS_API_KEY=...).
function keyFromDotenv() {
  for (const file of ['.env', 'carousel-agent/.env']) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*SCRAPECREATORS_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const KEY = process.env.SCRAPECREATORS_API_KEY || keyFromDotenv() || 'proxy-injected';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every call costs a credit. For development only: set SC_CACHE_DIR to reuse responses
// (TTL SC_CACHE_TTL_MIN, default 360 minutes). The daily cloud run leaves it unset.
async function withCache(url, fetcher) {
  const dir = process.env.SC_CACHE_DIR;
  if (!dir) return fetcher();
  const { createHash } = await import('node:crypto');
  const { readFile, writeFile, mkdir, stat } = await import('node:fs/promises');
  const file = `${dir}/${createHash('sha1').update(url.toString()).digest('hex')}.json`;
  try {
    const age = (Date.now() - (await stat(file)).mtimeMs) / 60000;
    if (age < Number(process.env.SC_CACHE_TTL_MIN || 360)) return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* cache miss */
  }
  const body = await fetcher();
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(body));
  return body;
}

export async function scGet(path, params = {}, opts = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return withCache(url, () => scFetch(url, opts));
}

async function scFetch(url, { retries = 3, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} from ${url.pathname}`);
      }
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
      if (!res.ok) {
        // 4xx other than 429 is not retryable (bad handle, out of credits, bad key...).
        const err = new Error(`HTTP ${res.status} from ${url.pathname}: ${text.slice(0, 200)}`);
        err.fatal = true;
        throw err;
      }
      return body;
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastErr;
}
