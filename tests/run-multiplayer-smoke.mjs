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
  'bun',
  ['x', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LOCAL_KV_BASE: localKvBase,
      WORLD_STATE_KEY: 'smoke-test-world',
      JWT_SECRET: 'smoke-test-secret-not-for-production',
      NUXT_IGNORE_LOCK: '1',
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

function stopServer() {
  return new Promise((resolve) => {
    if (server.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('exit', () => resolve());
      killer.once('error', () => {
        server.kill();
        resolve();
      });
      return;
    }

    const timer = setTimeout(() => {
      if (server.exitCode === null) server.kill('SIGKILL');
      resolve();
    }, 5000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

try {
  await waitForServer();
  await runSmokeTest();
  await new Promise(resolve => setTimeout(resolve, 2200));
  const persistedFiles = await readdir(localKvBase, { recursive: true });
  const normalizedFiles = persistedFiles.map(file => file.replaceAll('\\', '/'));
  const persistenceEvidence = `Files: ${JSON.stringify(persistedFiles)}\nServer: ${serverOutput}`;
  assert.ok(
    normalizedFiles.some(file => file.endsWith('world-v2/smoke-test-world/meta')),
    `world metadata was not persisted. ${persistenceEvidence}`,
  );
  assert.ok(
    normalizedFiles.some(file => file.includes('world-v2/smoke-test-world/chunk/')),
    `dirty world chunks were not persisted. ${persistenceEvidence}`,
  );
  assert.ok(
    normalizedFiles.some(file => file.endsWith('world-v2/smoke-test-world/chunk/0,-1')),
    `legacy world cells were not migrated to chunk storage. ${persistenceEvidence}`,
  );
} finally {
  await stopServer();
  await rm(localKvBase, { recursive: true, force: true });
}
