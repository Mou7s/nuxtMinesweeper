import { ref } from 'vue';
import { playExplosion, playFlag, playPop } from './audio.js';

export class GamePlay {
  version = ref(0);
  state = ref({
    connected: false,
    serverOffset: 0,
    challenge: null,
    run: null,
    leaderboard: [],
    leaderboardMe: null,
    room: null,
    notice: null,
  });

  user = ref(null);
  token = ref(null);
  ws = null;
  reconnectTimer = null;
  pingTimer = null;
  ticker = null;
  destroyed = false;
  seq = 0;
  noticeHandler;
  authRequiredHandler;

  constructor(options = {}) {
    this.noticeHandler = options.notify || ((message) => alert(message));
    this.authRequiredHandler = options.onAuthRequired || null;
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('minesweeper-user');
        const savedToken = localStorage.getItem('minesweeper-token');
        if (savedUser) this.user.value = JSON.parse(savedUser);
        if (savedToken) this.token.value = savedToken;
      } catch {
        this.user.value = null;
        this.token.value = null;
      }
      this.ticker = setInterval(() => { this.version.value++; }, 250);
    }
    this.connect();
  }

  showNotice(message, color = 'error') {
    this.noticeHandler(message, color);
  }

  connect() {
    if (typeof window === 'undefined' || this.destroyed) return;
    if (this.ws && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.ws.readyState)) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    this.ws.onopen = () => {
      this.state.value.connected = true;
      this.sendIdentify();
      this.startHeartbeat();
    };
    this.ws.onclose = () => {
      this.state.value.connected = false;
      if (!this.destroyed) this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.ws.onerror = () => { this.state.value.connected = false; };
    this.ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleMessage(message);
    };
  }

  handleMessage(message) {
    const data = message.data || {};
    if (message.type === 'hello') {
      this.setServerOffset(data.serverNow);
    } else if (message.type === 'pong') {
      this.setServerOffset(data.serverNow);
    } else if (message.type === 'auth') {
      if (!this.user.value || this.user.value.id !== data.id) return;
      this.user.value = { ...this.user.value, ...data };
      this.persistUser();
    } else if (message.type === 'run:init' || message.type === 'run:resume') {
      if (data.challenge) this.state.value.challenge = data.challenge;
      this.state.value.run = data.state;
      this.seq = data.state?.actionCount || 0;
      this.setServerOffset(data.serverNow);
      this.version.value++;
    } else if (message.type === 'run:update') {
      this.state.value.run = data.state;
      if (data.score?.isBest) this.showNotice('新纪录已提交到排行榜', 'success');
      if (data.state?.status === 'complete') {
        if (data.state.mineHits > 0) playExplosion();
        this.refreshLeaderboard();
      }
      this.version.value++;
    } else if (message.type === 'room:created' || message.type === 'room:state' || message.type === 'room:countdown' || message.type === 'room:started') {
      this.state.value.room = data;
      if (message.type === 'room:started') {
        this.state.value.run = null;
        this.seq = 0;
      }
      this.version.value++;
    } else if (message.type === 'error') {
      this.showNotice(message.message || '操作失败', message.code === 'RATE_LIMITED' ? 'warning' : 'error');
      if (['INVALID_TOKEN', 'UNKNOWN_USER'].includes(message.code)) this.logout();
    }
  }

  setServerOffset(serverNow) {
    if (Number.isFinite(serverNow)) this.state.value.serverOffset = serverNow - Date.now();
  }

  startHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const ping = () => this.send({ type: 'ping', payload: { timestamp: Date.now() } });
    ping();
    this.pingTimer = setInterval(ping, 10_000);
  }

  sendIdentify() {
    if (this.token.value) this.send({ type: 'identify', payload: { token: this.token.value } });
  }

  send(message) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  startDaily(challengeId = null) {
    this.resetRunUi();
    this.send({ type: 'run:start', payload: { mode: 'daily', challengeId } });
  }

  startAsync(challengeId) {
    this.resetRunUi();
    this.send({ type: 'run:start', payload: { mode: 'async', challengeId } });
  }

  resumeRun(runId) {
    this.send({ type: 'run:resume', payload: { runId } });
  }

  sendAction(action, x, y) {
    if (!this.state.value.run || ['complete'].includes(this.state.value.run.status)) return;
    if (!this.user.value && this.state.value.run.mode !== 'daily') {
      this.authRequiredHandler?.();
      return;
    }
    this.seq++;
    const messageType = this.state.value.room ? 'room:action' : 'run:action';
    this.send({
      type: messageType,
      payload: { action, x, y, seq: this.seq },
    });
  }

  onClick(cell) {
    if (!cell || cell.flagged || cell.revealed) return;
    playPop();
    this.sendAction('reveal', cell.x, cell.y);
  }

  onRightClick(cell) {
    if (!cell || cell.revealed) return;
    playFlag();
    this.sendAction('flag', cell.x, cell.y);
  }

  getCell(x, y) {
    const cells = this.state.value.run?.cells || [];
    return cells.find(cell => cell.x === x && cell.y === y) || {
      x, y, revealed: false, flagged: false, mine: false, adjacentMines: 0, mineHit: false,
    };
  }

  createRoom(payload = {}) {
    if (!this.user.value) {
      this.authRequiredHandler?.();
      return;
    }
    this.send({ type: 'room:create', payload });
  }

  joinRoom(code) {
    if (!this.user.value) {
      this.authRequiredHandler?.();
      return;
    }
    this.send({ type: 'room:join', payload: { code } });
  }

  setRoomReady(ready) {
    this.send({ type: 'room:ready', payload: { ready } });
  }

  async refreshLeaderboard() {
    try {
      const headers = this.token.value ? { Authorization: `Bearer ${this.token.value}` } : undefined;
      const result = await $fetch('/api/leaderboards/daily', { headers });
      this.state.value.leaderboard = result.entries || [];
      this.state.value.leaderboardMe = result.me || null;
      this.version.value++;
    } catch {
      // The board remains playable when the ranking endpoint is unavailable.
    }
  }

  async login(username, password) {
    try {
      const result = await $fetch('/api/auth/login', { method: 'POST', body: { username, password } });
      this.setAuth(result);
      this.sendIdentify();
      return true;
    } catch (error) {
      this.showNotice(error.data?.statusMessage || '登录失败');
      return false;
    }
  }

  async register(username, password, color) {
    try {
      const result = await $fetch('/api/auth/register', { method: 'POST', body: { username, password, color } });
      this.setAuth(result);
      this.sendIdentify();
      return true;
    } catch (error) {
      this.showNotice(error.data?.statusMessage || '注册失败');
      return false;
    }
  }

  setAuth(result) {
    this.user.value = result.user;
    this.token.value = result.token;
    this.persistUser();
  }

  persistUser() {
    if (typeof localStorage === 'undefined') return;
    if (this.user.value) localStorage.setItem('minesweeper-user', JSON.stringify(this.user.value));
    if (this.token.value) localStorage.setItem('minesweeper-token', this.token.value);
  }

  resetRunUi() {
    this.state.value.run = null;
    this.state.value.room = null;
    this.seq = 0;
    this.version.value++;
  }

  logout() {
    this.user.value = null;
    this.token.value = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('minesweeper-user');
      localStorage.removeItem('minesweeper-token');
    }
    this.showNotice('已退出登录', 'success');
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.ticker) clearInterval(this.ticker);
    this.ws?.close();
    this.ws = null;
  }
}
