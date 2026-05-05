import { globalUserStore } from './userStore';

const directions = [
  [1, 1], [1, 0], [1, -1], [0, -1],
  [-1, -1], [-1, 0], [-1, 1], [0, 1],
] as const;

function mulberry32(a: number) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h;
}

export interface Block {
  x: number;
  y: number;
  mine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
  ownerId?: string; // 谁点开了这个格子
  ownerColor?: string;
}

export interface PlayerInfo {
  id: string;
  username: string;
  color: string;
  score: number;
  lastActive: number;
}

export class GameServer {
  state = {
    seed: Math.random().toString(36).substring(2, 8),
    flags: 0,
    startTime: Date.now(),
    leaderboard: [] as any[] // [{username, score, color}]
  };
  
  blocks = new Map<string, Block>();
  players = new Map<string, PlayerInfo>();
  
  private currentTickUpdates = new Map<string, Block>();
  private initialized = false;
  private saveTimeout: any = null;

  constructor() {
    console.log('[GameServer] Initializing...');
  }

  async ensureInitialized() {
    if (this.initialized) return;
    await this.load();
    this.initialized = true;
  }

  async load() {
    try {
      const storage = useStorage('data');
      const data: any = await storage.getItem('world.json');
      if (data) {
        this.state = data.state;
        this.blocks.clear();
        for (const b of data.blocks) {
          this.blocks.set(`${b.x},${b.y}`, b);
        }
        console.log('[GameServer] Persistence: Loaded world state.');
      }
    } catch (e) {
      console.error('[GameServer] Persistence: Error loading state:', e);
    }
  }

  save() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const storage = useStorage('data');
        const data = {
          state: this.state,
          blocks: Array.from(this.blocks.values()).filter(b => b.revealed || b.flagged)
        };
        await storage.setItem('world.json', data);
      } catch (e) {}
    }, 2000);
  }

  isMine(x: number, y: number) {
    const coordSeed = stringToSeed(`${x},${y},${this.state.seed}`);
    const rand = mulberry32(coordSeed)();
    return rand < 0.15;
  }

  getBlock(x: number, y: number): Block {
    const key = `${x},${y}`;
    if (this.blocks.has(key)) return this.blocks.get(key)!;

    const isMine = this.isMine(x, y);
    let adjacentMines = 0;
    if (!isMine) {
      for (const [dx, dy] of directions) {
        if (this.isMine(x + dx, y + dy)) adjacentMines++;
      }
    }

    const block: Block = {
      x, y,
      mine: isMine,
      adjacentMines,
      revealed: false,
      flagged: false,
    };

    this.blocks.set(key, block);
    return block;
  }

  getSiblings(block: Block) {
    return directions.map(([dx, dy]) => this.getBlock(block.x + dx, block.y + dy));
  }

  forEachNeighbor(block: Block, cb: (n: Block) => void) {
    this.getSiblings(block).forEach(cb);
  }

  markUpdated(block: Block) {
    const key = `${block.x},${block.y}`;
    this.currentTickUpdates.set(key, block);
  }

  // 记录并同步分数
  async addScore(userId: string, delta: number) {
    const player = this.players.get(userId);
    if (player) {
      player.score += delta;
      player.lastActive = Date.now();
      await globalUserStore.updateScore(userId, delta);
      this.updateLeaderboard();
    }
  }

  updateLeaderboard() {
    const list = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({ username: p.username, score: p.score, color: p.color }));
    this.state.leaderboard = list;
  }

  expendZero(block: Block, userId: string) {
    if (block.adjacentMines) return;

    const queue = [block];
    while (queue.length) {
      const current = queue.shift()!;
      this.forEachNeighbor(current, (neighbor) => {
        if (neighbor.revealed || neighbor.flagged) return;
        neighbor.revealed = true;
        neighbor.ownerId = userId;
        neighbor.ownerColor = this.players.get(userId)?.color;
        this.markUpdated(neighbor);
        this.addScore(userId, 1);
        if (!neighbor.adjacentMines) queue.push(neighbor);
      });
    }
  }

  async addPlayer(userId: string) {
    const user = await globalUserStore.getUserById(userId);
    if (user && !this.players.has(userId)) {
      this.players.set(userId, {
        id: user.id,
        username: user.username,
        color: user.color,
        score: user.score,
        lastActive: Date.now()
      });
      this.updateLeaderboard();
    }
  }

  // Handle a action from a specific user
  async processAction(action: string, x: number, y: number, userId: string) {
    if (!userId) return null;
    await this.addPlayer(userId);

    this.currentTickUpdates.clear();
    const block = this.getBlock(x, y);

    if (action === 'click') {
      if (block.flagged || block.revealed) return null;
      
      block.revealed = true;
      block.ownerId = userId;
      block.ownerColor = this.players.get(userId)?.color;
      this.markUpdated(block);

      if (block.mine) {
        await this.addScore(userId, -10);
      } else {
        await this.addScore(userId, 1);
        this.expendZero(block, userId);
      }
    } else if (action === 'rightclick') {
      if (block.revealed) return null;
      block.flagged = !block.flagged;
      this.markUpdated(block);
      if (block.flagged) this.state.flags++;
      else this.state.flags--;
    } else if (action === 'autoexpand') {
      if (block.flagged || !block.revealed) return null;
      const neighbors = this.getSiblings(block);
      const flagCount = neighbors.filter((n) => n.flagged).length;
      const hidden = neighbors.filter((n) => !n.revealed && !n.flagged);

      if (flagCount === block.adjacentMines) {
        for (const n of hidden) {
          n.revealed = true;
          n.ownerId = userId;
          n.ownerColor = this.players.get(userId)?.color;
          this.markUpdated(n);
          if (n.mine) {
            await this.addScore(userId, -10);
          } else {
            await this.addScore(userId, 1);
            this.expendZero(n, userId);
          }
        }
      }
    }

    if (this.currentTickUpdates.size === 0) return null;

    this.save();

    return {
      state: this.state,
      updates: Array.from(this.currentTickUpdates.values())
    };
  }

  getSnapshot() {
    const revealedOrFlagged = [];
    for (const block of this.blocks.values()) {
      if (block.revealed || block.flagged) revealedOrFlagged.push(block);
    }
    return {
      state: this.state,
      blocks: revealedOrFlagged
    };
  }
}

export const globalGameServer = new GameServer();
