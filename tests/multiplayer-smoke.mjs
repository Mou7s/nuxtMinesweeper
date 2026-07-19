import assert from 'node:assert/strict';

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error('Usage: node tests/multiplayer-smoke.mjs http://127.0.0.1:3100');

const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
const suffix = Date.now().toString(36);
const baseCoordinate = 200000 + (Date.now() % 100000);
const hasCell = (updates, x, y) => updates.some((block) => (
  Array.isArray(block) ? block[0] === x && block[1] === y : block.x === x && block.y === y
));

async function register(username) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'smoke-test-password', color: '#3b82f6' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function login(username) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'smoke-test-password' }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

function connect() {
  const socket = new WebSocket(wsUrl);
  const messages = [];
  const waiters = [];

  socket.addEventListener('message', (event) => {
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

  function waitFor(predicate, timeout = 3000) {
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

  return { socket, messages, waitFor };
}

async function openClient(token, viewport, requestId = 1) {
  const client = connect();
  await new Promise((resolve, reject) => {
    client.socket.addEventListener('open', resolve, { once: true });
    client.socket.addEventListener('error', reject, { once: true });
  });
  await client.waitFor(message => message.type === 'init');
  client.socket.send(JSON.stringify({ type: 'identify', payload: { token } }));
  await client.waitFor(message => message.type === 'state');
  client.socket.send(JSON.stringify({ type: 'viewport', requestId, payload: viewport }));
  const blocks = [];
  let snapshot;
  do {
    snapshot = await client.waitFor(message => message.type === 'snapshot' && message.requestId === requestId);
    blocks.push(...(snapshot.data.blocks || []));
  } while (!snapshot.data.complete);
  snapshot.data.blocks = blocks;
  return { ...client, snapshot };
}

const firstUser = await register(`smoke_${suffix}_a`);
const secondUser = await register(`smoke_${suffix}_b`);
const nearViewport = { x: baseCoordinate - 20, y: baseCoordinate - 20, cols: 50, rows: 40 };
const farViewport = { x: baseCoordinate + 100000, y: baseCoordinate + 100000, cols: 40, rows: 30 };

const first = await openClient(firstUser.token, nearViewport);
const second = await openClient(secondUser.token, nearViewport);

const guest = connect();
await new Promise((resolve, reject) => {
  guest.socket.addEventListener('open', resolve, { once: true });
  guest.socket.addEventListener('error', reject, { once: true });
});
await guest.waitFor(message => message.type === 'init');
guest.socket.send(JSON.stringify({
  type: 'action',
  payload: { action: 'click', x: baseCoordinate, y: baseCoordinate },
}));
await guest.waitFor(message => message.type === 'error' && message.code === 'AUTH_REQUIRED');
guest.socket.close();

first.socket.send(JSON.stringify({
  type: 'action',
  payload: { action: 'click', x: baseCoordinate, y: baseCoordinate },
}));

const actorUpdate = await first.waitFor(message => message.type === 'update' && message.data?.updates?.length);
const peerUpdate = await second.waitFor(message => message.type === 'update' && message.data?.updates?.length);
assert.ok(hasCell(actorUpdate.data.updates, baseCoordinate, baseCoordinate));
assert.ok(hasCell(peerUpdate.data.updates, baseCoordinate, baseCoordinate));
assert.equal(Number.isFinite(actorUpdate.data.actorScore), true);
assert.notEqual(actorUpdate.data.actorScore, 0);

second.socket.send(JSON.stringify({ type: 'viewport', requestId: 2, payload: farViewport }));
let farSnapshot;
do {
  farSnapshot = await second.waitFor(message => message.type === 'snapshot' && message.requestId === 2);
} while (!farSnapshot.data.complete);

first.socket.send(JSON.stringify({
  type: 'action',
  payload: { action: 'click', x: baseCoordinate + 20, y: baseCoordinate + 20 },
}));
const secondActorUpdate = await first.waitFor(message => (
  message.type === 'update'
  && hasCell(message.data?.updates || [], baseCoordinate + 20, baseCoordinate + 20)
));

let leakedUpdate = false;
try {
  await second.waitFor(
    message => message.type === 'update' && hasCell(
      message.data?.updates || [],
      baseCoordinate + 20,
      baseCoordinate + 20,
    ),
    400,
  );
  leakedUpdate = true;
} catch {}
assert.equal(leakedUpdate, false, 'far-away clients should not receive unrelated chunk updates');

first.socket.send(JSON.stringify({
  type: 'action',
  payload: { action: 'reset', x: baseCoordinate, y: baseCoordinate },
}));
await first.waitFor(message => message.type === 'error' && message.code === 'INVALID_ACTION');

for (let index = 0; index < 25; index++) {
  first.socket.send(JSON.stringify({
    type: 'action',
    payload: { action: 'click', x: baseCoordinate, y: baseCoordinate },
  }));
}
await first.waitFor(message => message.type === 'error' && message.code === 'RATE_LIMITED');

await new Promise(resolve => setTimeout(resolve, 650));
const persistedLogin = await login(firstUser.user.username);
assert.equal(persistedLogin.user.score, secondActorUpdate.data.actorScore);

first.socket.close();
const reconnected = await openClient(firstUser.token, nearViewport);
assert.ok(hasCell(reconnected.snapshot.data.blocks, baseCoordinate, baseCoordinate));

second.socket.close();
reconnected.socket.close();
console.log('Multiplayer smoke test passed: viewport snapshots, scoped updates, auth, and reconnect.');
