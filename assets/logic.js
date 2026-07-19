import { ref } from 'vue';
import { playPop, playExplosion, playFlag, playMistake } from './audio.js';
import { decodeBlockUpdate, viewportChunkSignature } from './gameProtocol.mjs';


export class GamePlay {
  version = ref(0);
  state = ref({
    flags: 0,
    cameraX: 0,
    cameraY: 0,
    connected: false,
    onlineCount: 0,
    leaderboard: [],
    cursors: {},
    perf: {
      fps: 0,
      visibleCells: 0,
      cachedCells: 0,
      lastWsMsgSize: 0,
      lastUpdateCellCount: 0,
      lastWsMsgDuration: 0,
      drawTime: 0,
      latency: 0,
    }
  });

  
  user = ref(null);
  token = ref(null);
  blocks = new Map();
  ws = null;
  reconnectTimer = null;
  viewportTimer = null;
  viewport = { x: 0, y: 0, cols: 20, rows: 15 };
  viewportSignature = '';
  viewportRequestId = 0;
  latestSnapshotRequestId = 0;
  loadedChunks = new Set();
  pendingSnapshot = null;
  cursorCleanupTimer = null;
  pingTimer = null;
  destroyed = false;

  constructor(options = {}) {
    this.noticeHandler = options.notify || ((message) => alert(message));
    this.authRequiredHandler = options.onAuthRequired || null;
    // 尝试从本地恢复登录状态
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('minesweeper-user');
      const savedToken = localStorage.getItem('minesweeper-token');
      if (savedUser) this.user.value = JSON.parse(savedUser);
      if (savedToken) this.token.value = savedToken;
    }
    if (typeof window !== 'undefined') {
      this.cursorCleanupTimer = setInterval(() => this.cleanupCursors(), 1000);
    }
    this.connect();
  }

  showNotice(message, color = 'error') {
    this.noticeHandler(message, color);
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws`);

    this.ws.onopen = () => {
      this.state.value.connected = true;
      if (this.user.value) {
        this.sendIdentify();
      }
      this.sendViewport(true);
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const startTime = performance.now();
      const rawLength = typeof event.data === 'string' ? event.data.length : 0;
      this.state.value.perf.lastWsMsgSize = rawLength;

      try {
        const msg = JSON.parse(event.data);
        
        let updateCount = 0;
        if (msg.type === 'init') {
          updateCount = msg.data?.blocks ? msg.data.blocks.length : 0;
          this.handleInit(msg.data);
        } else if (msg.type === 'snapshot') {
          updateCount = msg.data?.blocks ? msg.data.blocks.length : 0;
          this.handleSnapshot(msg.data, msg.requestId);
        } else if (msg.type === 'update') {
          updateCount = msg.data?.updates ? msg.data.updates.length : 0;
          this.handleUpdate(msg.data);
        } else if (msg.type === 'state') {
          this.handleState(msg.data?.state);
        } else if (msg.type === 'cursor') {
          this.handleCursorUpdate(msg.payload);
        } else if (msg.type === 'pong') {
          this.state.value.perf.latency = Math.max(0, Date.now() - msg.payload.timestamp);
        } else if (msg.type === 'error') {
          this.showNotice(msg.message, msg.code === 'RATE_LIMITED' ? 'warning' : 'error');
          if (['INVALID_TOKEN', 'UNKNOWN_USER'].includes(msg.code)) {
            this.logout();
          }
        }

        const duration = performance.now() - startTime;
        this.state.value.perf.lastWsMsgDuration = duration;

        if (msg.type === 'init' || msg.type === 'snapshot' || msg.type === 'update') {
          this.state.value.perf.lastUpdateCellCount = updateCount;

          if (rawLength > 100 * 1024) {
            console.warn(`[ws-perf-client] Large message received: ${msg.type}, size: ${(rawLength / 1024).toFixed(2)}KB (exceeds 100KB)`);
          }
          if (updateCount > 500) {
            console.warn(`[ws-perf-client] Large update received: ${msg.type}, cells updated: ${updateCount} (exceeds 500)`);
          }
          if (duration > 50) {
            console.warn(`[ws-perf-client] Slow message processing: ${msg.type}, took: ${duration.toFixed(2)}ms (exceeds 50ms)`);
          }
        }
      } catch (e) {
        console.warn('[ws] Failed to parse message', e);
      }
    };

    this.ws.onclose = () => {
      this.state.value.connected = false;
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (!this.destroyed) this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.state.value.connected = false;
    };
  }

  sendIdentify() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.token.value) {
      this.ws.send(JSON.stringify({
        type: 'identify',
        payload: { token: this.token.value }
      }));
    }
  }

  handleInit(data) {
    this.handleState(data.state);
    this.blocks.clear();
    this.loadedChunks = new Set(data.chunks || []);
    for (const b of data.blocks || []) this.blocks.set(`${b.x},${b.y}`, { ...b });
    this.state.value.perf.cachedCells = this.blocks.size;
    this.version.value++;
  }

  handleSnapshot(data, requestId = 0) {
    if (requestId < this.viewportRequestId || requestId < this.latestSnapshotRequestId) return;
    this.handleState(data.state);

    if (data.replace || !this.pendingSnapshot || this.pendingSnapshot.requestId !== requestId) {
      this.pendingSnapshot = {
        requestId,
        chunks: new Set(data.allChunks || data.chunks || []),
        blocks: new Map(),
      };
    }

    for (const rawBlock of data.blocks || []) {
      const block = decodeBlockUpdate(rawBlock);
      this.pendingSnapshot.blocks.set(`${block.x},${block.y}`, block);
    }

    if (!data.complete) return;

    this.latestSnapshotRequestId = requestId;
    this.blocks = this.pendingSnapshot.blocks;
    this.loadedChunks = this.pendingSnapshot.chunks;
    this.pendingSnapshot = null;
    this.state.value.perf.cachedCells = this.blocks.size;
    this.version.value++;
  }

  handleState(state) {
    if (!state) return;
    this.state.value.flags = state.flags ?? this.state.value.flags;
    this.state.value.leaderboard = state.leaderboard || [];
    this.state.value.onlineCount = state.onlineCount ?? this.state.value.onlineCount;

    if (this.user.value) {
      const me = this.state.value.leaderboard.find(player => player.username === this.user.value.username);
      if (me) {
        this.user.value.score = me.score;
        localStorage.setItem('minesweeper-user', JSON.stringify(this.user.value));
      }
    }
  }

  handleUpdate(data) {
    this.handleState(data.state);

    let playedExplosion = false;
    let playedPop = false;
    let playedFlag = false;
    let playedMistake = false;
    
    const isMyAction = this.user.value && data.actorId === this.user.value.id;
    if (isMyAction && Number.isFinite(data.actorScore)) {
      this.user.value.score = data.actorScore;
      localStorage.setItem('minesweeper-user', JSON.stringify(this.user.value));
    }

    for (const rawUpdate of data.updates) {
      const b = decodeBlockUpdate(rawUpdate);
      const key = `${b.x},${b.y}`;
      const oldBlock = this.blocks.get(key);
      
      if (b.mistake) {
        playedMistake = true;
      } else if (!oldBlock || (!oldBlock.revealed && b.revealed)) {
        if (b.mine) playedExplosion = true;
        else playedPop = true;
      } else if (!oldBlock || (oldBlock.flagged !== b.flagged)) {
        playedFlag = true;
      }
      
      if (this.blocks.has(key)) {
        Object.assign(this.blocks.get(key), b);
      } else {
        this.blocks.set(key, { ...b });
      }
      if (this.pendingSnapshot?.chunks.has(`${Math.floor(b.x / 32)},${Math.floor(b.y / 32)}`)) {
        this.pendingSnapshot.blocks.set(key, { ...b });
      }
    }

    this.state.value.perf.cachedCells = this.blocks.size;
    this.version.value++;
    
    if (playedMistake) playMistake();
    else if (playedExplosion) playExplosion();
    else if (!isMyAction) {
      if (playedPop) playPop();
      else if (playedFlag) playFlag();
    }
  }

  sendAction(action, x, y) {
    if (!this.user.value) {
      this.showNotice('请先登录后再操作', 'warning');
      this.authRequiredHandler?.();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'action',
        payload: { action, x, y }
      }));
    }
  }

  setViewport(x, y, cols, rows) {
    const next = {
      x: Math.trunc(x),
      y: Math.trunc(y),
      cols: Math.max(1, Math.ceil(cols)),
      rows: Math.max(1, Math.ceil(rows)),
    };
    const signature = viewportChunkSignature(next);
    if (signature === this.viewportSignature) return;

    this.viewport = next;
    this.viewportSignature = signature;
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    this.viewportTimer = setTimeout(() => {
      this.viewportTimer = null;
      this.sendViewport();
    }, 100);
  }

  sendViewport(force = false) {
    if (!force && !this.viewportSignature) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.viewportRequestId++;
    this.ws.send(JSON.stringify({
      type: 'viewport',
      requestId: this.viewportRequestId,
      payload: this.viewport,
    }));
  }

  startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const ping = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', payload: { timestamp: Date.now() } }));
      }
    };
    ping();
    this.pingTimer = setInterval(ping, 10_000);
  }
  
  handleCursorUpdate(payload) {
    if (this.user.value && payload.userId === this.user.value.id) return;
    
    this.state.value.cursors[payload.userId] = {
      username: payload.username || payload.userId,
      x: payload.x,
      y: payload.y,
      color: payload.color,
      lastUpdate: Date.now()
    };

    this.cleanupCursors();
  }

  cleanupCursors() {
    const now = Date.now();
    for (const id in this.state.value.cursors) {
      const cursor = this.state.value.cursors[id];
      if (cursor && now - cursor.lastUpdate > 5000) {
        delete this.state.value.cursors[id];
      }
    }
  }

  sendCursor(x, y) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.user.value) {
      this.ws.send(JSON.stringify({
        type: 'cursor',
        payload: { x, y }
      }));
    }
  }

  async login(username, password) {

    try {
      const res = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      if (res.success) {
        this.user.value = res.user;
        this.token.value = res.token;
        localStorage.setItem('minesweeper-user', JSON.stringify(res.user));
        localStorage.setItem('minesweeper-token', res.token);
        this.sendIdentify();
        return true;
      }
    } catch (e) {
      this.showNotice(e.data?.statusMessage || '登录失败');
    }
    return false;
  }

  async register(username, password, color) {
    try {
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { username, password, color }
      });
      if (res.success) {
        this.user.value = res.user;
        this.token.value = res.token;
        localStorage.setItem('minesweeper-user', JSON.stringify(res.user));
        localStorage.setItem('minesweeper-token', res.token);
        this.sendIdentify();
        return true;
      }
    } catch (e) {
      this.showNotice(e.data?.statusMessage || '注册失败');
    }
    return false;
  }

  logout() {
    this.user.value = null;
    this.token.value = null;
    localStorage.removeItem('minesweeper-user');
    localStorage.removeItem('minesweeper-token');
    window.location.reload();
  }

  getBlock(x, y) {
    const key = `${x},${y}`;
    if (this.blocks.has(key)) return this.blocks.get(key);

    const block = {
      x, y,
      mine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
      ephemeral: true,
    };
    this.blocks.set(key, block);
    this.state.value.perf.cachedCells = this.blocks.size;
    return block;
  }

  onClick(block) {
    if (block.flagged) return;
    if (block.revealed) {
      this.autoExpand(block);
      return;
    }
    if (this.user.value) playPop();
    this.sendAction('click', block.x, block.y);
  }

  onRightClick(block) {
    if (block.revealed) return;
    playFlag();
    this.sendAction('rightclick', block.x, block.y);
  }

  autoExpand(block) {
    if (block.flagged || !block.revealed) return;
    if (this.user.value) playPop();
    this.sendAction('autoexpand', block.x, block.y);
  }

  respawn() {
    this.version.value++;
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    if (this.cursorCleanupTimer) clearInterval(this.cursorCleanupTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}
