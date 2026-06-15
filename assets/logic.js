import { ref, reactive } from 'vue';
import { playPop, playExplosion, playFlag, playMistake } from './audio.js';


export class GamePlay {
  version = ref(0);
  state = ref({
    flags: 0,
    cameraX: 0,
    cameraY: 0,
    connected: false,
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
    }
  });

  
  user = ref(null);
  token = ref(null);
  blocks = new Map();
  ws = null;
  reconnectTimer = null;

  constructor() {
    // 尝试从本地恢复登录状态
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('minesweeper-user');
      const savedToken = localStorage.getItem('minesweeper-token');
      if (savedUser) this.user.value = JSON.parse(savedUser);
      if (savedToken) this.token.value = savedToken;
    }
    this.connect();
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
      // 连接成功后立即报到
      if (this.user.value) {
        this.sendIdentify();
      }
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
        } else if (msg.type === 'update') {
          updateCount = msg.data?.updates ? msg.data.updates.length : 0;
          this.handleUpdate(msg.data);
        } else if (msg.type === 'cursor') {
          this.handleCursorUpdate(msg.payload);
        } else if (msg.type === 'error') {
          alert(msg.message);
          if (msg.message.includes('身份验证失败') || msg.message.includes('请先登录')) {
            this.logout();
          }
        }

        const duration = performance.now() - startTime;
        this.state.value.perf.lastWsMsgDuration = duration;

        if (msg.type === 'init' || msg.type === 'update') {
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
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
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
    this.state.value.flags = data.state.flags;
    this.state.value.leaderboard = data.state.leaderboard;
    this.blocks.clear();
    for (const b of data.blocks) {
      this.blocks.set(`${b.x},${b.y}`, reactive(b));
    }
    this.state.value.perf.cachedCells = this.blocks.size;
    this.version.value++;
  }

  handleUpdate(data) {
    this.state.value.flags = data.state.flags;
    this.state.value.leaderboard = data.state.leaderboard;
    
    // 更新本地玩家分数（如果排行榜里有我）
    if (this.user.value) {
      const me = data.state.leaderboard.find((p) => p.username === this.user.value.username);
      if (me) this.user.value.score = me.score;
    }

    let playedExplosion = false;
    let playedPop = false;
    let playedFlag = false;
    let playedMistake = false;
    
    for (const b of data.updates) {
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
        this.blocks.set(key, reactive(b));
      }
    }

    this.state.value.perf.cachedCells = this.blocks.size;
    this.version.value++;
    
    if (playedMistake) playMistake();
    else if (playedExplosion) playExplosion();
    else if (playedPop) playPop();
    else if (playedFlag) playFlag();
  }

  sendAction(action, x, y) {
    if (!this.user.value) {
      alert('请先登录后再操作！');
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'action',
        payload: { action, x, y }
      }));
    }
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

    // 清理过期光标（比如 5 秒没更新的）
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
      alert(e.data?.statusMessage || '登录失败');
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
      alert(e.data?.statusMessage || '注册失败');
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

    const block = reactive({
      x, y,
      mine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
    });
    this.blocks.set(key, block);
    this.state.value.perf.cachedCells = this.blocks.size;
    return block;
  }

  onClick(block) {
    if (block.flagged || block.revealed) return;
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
}
