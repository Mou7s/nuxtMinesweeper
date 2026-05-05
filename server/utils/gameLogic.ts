const directions = [
  [1, 1], [1, 0], [1, -1], [0, -1],
  [-1, -1], [-1, 0], [-1, 1], [0, 1],
];

// A simple hash function for coordinates
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
}

export class GameServer {
  state = {
    seed: Math.random().toString(36).substring(2, 8),
    score: 0,
    flags: 0,
    startTime: Date.now(),
  };
  
  blocks = new Map<string, Block>();
  
  // Keep track of blocks modified in the current tick to broadcast them
  private currentTickUpdates = new Map<string, Block>();

  constructor() {
    console.log('[GameServer] Initialized with seed:', this.state.seed);
  }

  // Determine if a block is a mine using deterministic hashing
  isMine(x: number, y: number) {
    const coordSeed = stringToSeed(`${x},${y},${this.state.seed}`);
    const rand = mulberry32(coordSeed)();
    // 15% mine density
    return rand < 0.15;
  }

  // Get block state, generate if not exists
  getBlock(x: number, y: number): Block {
    const key = `${x},${y}`;
    if (this.blocks.has(key)) return this.blocks.get(key)!;

    const isMine = this.isMine(x, y);
    
    let adjacentMines = 0;
    if (!isMine) {
      for (const [dx, dy] of directions) {
        if (this.isMine(x + dx, y + dy)) {
          adjacentMines++;
        }
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

  expendZero(block: Block) {
    if (block.adjacentMines) return;

    const queue = [block];
    while (queue.length) {
      const current = queue.shift()!;
      this.forEachNeighbor(current, (neighbor) => {
        if (neighbor.revealed || neighbor.flagged) return;
        neighbor.revealed = true;
        this.markUpdated(neighbor);
        this.state.score += 1;
        if (!neighbor.adjacentMines) queue.push(neighbor);
      });
    }
  }

  // Handle a click action from a client
  processAction(action: string, x: number, y: number) {
    this.currentTickUpdates.clear();
    const block = this.getBlock(x, y);

    if (action === 'click') {
      if (block.flagged || block.revealed) return null;
      
      block.revealed = true;
      this.markUpdated(block);

      if (block.mine) {
        this.state.score -= 10;
      } else {
        this.state.score += 1;
        this.expendZero(block);
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
        hidden.forEach((n) => {
          n.revealed = true;
          this.markUpdated(n);
          if (n.mine) {
            this.state.score -= 10;
            return;
          }
          this.state.score += 1;
          this.expendZero(n);
        });
      } else if (hidden.length === block.adjacentMines - flagCount) {
        hidden.forEach((n) => {
          if (!n.flagged) {
            n.flagged = true;
            this.markUpdated(n);
            this.state.flags++;
          }
        });
      }
    }

    if (this.currentTickUpdates.size === 0) return null;

    return {
      state: this.state,
      updates: Array.from(this.currentTickUpdates.values())
    };
  }

  // Get current world snapshot for new players
  getSnapshot() {
    const revealedOrFlagged = [];
    for (const block of this.blocks.values()) {
      if (block.revealed || block.flagged) {
        revealedOrFlagged.push(block);
      }
    }
    return {
      state: this.state,
      blocks: revealedOrFlagged
    };
  }
}

// Global Singleton Instance
export const globalGameServer = new GameServer();
