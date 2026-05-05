import { ref, reactive } from 'vue';
import { playPop, playExplosion, playFlag } from './audio.js';

export class GamePlay {
  version = ref(0);
  state = ref({
    score: 0,
    flags: 0,
    cameraX: 0,
    cameraY: 0,
    connected: false,
  });
  
  blocks = new Map(); // stores x,y -> Block
  ws = null;

  constructor() {
    this.connect();
  }

  connect() {
    // 仅在客户端（浏览器环境）发起 WebSocket 连接
    if (typeof window === 'undefined') return;

    // 动态获取当前域名进行 WebSocket 连接
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws`);

    this.ws.onopen = () => {
      console.log('Connected to Multiplayer Server!');
      this.state.value.connected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          this.handleInit(msg.data);
        } else if (msg.type === 'update') {
          this.handleUpdate(msg.data);
        }
      } catch (e) {
        console.error('WS Error:', e);
      }
    };

    this.ws.onclose = () => {
      this.state.value.connected = false;
      console.log('Disconnected. Reconnecting in 3s...');
      setTimeout(() => this.connect(), 3000);
    };
  }

  handleInit(data) {
    this.state.value.score = data.state.score;
    this.state.value.flags = data.state.flags;
    
    this.blocks.clear();
    for (const b of data.blocks) {
      this.blocks.set(`${b.x},${b.y}`, reactive(b));
    }
    this.version.value++;
  }

  handleUpdate(data) {
    this.state.value.score = data.state.score;
    this.state.value.flags = data.state.flags;
    
    let playedExplosion = false;
    let playedPop = false;
    let playedFlag = false;
    
    for (const b of data.updates) {
      const key = `${b.x},${b.y}`;
      const oldBlock = this.blocks.get(key);
      
      // 判断方块状态的变化以决定播放什么声音
      if (!oldBlock || (!oldBlock.revealed && b.revealed)) {
        if (b.mine) playedExplosion = true;
        else playedPop = true;
      } else if (!oldBlock || (oldBlock.flagged !== b.flagged)) {
        playedFlag = true;
      }
      
      if (this.blocks.has(key)) {
        // 更新已存在的格子
        Object.assign(this.blocks.get(key), b);
      } else {
        // 新格子
        this.blocks.set(key, reactive(b));
      }
    }
    
    // 播放音效（优先级：爆炸 > 翻开 > 插旗）
    if (playedExplosion) playExplosion();
    else if (playedPop) playPop();
    else if (playedFlag) playFlag();
  }

  sendAction(action, x, y) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'action',
        payload: { action, x, y }
      }));
    }
  }

  // 渲染时获取格子。如果是没开过的格子，客户端直接“捏造”一个全灰色的假数据
  // 完美防作弊，因为客户端根本不知道地下有没有雷
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

  // 笑脸重生：直接在客户端改变镜头坐标
  respawn() {
    this.version.value++;
  }
}
