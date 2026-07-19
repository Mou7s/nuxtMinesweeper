import { globalUserStore } from './userStore';
import {
  MAX_ACTION_UPDATES,
  cellKey,
  chunkKeyForCell,
  groupBlocksByChunk,
  parseChunkKey,
} from './gameProtocol.mjs';
import { DIRECTIONS, adjacentMineCount, isMineAt } from './mineGenerator.mjs';

const WRONG_FLAG_PENALTY = -3;
const WORLD_STATE_KEY = import.meta.env.WORLD_STATE_KEY || (import.meta.dev ? 'world-dev.json' : 'world.json');
const WORLD_V2_PREFIX = `world-v2:${WORLD_STATE_KEY}`;
const META_KEY = `${WORLD_V2_PREFIX}:meta`;
const CHUNK_KEY_PREFIX = `${WORLD_V2_PREFIX}:chunk:`;
const MAX_CACHED_CHUNKS = 256;

function createInitialState() {
  return {
    seed: Math.random().toString(36).substring(2, 8),
    flags: 0,
    startTime: Date.now(),
    leaderboard: [],
  };
}

export class GameServer {
  constructor(options = {}) {
    this.state = createInitialState();
    this.chunks = new Map();
    this.chunkLoads = new Map();
    this.players = new Map();
    this.playerConnections = new Map();
    this.currentTickUpdates = new Map();
    this.pendingScoreDeltas = new Map();
    this.initialized = false;
    this.initializationPromise = null;
    this.saveTimeout = null;
    this.scoreSaveTimeout = null;
    this.metaDirty = false;
    this.getStorage = options.getStorage || (() => useStorage('kv'));
    this.userStore = options.userStore || globalUserStore;
  }

  async ensureInitialized() {
    if (this.initialized) return;
    if (!this.initializationPromise) {
      this.initializationPromise = this.load().then(() => {
        this.initialized = true;
      });
    }
    await this.initializationPromise;
  }

  async load() {
    const storage = this.getStorage();

    try {
      const metadata = await storage.getItem(META_KEY);
      if (metadata?.state) {
        this.state = {
          ...createInitialState(),
          ...metadata.state,
          leaderboard: [],
        };
        console.log(`[GameServer] Loaded chunked world metadata from ${META_KEY}.`);
        return;
      }

      const legacy = await storage.getItem(WORLD_STATE_KEY);
      if (!legacy?.state || !Array.isArray(legacy.blocks)) return;

      this.state = {
        ...createInitialState(),
        ...legacy.state,
        leaderboard: [],
      };

      const groups = groupBlocksByChunk(legacy.blocks);
      for (const [key, blocks] of groups) {
        const coords = parseChunkKey(key);
        if (!coords) continue;
        this.chunks.set(key, {
          key,
          ...coords,
          blocks: new Map(blocks.map(block => [cellKey(block.x, block.y), block])),
          lastAccess: Date.now(),
          version: 1,
          dirty: true,
        });
      }

      this.metaDirty = true;
      await this.flushWorld();
      console.log(`[GameServer] Migrated ${legacy.blocks.length} legacy cells into ${groups.size} chunks.`);
    } catch (error) {
      console.error('[GameServer] Failed to load world state:', error);
    }
  }

  storageKeyForChunk(key) {
    return `${CHUNK_KEY_PREFIX}${key}`;
  }

  async loadChunkByKey(key) {
    const cached = this.chunks.get(key);
    if (cached) {
      cached.lastAccess = Date.now();
      return cached;
    }

    if (this.chunkLoads.has(key)) return this.chunkLoads.get(key);

    const loading = (async () => {
      const coords = parseChunkKey(key);
      if (!coords) throw new Error(`Invalid chunk key: ${key}`);

      let stored;
      try {
        stored = await this.getStorage().getItem(this.storageKeyForChunk(key));
      } catch (error) {
        console.error(`[GameServer] Failed to load chunk ${key}:`, error);
      }

      const blocks = Array.isArray(stored) ? stored : stored?.blocks;
      const chunk = {
        key,
        ...coords,
        blocks: new Map((blocks || []).map(block => [cellKey(block.x, block.y), block])),
        lastAccess: Date.now(),
        version: 0,
        dirty: false,
      };
      this.chunks.set(key, chunk);
      this.chunkLoads.delete(key);
      return chunk;
    })();

    this.chunkLoads.set(key, loading);
    return loading;
  }

  async getBlock(x, y) {
    const key = chunkKeyForCell(x, y);
    const chunk = await this.loadChunkByKey(key);
    const keyForCell = cellKey(x, y);
    if (chunk.blocks.has(keyForCell)) return chunk.blocks.get(keyForCell);

    const mine = isMineAt(x, y, this.state.seed);
    const block = {
      x,
      y,
      mine,
      adjacentMines: mine ? 0 : adjacentMineCount(x, y, this.state.seed),
      revealed: false,
      flagged: false,
    };
    chunk.blocks.set(keyForCell, block);
    return block;
  }

  async getNeighbors(block) {
    return Promise.all(DIRECTIONS.map(([offsetX, offsetY]) => (
      this.getBlock(block.x + offsetX, block.y + offsetY)
    )));
  }

  markUpdated(block) {
    const keyForCell = cellKey(block.x, block.y);
    const keyForChunk = chunkKeyForCell(block.x, block.y);
    const chunk = this.chunks.get(keyForChunk);
    if (!chunk) throw new Error(`Chunk ${keyForChunk} was not loaded before update.`);

    this.currentTickUpdates.set(keyForCell, { ...block });
    chunk.dirty = true;
    chunk.version++;
    chunk.lastAccess = Date.now();
  }

  applyScoreDelta(userId, delta) {
    if (!delta) return;
    const player = this.players.get(userId);
    if (!player) return;

    player.score += delta;
    player.lastActive = Date.now();
    this.pendingScoreDeltas.set(userId, (this.pendingScoreDeltas.get(userId) || 0) + delta);
    this.updateLeaderboard();
    this.scheduleScoreSave();
  }

  scheduleScoreSave() {
    if (this.scoreSaveTimeout) clearTimeout(this.scoreSaveTimeout);
    this.scoreSaveTimeout = setTimeout(() => {
      this.scoreSaveTimeout = null;
      void this.flushScoreDeltas();
    }, 500);
  }

  async flushScoreDeltas() {
    if (this.pendingScoreDeltas.size === 0) return;

    const deltas = Array.from(this.pendingScoreDeltas.entries());
    this.pendingScoreDeltas.clear();

    await Promise.all(deltas.map(async ([userId, delta]) => {
      try {
        await this.userStore.updateScore(userId, delta);
      } catch (error) {
        console.error(`[GameServer] Failed to persist score for ${userId}:`, error);
        this.pendingScoreDeltas.set(userId, (this.pendingScoreDeltas.get(userId) || 0) + delta);
      }
    }));

    if (this.pendingScoreDeltas.size) this.scheduleScoreSave();
  }

  updateLeaderboard() {
    this.state.leaderboard = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(player => ({
        username: player.username,
        score: player.score,
        color: player.color,
      }));
  }

  async connectPlayer(userId, connectionId) {
    const user = await this.userStore.getUserById(userId);
    if (!user) return null;

    if (!this.players.has(userId)) {
      this.players.set(userId, {
        id: user.id,
        username: user.username,
        color: user.color,
        score: user.score,
        lastActive: Date.now(),
      });
    }

    if (!this.playerConnections.has(userId)) this.playerConnections.set(userId, new Set());
    this.playerConnections.get(userId).add(connectionId);
    this.updateLeaderboard();
    return this.players.get(userId);
  }

  disconnectPlayer(userId, connectionId) {
    const connections = this.playerConnections.get(userId);
    if (!connections) return false;

    connections.delete(connectionId);
    if (connections.size) return false;

    this.playerConnections.delete(userId);
    this.players.delete(userId);
    this.updateLeaderboard();
    return true;
  }

  async revealZeroArea(startBlock, userId) {
    if (startBlock.adjacentMines) return 0;

    let scoreDelta = 0;
    const queue = [startBlock];
    let queueIndex = 0;

    while (queueIndex < queue.length && this.currentTickUpdates.size < MAX_ACTION_UPDATES) {
      const current = queue[queueIndex++];
      const neighbors = await this.getNeighbors(current);

      for (const neighbor of neighbors) {
        if (this.currentTickUpdates.size >= MAX_ACTION_UPDATES) break;
        if (neighbor.revealed || neighbor.flagged) continue;

        neighbor.revealed = true;
        neighbor.ownerId = userId;
        neighbor.ownerColor = this.players.get(userId)?.color;
        this.markUpdated(neighbor);
        scoreDelta++;
        if (!neighbor.mine && !neighbor.adjacentMines) queue.push(neighbor);
      }
    }

    return scoreDelta;
  }

  async processAction(action, x, y, userId) {
    if (!userId || !this.players.has(userId)) return null;

    this.currentTickUpdates.clear();
    const block = await this.getBlock(x, y);
    let scoreDelta = 0;

    if (action === 'click') {
      if (block.flagged || block.revealed) return null;

      block.revealed = true;
      block.ownerId = userId;
      block.ownerColor = this.players.get(userId)?.color;
      this.markUpdated(block);

      if (block.mine) scoreDelta -= 10;
      else {
        scoreDelta++;
        scoreDelta += await this.revealZeroArea(block, userId);
      }
    } else if (action === 'rightclick') {
      if (block.revealed) return null;

      if (!block.flagged && !block.mine) {
        block.revealed = true;
        block.ownerId = userId;
        block.ownerColor = this.players.get(userId)?.color;
        block.mistake = true;
        this.markUpdated(block);
        delete block.mistake;
        scoreDelta += WRONG_FLAG_PENALTY;
      } else {
        block.flagged = !block.flagged;
        if (block.flagged) {
          block.flagOwnerId = userId;
          block.flagOwnerColor = this.players.get(userId)?.color;
          this.state.flags++;
        } else {
          delete block.flagOwnerId;
          delete block.flagOwnerColor;
          this.state.flags--;
        }
        this.metaDirty = true;
        this.markUpdated(block);
      }
    } else if (action === 'autoexpand') {
      if (block.flagged || !block.revealed) return null;
      const neighbors = await this.getNeighbors(block);
      const flagCount = neighbors.filter(neighbor => neighbor.flagged).length;
      if (flagCount !== block.adjacentMines) return null;

      for (const neighbor of neighbors) {
        if (this.currentTickUpdates.size >= MAX_ACTION_UPDATES) break;
        if (neighbor.revealed || neighbor.flagged) continue;

        neighbor.revealed = true;
        neighbor.ownerId = userId;
        neighbor.ownerColor = this.players.get(userId)?.color;
        this.markUpdated(neighbor);

        if (neighbor.mine) scoreDelta -= 10;
        else {
          scoreDelta++;
          scoreDelta += await this.revealZeroArea(neighbor, userId);
        }
      }
    }

    return this.finishAction(userId, scoreDelta);
  }

  finishAction(userId, scoreDelta) {
    if (this.currentTickUpdates.size === 0) return null;

    this.applyScoreDelta(userId, scoreDelta);
    this.scheduleWorldSave();

    return {
      state: this.getPublicState(),
      updates: Array.from(this.currentTickUpdates.values()),
      truncated: this.currentTickUpdates.size >= MAX_ACTION_UPDATES,
      actorScore: this.players.get(userId)?.score,
    };
  }

  getPublicState() {
    return {
      flags: this.state.flags,
      startTime: this.state.startTime,
      leaderboard: this.state.leaderboard,
      onlineCount: this.playerConnections.size,
    };
  }

  async getSnapshotForChunks(keys) {
    const uniqueKeys = [...new Set(keys)];
    const chunks = await Promise.all(uniqueKeys.map(key => this.loadChunkByKey(key)));
    const blocks = [];

    for (const chunk of chunks) {
      for (const block of chunk.blocks.values()) {
        if (block.revealed || block.flagged) blocks.push(block);
      }
    }

    this.pruneChunkCache(new Set(uniqueKeys));
    return {
      state: this.getPublicState(),
      blocks,
      chunks: uniqueKeys,
    };
  }

  scheduleWorldSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      void this.flushWorld();
    }, 2000);
  }

  async flushWorld() {
    const storage = this.getStorage();
    const dirtyChunks = Array.from(this.chunks.values()).filter(chunk => chunk.dirty);
    const startedAt = performance.now();

    await Promise.all(dirtyChunks.map(async (chunk) => {
      try {
        const version = chunk.version;
        const blocks = Array.from(chunk.blocks.values()).filter(block => block.revealed || block.flagged);
        await storage.setItem(this.storageKeyForChunk(chunk.key), { blocks });
        if (chunk.version === version) chunk.dirty = false;
      } catch (error) {
        console.error(`[GameServer] Failed to save chunk ${chunk.key}:`, error);
      }
    }));

    if (this.metaDirty || dirtyChunks.length) {
      try {
        await storage.setItem(META_KEY, {
          state: {
            seed: this.state.seed,
            flags: this.state.flags,
            startTime: this.state.startTime,
          },
        });
        this.metaDirty = false;
      } catch (error) {
        this.metaDirty = true;
        console.error('[GameServer] Failed to save world metadata:', error);
      }
    }

    const duration = performance.now() - startedAt;
    if (duration > 50 || dirtyChunks.length > 10) {
      console.warn(`[GameServer] Saved ${dirtyChunks.length} chunks in ${duration.toFixed(1)}ms.`);
    }

    if (this.metaDirty || Array.from(this.chunks.values()).some(chunk => chunk.dirty)) {
      this.scheduleWorldSave();
    }
    this.pruneChunkCache();
  }

  pruneChunkCache(protectedKeys = new Set()) {
    if (this.chunks.size <= MAX_CACHED_CHUNKS) return;

    const candidates = Array.from(this.chunks.values())
      .filter(chunk => !chunk.dirty && !protectedKeys.has(chunk.key))
      .sort((a, b) => a.lastAccess - b.lastAccess);

    const removeCount = this.chunks.size - MAX_CACHED_CHUNKS;
    for (const chunk of candidates.slice(0, removeCount)) this.chunks.delete(chunk.key);
  }
}

export const globalGameServer = new GameServer();
