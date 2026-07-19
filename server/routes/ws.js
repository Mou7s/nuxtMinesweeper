import { globalGameServer } from '../utils/gameLogic';
import { verifyToken } from '../utils/jwt';
import {
  MAX_WORLD_COORD,
  chunkKeyForCell,
  chunkKeysForViewport,
  chunkTopic,
  encodeBlockUpdate,
  groupBlocksByChunk,
  isValidActionPayload,
  normalizeViewport,
} from '../utils/gameProtocol.mjs';

const GLOBAL_TOPIC = 'minesweeper:global';
const MAX_MESSAGE_SIZE = 16 * 1024;
const ACTION_LIMIT = 20;
const ACTION_WINDOW_MS = 1000;
const CURSOR_INTERVAL_MS = 100;
const SNAPSHOT_CHUNKS_PER_PART = 2;

function sendJson(peer, payload) {
  peer.send(JSON.stringify(payload));
}

function publishState(peer) {
  const message = JSON.stringify({
    type: 'state',
    data: { state: globalGameServer.getPublicState() },
  });
  peer.publish(GLOBAL_TOPIC, message);
  sendJson(peer, JSON.parse(message));
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

function isValidCursor(payload) {
  return Boolean(
    payload
    && Number.isFinite(payload.x)
    && Number.isFinite(payload.y)
    && Math.abs(payload.x) <= MAX_WORLD_COORD
    && Math.abs(payload.y) <= MAX_WORLD_COORD,
  );
}

function updateChunkSubscriptions(peer, keys) {
  const nextTopics = new Set(keys.map(chunkTopic));
  const currentTopics = peer._chunkTopics || new Set();

  for (const topic of currentTopics) {
    if (!nextTopics.has(topic)) peer.unsubscribe(topic);
  }
  for (const topic of nextTopics) {
    if (!currentTopics.has(topic)) peer.subscribe(topic);
  }

  peer._chunkTopics = nextTopics;
}

export default defineWebSocketHandler({
  async open(peer) {
    await globalGameServer.ensureInitialized();
    peer.subscribe(GLOBAL_TOPIC);
    peer._chunkTopics = new Set();
    sendJson(peer, {
      type: 'init',
      data: {
        state: globalGameServer.getPublicState(),
        blocks: [],
        chunks: [],
        chunked: true,
      },
    });
  },

  async message(peer, message) {
    const raw = message.text();
    if (raw.length > MAX_MESSAGE_SIZE) {
      sendJson(peer, { type: 'error', code: 'MESSAGE_TOO_LARGE', message: '消息过大' });
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      sendJson(peer, { type: 'error', code: 'INVALID_JSON', message: '消息格式错误' });
      return;
    }

    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      sendJson(peer, { type: 'error', code: 'INVALID_MESSAGE', message: '消息格式错误' });
      return;
    }

    try {
      await globalGameServer.ensureInitialized();

      if (msg.type === 'ping') {
        const timestamp = msg.payload?.timestamp;
        if (Number.isFinite(timestamp)) {
          sendJson(peer, { type: 'pong', payload: { timestamp } });
        }
        return;
      }

      if (msg.type === 'viewport') {
        const viewport = normalizeViewport(msg.payload);
        if (!viewport) {
          sendJson(peer, { type: 'error', code: 'INVALID_VIEWPORT', message: '视野参数无效' });
          return;
        }

        const keys = chunkKeysForViewport(viewport);
        updateChunkSubscriptions(peer, keys);
        const snapshot = await globalGameServer.getSnapshotForChunks(keys);
        const requestId = Number.isInteger(msg.requestId) ? msg.requestId : 0;
        const blocksByChunk = groupBlocksByChunk(snapshot.blocks);

        for (let index = 0; index < keys.length; index += SNAPSHOT_CHUNKS_PER_PART) {
          const partKeys = keys.slice(index, index + SNAPSHOT_CHUNKS_PER_PART);
          const partBlocks = partKeys.flatMap(key => blocksByChunk.get(key) || []);
          const partNumber = Math.floor(index / SNAPSHOT_CHUNKS_PER_PART);
          const partCount = Math.ceil(keys.length / SNAPSHOT_CHUNKS_PER_PART);
          sendJson(peer, {
            type: 'snapshot',
            requestId,
            data: {
              state: snapshot.state,
              blocks: partBlocks.map(encodeBlockUpdate),
              chunks: partKeys,
              allChunks: partNumber === 0 ? keys : undefined,
              replace: partNumber === 0,
              complete: partNumber === partCount - 1,
              format: 'compact-v1',
            },
          });
        }
        return;
      }

      if (msg.type === 'identify') {
        const token = msg.payload?.token;
        if (typeof token !== 'string' || token.length > 4096) {
          sendJson(peer, { type: 'error', code: 'INVALID_TOKEN', message: '身份验证失败，请重新登录' });
          return;
        }

        const payload = verifyToken(token);
        if (!payload) {
          sendJson(peer, { type: 'error', code: 'INVALID_TOKEN', message: '身份验证失败，请重新登录' });
          return;
        }

        if (peer._userId && peer._userId !== payload.userId) {
          globalGameServer.disconnectPlayer(peer._userId, peer.id);
        }

        const player = await globalGameServer.connectPlayer(payload.userId, peer.id);
        if (!player) {
          sendJson(peer, { type: 'error', code: 'UNKNOWN_USER', message: '账号不存在，请重新登录' });
          return;
        }

        peer._userId = payload.userId;
        peer._username = player.username;
        publishState(peer);
        return;
      }

      if (msg.type === 'action') {
        if (!peer._userId) {
          sendJson(peer, { type: 'error', code: 'AUTH_REQUIRED', message: '请先登录后再进行操作' });
          return;
        }
        if (!isValidActionPayload(msg.payload)) {
          sendJson(peer, { type: 'error', code: 'INVALID_ACTION', message: '操作参数无效' });
          return;
        }
        if (!consumeActionQuota(peer)) {
          sendJson(peer, { type: 'error', code: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' });
          return;
        }

        const startedAt = performance.now();
        const { action, x, y } = msg.payload;
        const result = await globalGameServer.processAction(action, x, y, peer._userId);
        const duration = performance.now() - startedAt;
        if (!result) return;

        const actorPayload = JSON.stringify({
          type: 'update',
          data: {
            ...result,
            updates: result.updates.map(encodeBlockUpdate),
            actorId: peer._userId,
            format: 'compact-v1',
          },
        });
        sendJson(peer, JSON.parse(actorPayload));

        for (const [key, updates] of groupBlocksByChunk(result.updates)) {
          peer.publish(chunkTopic(key), JSON.stringify({
            type: 'update',
            data: {
              state: result.state,
              updates: updates.map(encodeBlockUpdate),
              actorId: peer._userId,
              truncated: result.truncated,
              format: 'compact-v1',
            },
          }));
        }

        peer.publish(GLOBAL_TOPIC, JSON.stringify({
          type: 'state',
          data: { state: result.state },
        }));

        if (actorPayload.length > 100 * 1024 || result.updates.length > 500 || duration > 50) {
          console.warn(
            `[ws-perf-server] ${action}: ${result.updates.length} cells, `
            + `${(actorPayload.length / 1024).toFixed(1)}KB, ${duration.toFixed(1)}ms`,
          );
        }
        return;
      }

      if (msg.type === 'cursor') {
        if (!peer._userId || !isValidCursor(msg.payload)) return;
        const now = Date.now();
        if (now - (peer._lastCursorAt || 0) < CURSOR_INTERVAL_MS) return;
        peer._lastCursorAt = now;

        const player = globalGameServer.players.get(peer._userId);
        peer.publish(chunkTopic(chunkKeyForCell(msg.payload.x, msg.payload.y)), JSON.stringify({
          type: 'cursor',
          payload: {
            userId: peer._userId,
            username: peer._username || peer._userId,
            x: msg.payload.x,
            y: msg.payload.y,
            color: player?.color || '#3b82f6',
          },
        }));
        return;
      }

      sendJson(peer, { type: 'error', code: 'UNKNOWN_TYPE', message: '未知消息类型' });
    } catch (error) {
      console.error('[ws] Message handling failed:', error);
      sendJson(peer, { type: 'error', code: 'SERVER_ERROR', message: '服务器暂时无法处理该操作' });
    }
  },

  close(peer) {
    if (peer._userId && globalGameServer.disconnectPlayer(peer._userId, peer.id)) {
      const payload = JSON.stringify({
        type: 'state',
        data: { state: globalGameServer.getPublicState() },
      });
      peer.publish(GLOBAL_TOPIC, payload);
    }
  },
});
