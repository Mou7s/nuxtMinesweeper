import { ref, reactive } from 'vue';
import { playPop, playExplosion, playFlag } from './audio.js';

export interface User {
  id: string;
  username: string;
  score: number;
  color: string;
}

export interface LeaderboardItem {
  username: string;
  score: number;
  color: string;
}

export interface GameState {
  flags: number;
  cameraX: number;
  cameraY: number;
  connected: boolean;
  leaderboard: LeaderboardItem[];
  cursors: Record<string, { username: string, x: number, y: number, color: string, lastUpdate: number }>;
}


export class GamePlay {
  version = ref(0);
  state = ref<GameState>({
    flags: 0,
    cameraX: 0,
    cameraY: 0,
    connected: false,
    leaderboard: [],
    cursors: {},
  });

  
  user = ref<User | null>(null);
  token = ref<string | null>(null);
  blocks = new Map<string, any>();
  ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') this.handleInit(msg.data);
        else if (msg.type === 'update') this.handleUpdate(msg.data);
        else if (msg.type === 'cursor') this.handleCursorUpdate(msg.payload);
        else if (msg.type === 'error') {
          alert(msg.message);
          if (msg.message.includes('身份验证失败') || msg.message.includes('请先登录')) {
            this.logout();
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

  handleInit(data: any) {
    this.state.value.flags = data.state.flags;
    this.state.value.leaderboard = data.state.leaderboard;
    this.blocks.clear();
    for (const b of data.blocks) {
      this.blocks.set(`${b.x},${b.y}`, reactive(b));
    }
    this.version.value++;
  }

  handleUpdate(data: any) {
    this.state.value.flags = data.state.flags;
    this.state.value.leaderboard = data.state.leaderboard;
    
    // 更新本地玩家分数（如果排行榜里有我）
    if (this.user.value) {
      const me = data.state.leaderboard.find((p: LeaderboardItem) => p.username === this.user.value!.username);
      if (me) this.user.value.score = me.score;
    }

    let playedExplosion = false;
    let playedPop = false;
    let playedFlag = false;
    
    for (const b of data.updates) {
      const key = `${b.x},${b.y}`;
      const oldBlock = this.blocks.get(key);
      
      if (!oldBlock || (!oldBlock.revealed && b.revealed)) {
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

    this.version.value++;
    
    if (playedExplosion) playExplosion();
    else if (playedPop) playPop();
    else if (playedFlag) playFlag();
  }

  sendAction(action: string, x: number, y: number) {
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
  
  handleCursorUpdate(payload: any) {
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

  sendCursor(x: number, y: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.user.value) {
      this.ws.send(JSON.stringify({
        type: 'cursor',
        payload: { x, y }
      }));
    }
  }

  async login(username: string, password: string) {

    try {
      const res: any = await $fetch('/api/auth/login', {
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
    } catch (e: any) {
      alert(e.data?.statusMessage || '登录失败');
    }
    return false;
  }

  async register(username: string, password: string, color: string) {
    try {
      const res: any = await $fetch('/api/auth/register', {
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
    } catch (e: any) {
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

  getBlock(x: number, y: number) {
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
    return block;
  }

  onClick(block: any) {
    if (block.flagged || block.revealed) return;
    this.sendAction('click', block.x, block.y);
  }

  onRightClick(block: any) {
    if (block.revealed) return;
    this.sendAction('rightclick', block.x, block.y);
  }

  autoExpand(block: any) {
    if (block.flagged || !block.revealed) return;
    this.sendAction('autoexpand', block.x, block.y);
  }

  respawn() {
    this.version.value++;
  }
}
