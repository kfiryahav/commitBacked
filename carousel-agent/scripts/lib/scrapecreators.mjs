// Thin ScrapeCreators client. Zero dependencies (Node 20+ built-in fetch).
//
// Auth: in the cloud environment the credential is injected by the network proxy
// for api.scrapecreators.com, so the header value below is only a placeholder.
// Locally, set SCRAPECREATORS_API_KEY. Never commit a real key.

const BASE = process.env.SCRAPECREATORS_BASE || 'https://api.scrapecreators.com';
const KEY = process.env.SCRAPECREATORS_API_KEY || 'proxy-injected';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scGet(path, params = {}, { retries = 3, timeoutMs = 30000 } = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

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
