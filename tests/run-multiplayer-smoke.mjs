import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const port = 3310;
const baseUrl = `http://127.0.0.1:${port}`;
const localKvBase = await mkdtemp(join(tmpdir(), 'minesweeper-smoke-'));
let serverOutput = '';

await writeFile(join(localKvBase, 'smoke-test-world'), JSON.stringify({
  state: {
    seed: 'legacy-smoke-seed',
    flags: 1,
    startTime: Date.now(),
    leaderboard: [],
  },
  blocks: [{
    x: 7,
    y: -9,
    mine: true,
    adjacentMines: 0,
    revealed: false,
    flagged: true,
  }],
}));

const server = spawn(
  'pnpm',
  ['exec', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LOCAL_KV_BASE: localKvBase,
      WORLD_STATE_KEY: 'smoke-test-world',
      JWT_SECRET: 'smoke-test-secret-not-for-production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Dev server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for dev server.\n${serverOutput}`);
}

function runSmokeTest() {
  return new Promise((resolve, reject) => {
    const smoke = spawn(process.execPath, ['tests/multiplayer-smoke.mjs', baseUrl], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    smoke.on('error', reject);
    smoke.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Multiplayer smoke test exited with code ${code}.\n${serverOutput}`));
    });
  });
}

try {
  await waitForServer();
  await runSmokeTest();
  await new Promise(resolve => setTimeout(resolve, 2200));
  const persistedFiles = await readdir(localKvBase, { recursive: true });
  const persistenceEvidence = `Files: ${JSON.stringify(persistedFiles)}\nServer: ${serverOutput}`;
  assert.ok(
    persistedFiles.some(file => file.endsWith('world-v2/smoke-test-world/meta')),
    `world metadata was not persisted. ${persistenceEvidence}`,
  );
  assert.ok(
    persistedFiles.some(file => file.includes('world-v2/smoke-test-world/chunk/')),
    `dirty world chunks were not persisted. ${persistenceEvidence}`,
  );
  assert.ok(
    persistedFiles.some(file => file.endsWith('world-v2/smoke-test-world/chunk/0,-1')),
    `legacy world cells were not migrated to chunk storage. ${persistenceEvidence}`,
  );
} finally {
  server.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 250));
  if (server.exitCode === null) server.kill('SIGKILL');
  await rm(localKvBase, { recursive: true, force: true });
}
