import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const port = 3310 + (process.pid % 400);
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/ws`;
const tempDir = await mkdtemp(join(tmpdir(), 'minesweeper-room-smoke-'));
const serverEnv = {
  ...process.env,
  JWT_SECRET: 'room-smoke-secret-not-for-production',
  LOCAL_DB_PATH: join(tempDir, 'minesweeper.sqlite'),
  NUXT_IGNORE_LOCK: '1',
};

let serverOutput = '';
const server = spawn('bun', ['x', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: process.cwd(),
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
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

async function register(label) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: `smoke_${Date.now()}_${label}`, password: 'smoke-test-password' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

function connect() {
  const socket = new WebSocket(wsUrl);
  const messages = [];
  const waiters = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiterIndex = waiters.findIndex(waiter => waiter.predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else {
      messages.push(message);
    }
  });

  function waitFor(predicate, timeout = 5_000) {
    const queuedIndex = messages.findIndex(predicate);
    if (queuedIndex >= 0) return Promise.resolve(messages.splice(queuedIndex, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, timeout);
      waiters.push(waiter);
    });
  }

  async function authenticate(token) {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    await waitFor(message => message.type === 'hello');
    socket.send(JSON.stringify({ type: 'identify', payload: { token } }));
    await waitFor(message => message.type === 'auth');
  }

  return { socket, waitFor, authenticate };
}

async function solveRun(client) {
  let index = 0;
  let seq = 0;
  let pending = null;
  const deadline = Date.now() + 30_000;

  const sendNext = () => {
    if (index >= 256) throw new Error('Board did not complete after all cells were revealed');
    const x = index % 16;
    const y = Math.floor(index / 16);
    index++;
    seq++;
    pending = { action: 'reveal', x, y, seq };
    client.socket.send(JSON.stringify({ type: 'room:action', payload: pending }));
  };

  sendNext();
  while (Date.now() < deadline) {
    const message = await client.waitFor(message => (
      message.type === 'run:update'
      || (message.type === 'error' && ['RATE_LIMITED', 'INVALID_ROOM_ACTION'].includes(message.code))
    ), 5_000);
    if (message.type === 'error') {
      if (message.code === 'INVALID_ROOM_ACTION') throw new Error(message.message);
      await new Promise(resolve => setTimeout(resolve, 1_000));
      client.socket.send(JSON.stringify({ type: 'room:action', payload: pending }));
      continue;
    }
    if (message.data.state.status === 'complete') return message.data.state;
    await new Promise(resolve => setTimeout(resolve, 45));
    sendNext();
  }
  throw new Error('Timed out solving the room board');
}

async function stopServer() {
  if (server.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => {
      if (server.exitCode === null) server.kill('SIGKILL');
      resolve();
    }, 5_000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

let first;
let second;
let reconnected;
try {
  await waitForServer();
  const daily = await fetch(`${baseUrl}/api/challenges/daily`).then(response => response.json());
  assert.deepEqual(
    { rows: daily.rows, cols: daily.cols, mines: daily.mines },
    { rows: 16, cols: 16, mines: 40 },
  );

  const firstUser = await register('a');
  const secondUser = await register('b');
  first = connect();
  second = connect();
  await Promise.all([first.authenticate(firstUser.token), second.authenticate(secondUser.token)]);

  first.socket.send(JSON.stringify({ type: 'room:create', payload: { challengeId: daily.id, maxPlayers: 2 } }));
  const created = await first.waitFor(message => message.type === 'room:created');
  const roomCode = created.data.code;
  second.socket.send(JSON.stringify({ type: 'room:join', payload: { code: roomCode } }));
  await Promise.all([
    first.waitFor(message => message.type === 'room:state' && message.data.players.length === 2),
    second.waitFor(message => message.type === 'room:state' && message.data.players.length === 2),
  ]);

  first.socket.send(JSON.stringify({ type: 'room:ready', payload: { ready: true } }));
  second.socket.send(JSON.stringify({ type: 'room:ready', payload: { ready: true } }));
  const [countdown, started, firstRun, secondRun] = await Promise.all([
    first.waitFor(message => message.type === 'room:countdown'),
    first.waitFor(message => message.type === 'room:started'),
    first.waitFor(message => message.type === 'run:init'),
    second.waitFor(message => message.type === 'run:init'),
  ]);
  assert.equal(countdown.data.challenge.id, daily.id);
  assert.equal(firstRun.data.challenge.id, secondRun.data.challenge.id);
  assert.equal(firstRun.data.state.rows, 16);
  assert.equal(firstRun.data.state.cols, 16);
  assert.equal(started.data.status, 'running');

  second.socket.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  reconnected = connect();
  await reconnected.authenticate(secondUser.token);
  reconnected.socket.send(JSON.stringify({ type: 'room:join', payload: { code: roomCode } }));
  const resumed = await reconnected.waitFor(message => message.type === 'run:init');
  assert.equal(resumed.data.challenge.id, daily.id);
  assert.equal(resumed.data.state.startedAt, secondRun.data.state.startedAt);

  const winnerState = await solveRun(first);
  assert.equal(winnerState.status, 'complete');
  const finished = await first.waitFor(message => message.type === 'room:state' && message.data.status === 'finished');
  assert.ok(finished.data.players.some(player => player.status === 'complete'));

  first.socket.close();
  reconnected.socket.close();
  const asyncChallenge = await fetch(`${baseUrl}/api/challenges/private`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${firstUser.token}` },
  }).then(async response => {
    assert.equal(response.status, 200);
    return response.json();
  });
  const asyncLookup = await fetch(`${baseUrl}/api/challenges/private/${asyncChallenge.code}`);
  assert.equal(asyncLookup.status, 200);
  assert.equal((await asyncLookup.json()).id, asyncChallenge.id);

  console.log('Room smoke test passed: 1v1 countdown, shared board, reconnect, winner, and permanent async challenge.');
} finally {
  first?.socket.close();
  second?.socket.close();
  reconnected?.socket.close();
  await stopServer();
  await rm(tempDir, { recursive: true, force: true });
}
