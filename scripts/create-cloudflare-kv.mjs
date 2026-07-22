import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');

const output = execFileSync('bun', ['x', 'wrangler', 'kv', 'namespace', 'create', 'KV'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit']
});

const match = output.match(/["']id["']\s*:\s*["']([^"']+)["']/) || output.match(/id\s*=\s*"([^"]+)"/);

if (!match) {
  console.log(output);
  throw new Error('Could not find KV namespace id in wrangler output.');
}

const namespaceId = match[1];
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const next = existing.includes('CLOUDFLARE_KV_NAMESPACE_ID=')
  ? existing.replace(/^CLOUDFLARE_KV_NAMESPACE_ID=.*$/m, `CLOUDFLARE_KV_NAMESPACE_ID=${namespaceId}`)
  : `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}CLOUDFLARE_KV_NAMESPACE_ID=${namespaceId}\n`;

writeFileSync(envPath, next);
console.log(`Wrote CLOUDFLARE_KV_NAMESPACE_ID=${namespaceId} to .env`);
