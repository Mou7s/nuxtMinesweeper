import { randomBytes, randomUUID } from 'node:crypto';
import { createPrivateChallenge, createRun, applyAction, publicRunState } from '../utils/challengeEngine.mjs';
import {
  appendRunAction,
  createRunRecord,
  createStoredChallenge,
  finishRun,
  getChallengeById,
  getOrCreateDailyChallenge,
  saveMatchResult,
} from '../utils/appDataStore';
import { utcDateString } from '../utils/challengeEngine.mjs';
import { verifyToken } from '../utils/jwt';
import { globalUserStore } from '../utils/userStore';

const MAX_MESSAGE_SIZE = 16 * 1024;
const ACTION_LIMIT = 30;
const ACTION_WINDOW_MS = 1000;
const ROOM_MAX_PLAYERS = 8;
const ROOM_CODE_LENGTH = 8;
const activeRuns = new Map();
const rooms = new Map();

function sendJson(peer, payload) {
  peer.send(JSON.stringify(payload));
}

function sendError(peer, code, message) {
  sendJson(peer, { type: 'error', code, message });
}

function consumeActionQuota(peer) {
  const now = Date.now();
  const rate = peer._actionRate || { startedAt: now, count: 0 };
  if (now - rate.startedAt >= ACTION_WINDOW_MS) {
    rate.startedAt = now;
    rate.count = 0;
  }
  rate.count++;
  peer._actionRate = rate;
  return rate.count <= ACTION_LIMIT;
}

function publicChallenge(challenge) {
  return {
    id: challenge.id,
    kind: challenge.kind,
    challengeDate: challenge.challengeDate,
    rows: challenge.rows,
    cols: challenge.cols,
    mines: challenge.mines,
  };
}

function normalizeAction(payload) {
  if (!payload || !['reveal', 'flag'].includes(payload.action)) return null;
  if (!Number.isInteger(payload.x) || !Number.isInteger(payload.y)) return null;
  if (payload.x < 0 || payload.x >= 16 || payload.y < 0 || payload.y >= 16) return null;
  if (!Number.isInteger(payload.seq) || payload.seq < 1) return null;
  return payload;
}

function getUserId(peer) {
  return peer._userId || null;
}

async function identifyPeer(peer, token) {
  if (typeof token !== 'string' || token.length > 4096) return false;
  const payload = verifyToken(token);
  if (!payload) return false;
  const user = await globalUserStore.getUserById(payload.userId);
  if (!user) return false;
  peer._userId = user.id;
  peer._username = user.username;
  peer._color = user.color;
  sendJson(peer, {
    type: 'auth',
    data: { id: user.id, username: user.username, color: user.color },
  });
  return true;
}

async function resolveChallenge(challengeId) {
  if (!challengeId) return getOrCreateDailyChallenge(utcDateString());
  const challenge = await getChallengeById(challengeId);
  if (!challenge) throw new Error('挑战不存在');
  return challenge;
}

async function startRun(peer, payload = {}) {
  if (peer._runId) {
    sendError(peer, 'RUN_EXISTS', '当前已有进行中的挑战');
    return;
  }

  const challenge = await resolveChallenge(payload.challengeId);
  const mode = payload.mode === 'async' ? 'async' : 'daily';
  if (mode === 'async' && challenge.kind !== 'private') {
    sendError(peer, 'INVALID_CHALLENGE', '异步挑战必须使用私人题目');
    return;
  }

  const runId = randomUUID();
  const run = createRun(challenge, { userId: getUserId(peer), mode });
  run.id = runId;
  await createRunRecord({
    id: runId,
    challengeId: challenge.id,
    userId: getUserId(peer),
    mode,
  });
  activeRuns.set(runId, run);
  peer._runId = runId;
  sendJson(peer, {
    type: 'run:init',
    data: {
      runId,
      challenge: publicChallenge(challenge),
      state: publicRunState(run),
      serverNow: Date.now(),
      authenticated: Boolean(peer._userId),
    },
  });
}

async function resumeRun(peer, runId) {
  const run = activeRuns.get(runId);
  if (!run || (run.userId && run.userId !== peer._userId)) {
    sendError(peer, 'RUN_NOT_FOUND', '挑战已过期或无权恢复');
    return;
  }
  if (peer._runId) {
    sendError(peer, 'RUN_EXISTS', '当前已有进行中的挑战');
    return;
  }
  peer._runId = runId;
  sendJson(peer, {
    type: 'run:resume',
    data: { runId, state: publicRunState(run), serverNow: Date.now() },
  });
}

async function processRunAction(peer, payload) {
  const action = normalizeAction(payload);
  if (!action) {
    sendError(peer, 'INVALID_ACTION', '操作参数无效');
    return;
  }
  if (!consumeActionQuota(peer)) {
    sendError(peer, 'RATE_LIMITED', '操作过于频繁，请稍后再试');
    return;
  }

  const run = activeRuns.get(peer._runId);
  if (!run) {
    sendError(peer, 'RUN_NOT_FOUND', '挑战已结束或不存在');
    return;
  }
  if (action.seq !== run.lastSeq + 1) {
    sendError(peer, 'INVALID_SEQUENCE', '操作序号无效');
    return;
  }

  const receivedAt = Date.now();
  const result = applyAction(run, action, receivedAt);
  if (!result) {
    sendError(peer, 'INVALID_ACTION', '操作被拒绝');
    return;
  }
  run.lastSeq = action.seq;
  await appendRunAction({
    runId: run.id,
    seq: action.seq,
    action: action.action,
    x: action.x,
    y: action.y,
    receivedAt,
    result: { result: result.result, changed: result.changed },
  });

  let score = null;
  if (run.status === 'complete') {
    score = await finishRun({
      runId: run.id,
      challengeId: run.challengeId,
      userId: run.userId,
      mode: run.mode,
      run,
    });
    activeRuns.delete(run.id);
  }

  sendJson(peer, {
    type: 'run:update',
    data: {
      runId: run.id,
      state: publicRunState(run),
      result: result.result,
      score,
    },
  });
}

function roomSnapshot(room) {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    challenge: publicChallenge(room.challenge),
    startedAt: room.startedAt,
    players: [...room.players.values()].map(player => ({
      id: player.id,
      username: player.username,
      color: player.color,
      ready: player.ready,
      status: player.run?.status || 'waiting',
      effectiveMs: player.run && player.run.elapsedMs !== null
        ? player.run.elapsedMs + player.run.penaltyMs
        : null,
    })),
  };
}

function broadcastRoom(room, message) {
  for (const player of room.players.values()) {
    if (player.peer) sendJson(player.peer, message);
  }
}

async function createRoom(peer, payload = {}) {
  if (!peer._userId) {
    sendError(peer, 'AUTH_REQUIRED', '登录后才能创建房间');
    return;
  }
  if (peer._roomId) {
    sendError(peer, 'ROOM_EXISTS', '你已经在房间中');
    return;
  }
  const maxPlayers = Math.min(ROOM_MAX_PLAYERS, Math.max(2, Number(payload.maxPlayers) || 2));
  let challenge;
  if (payload.challengeId) {
    challenge = await resolveChallenge(payload.challengeId);
  } else {
    const code = randomBytes(6).toString('base64url').slice(0, ROOM_CODE_LENGTH).toUpperCase();
    const privateChallenge = createPrivateChallenge(`${code}:${randomBytes(24).toString('hex')}`, peer._userId);
    privateChallenge.id = `private-${code}`;
    challenge = await createStoredChallenge(privateChallenge);
  }

  const room = {
    id: randomUUID(),
    code: randomBytes(6).toString('base64url').slice(0, ROOM_CODE_LENGTH).toUpperCase(),
    maxPlayers,
    challenge,
    status: 'lobby',
    startedAt: null,
    players: new Map(),
    countdownTimer: null,
  };
  rooms.set(room.code, room);
  addPlayerToRoom(room, peer);
  sendJson(peer, { type: 'room:created', data: roomSnapshot(room) });
}

function addPlayerToRoom(room, peer) {
  const player = {
    id: peer._userId,
    username: peer._username,
    color: peer._color,
    peer,
    ready: false,
    run: null,
    seq: 0,
  };
  room.players.set(player.id, player);
  peer._roomId = room.code;
  peer._roomPlayerId = player.id;
}

async function joinRoom(peer, payload = {}) {
  if (!peer._userId) {
    sendError(peer, 'AUTH_REQUIRED', '登录后才能加入房间');
    return;
  }
  const code = String(payload.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    sendError(peer, 'ROOM_NOT_FOUND', '房间不存在');
    return;
  }
  const existingPlayer = room.players.get(peer._userId);
  if (existingPlayer) {
    existingPlayer.peer = peer;
    peer._roomId = room.code;
    peer._roomPlayerId = existingPlayer.id;
    sendJson(peer, { type: 'room:state', data: roomSnapshot(room) });
    if (existingPlayer.run && room.status === 'running') {
      sendJson(peer, {
        type: 'run:init',
        data: {
          runId: existingPlayer.run.id,
          challenge: publicChallenge(room.challenge),
          state: publicRunState(existingPlayer.run),
          serverNow: Date.now(),
          authenticated: true,
        },
      });
    }
    return;
  }
  if (room.status !== 'lobby' || room.players.size >= room.maxPlayers) {
    sendError(peer, 'ROOM_FULL', '房间已开始或已满');
    return;
  }
  addPlayerToRoom(room, peer);
  broadcastRoom(room, { type: 'room:state', data: roomSnapshot(room) });
}

async function setRoomReady(peer, ready) {
  const room = rooms.get(peer._roomId);
  const player = room?.players.get(peer._roomPlayerId);
  if (!room || !player || room.status !== 'lobby') return;
  player.ready = Boolean(ready);
  broadcastRoom(room, { type: 'room:state', data: roomSnapshot(room) });
  const readyPlayers = [...room.players.values()].filter(item => item.ready);
  if (readyPlayers.length < 2 || readyPlayers.length !== room.players.size || room.countdownTimer) return;

  room.status = 'countdown';
  room.startedAt = Date.now() + 3_000;
  broadcastRoom(room, { type: 'room:countdown', data: roomSnapshot(room) });
  room.countdownTimer = setTimeout(() => {
    void startRoom(room);
  }, 3_000);
}

async function startRoom(room) {
  room.status = 'running';
  for (const player of room.players.values()) {
    const runId = randomUUID();
    const run = createRun(room.challenge, {
      userId: player.id,
      mode: 'room',
      roomId: room.id,
    });
    run.id = runId;
    run.status = 'running';
    run.startedAt = room.startedAt;
    player.run = run;
    player.seq = 0;
    activeRuns.set(runId, run);
    await createRunRecord({
      id: runId,
      challengeId: room.challenge.id,
      userId: player.id,
      mode: 'room',
      roomId: room.id,
    });
  }
  broadcastRoom(room, { type: 'room:started', data: roomSnapshot(room) });
  for (const player of room.players.values()) {
    if (player.peer) {
      sendJson(player.peer, {
        type: 'run:init',
        data: {
          runId: player.run.id,
          challenge: publicChallenge(room.challenge),
          state: publicRunState(player.run),
          serverNow: Date.now(),
          authenticated: true,
        },
      });
    }
  }
}

async function processRoomAction(peer, payload) {
  const room = rooms.get(peer._roomId);
  const player = room?.players.get(peer._roomPlayerId);
  const action = normalizeAction(payload);
  if (!room || !player || room.status !== 'running' || !player.run || !action) {
    sendError(peer, 'INVALID_ROOM_ACTION', '房间操作无效');
    return;
  }
  if (!consumeActionQuota(peer)) {
    sendError(peer, 'RATE_LIMITED', '操作过于频繁，请稍后再试');
    return;
  }
  if (action.seq !== player.seq + 1) {
    sendError(peer, 'INVALID_SEQUENCE', '操作序号无效');
    return;
  }
  const receivedAt = Date.now();
  const result = applyAction(player.run, action, receivedAt);
  if (!result) return;
  player.seq = action.seq;
  await appendRunAction({
    runId: player.run.id,
    seq: action.seq,
    action: action.action,
    x: action.x,
    y: action.y,
    receivedAt,
    result: { result: result.result, changed: result.changed },
  });

  let score = null;
  if (player.run.status === 'complete') {
    score = await finishRun({
      runId: player.run.id,
      challengeId: player.run.challengeId,
      userId: player.run.userId,
      mode: 'room',
      roomId: room.id,
      run: player.run,
    });
    activeRuns.delete(player.run.id);
    if (room.status === 'running') {
      room.status = 'finished';
      await saveMatchResult({
        id: randomUUID(),
        roomId: room.id,
        challengeId: room.challenge.id,
        winnerUserId: player.id,
        startedAt: room.startedAt,
        finishedAt: Date.now(),
        players: roomSnapshot(room).players,
      });
    }
  }

  sendJson(peer, {
    type: 'run:update',
    data: { runId: player.run.id, state: publicRunState(player.run), result: result.result, score },
  });
  broadcastRoom(room, { type: 'room:state', data: roomSnapshot(room) });
}

export default defineWebSocketHandler({
  open(peer) {
    sendJson(peer, {
      type: 'hello',
      data: {
        product: 'Minesweeper',
        rows: 16,
        cols: 16,
        mines: 40,
        serverNow: Date.now(),
      },
    });
  },

  async message(peer, message) {
    const raw = message.text();
    if (raw.length > MAX_MESSAGE_SIZE) {
      sendError(peer, 'MESSAGE_TOO_LARGE', '消息过大');
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      sendError(peer, 'INVALID_JSON', '消息格式错误');
      return;
    }
    if (!msg || typeof msg.type !== 'string') {
      sendError(peer, 'INVALID_MESSAGE', '消息格式错误');
      return;
    }

    try {
      if (msg.type === 'ping') {
        sendJson(peer, { type: 'pong', payload: { timestamp: msg.payload?.timestamp, serverNow: Date.now() } });
      } else if (msg.type === 'identify') {
        if (!(await identifyPeer(peer, msg.payload?.token))) sendError(peer, 'INVALID_TOKEN', '身份验证失败，请重新登录');
      } else if (msg.type === 'run:start') {
        await startRun(peer, msg.payload);
      } else if (msg.type === 'run:resume') {
        await resumeRun(peer, msg.payload?.runId);
      } else if (msg.type === 'run:action') {
        if (peer._roomId) await processRoomAction(peer, msg.payload);
        else await processRunAction(peer, msg.payload);
      } else if (msg.type === 'room:create') {
        await createRoom(peer, msg.payload);
      } else if (msg.type === 'room:join') {
        await joinRoom(peer, msg.payload);
      } else if (msg.type === 'room:ready') {
        await setRoomReady(peer, msg.payload?.ready);
      } else if (msg.type === 'room:action') {
        await processRoomAction(peer, msg.payload);
      } else {
        sendError(peer, 'UNKNOWN_TYPE', '未知消息类型');
      }
    } catch (error) {
      console.error('[ws] Message handling failed:', error);
      sendError(peer, 'SERVER_ERROR', '服务器暂时无法处理该操作');
    }
  },

  close(peer) {
    if (peer._roomId) {
      const room = rooms.get(peer._roomId);
      const player = room?.players.get(peer._roomPlayerId);
      if (player && player.peer === peer) player.peer = null;
      if (room) broadcastRoom(room, { type: 'room:state', data: roomSnapshot(room) });
    }
    if (peer._runId) {
      const run = activeRuns.get(peer._runId);
      if (run) run.lastDisconnectedAt = Date.now();
    }
  },
});
