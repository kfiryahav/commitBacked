// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 (Node >= 22.21 / 24).
// The cloud sandbox only reaches the internet through that proxy, so every entry script imports
// this FIRST: if a proxy is configured and the flag is missing, re-run the same command with it.
// Skipped for a local fake API (used by the tests) or when SC_NO_REEXEC is set.
import { spawnSync } from 'node:child_process';

const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
const localBase = /^https?:\/\/(127\.|localhost)/.test(process.env.SCRAPECREATORS_BASE || '');

if (proxied && process.env.NODE_USE_ENV_PROXY !== '1' && !process.env.SC_NO_REEXEC && !localBase) {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}
