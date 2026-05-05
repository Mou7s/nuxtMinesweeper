import { ref, reactive } from 'vue';
import { playPop, playExplosion, playFlag } from './audio.js';

export class GamePlay {
  version = ref(0);
  state = ref({
    flags: 0,
    cameraX: 0,
    cameraY: 0,
    connected: false,
    leaderboard: [],
  });
  
  user = ref(null); // {id, username, score, color}
  blocks = new Map();
  ws = null;

  constructor() {
    // 尝试从本地恢复登录状态
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('minesweeper-user');
      if (savedUser) this.user.value = JSON.parse(savedUser);
    }
    this.connect();
  }

  connect() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws`);

    this.ws.onopen = () => {
      console.log('Connected!');
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
        else if (msg.type === 'error') alert(msg.message);
      } catch (e) {}
    };

    this.ws.onclose = () => {
      this.state.value.connected = false;
      setTimeout(() => this.connect(), 3000);
    };
  }

  sendIdentify() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.user.value) {
      this.ws.send(JSON.stringify({
        type: 'identify',
        payload: { userId: this.user.value.id }
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
    this.version.value++;
  }

  handleUpdate(data) {
    this.state.value.flags = data.state.flags;
    this.state.value.leaderboard = data.state.leaderboard;
    
    // 更新本地玩家分数（如果排行榜里有我）
    if (this.user.value) {
      const me = data.state.leaderboard.find(p => p.username === this.user.value.username);
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
    
    if (playedExplosion) playExplosion();
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

  async login(username, password) {
    try {
      const res = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      if (res.success) {
        this.user.value = res.user;
        localStorage.setItem('minesweeper-user', JSON.stringify(res.user));
        this.sendIdentify();
        return true;
      }
    } catch (e) {
      alert(e.data?.statusMessage || '登录失败');
    }
    return false;
  }

  async register(username, password) {
    try {
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { username, password }
      });
      if (res.success) {
        this.user.value = res.user;
        localStorage.setItem('minesweeper-user', JSON.stringify(res.user));
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
    localStorage.removeItem('minesweeper-user');
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
    return block;
  }

  onClick(block) {
    if (block.flagged || block.revealed) return;
    this.sendAction('click', block.x, block.y);
  }

  onRightClick(block) {
    if (block.revealed) return;
    this.sendAction('rightclick', block.x, block.y);
  }

  autoExpand(block) {
    if (block.flagged || !block.revealed) return;
    this.sendAction('autoexpand', block.x, block.y);
  }

  respawn() {
    this.version.value++;
  }
}
