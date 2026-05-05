import { ref, reactive } from 'vue';

const directions = [
  [1, 1], [1, 0], [1, -1], [0, -1],
  [-1, -1], [-1, 0], [-1, 1], [0, 1],
];

// A simple hash function for coordinates
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h;
}

export class GamePlay {
  version = ref(0);
  state = ref({
    seed: '',
    status: 'ready',
    startTime: null,
    timeElapsed: 0,
    safeZone: null,
    score: 0,
    flags: 0,
  });
  blocks = new Map(); // stores x,y -> Block
  
  constructor() {
    this.timerId = null;
    this.reset();
  }

  // Generate a hash based on x, y, and global seed to determine if it's a mine
  isMine(x, y) {
    // Safe zone around the first click
    if (this.state.value.safeZone) {
      const dx = Math.abs(x - this.state.value.safeZone.x);
      const dy = Math.abs(y - this.state.value.safeZone.y);
      if (dx <= 1 && dy <= 1) return false;
    }

    // Hash logic
    const coordSeed = stringToSeed(`${x},${y},${this.state.value.seed}`);
    const rand = mulberry32(coordSeed)();
    
    // 15% mine density
    return rand < 0.15;
  }

  reset() {
    this.stopTimer();
    this.blocks.clear();

    this.state.value = {
      seed: Math.random().toString(36).substring(2, 8), // New world seed
      status: "ready", // ready, play, lost
      startTime: null,
      timeElapsed: 0,
      score: 0, // Score replaces "win"
      flags: 0,
      cameraX: 0,
      cameraY: 0,
    };
    // 绝对不能在这里调用 saveToStorage()！
    // 因为每次刷新网页时，组件初始化都会执行 new GamePlay() -> reset()
    // 如果在这里保存，就会把之前浏览器里的旧存档直接用空存档覆盖掉！
  }

  respawn() {
    // Keeps the world seed and blocks.
    // Score is NO LONGER reset, allowing players to carry their score to the new continent.
    this.version.value++; // 强制刷新视图以丢弃旧大陆遗留缓存
    this.saveToStorage();
  }

  saveToStorage() {
    if (typeof window === 'undefined') return;
    
    // 只保存被翻开或插旗的格子，以极大地节省存储空间
    const savedBlocks = [];
    for (const [key, block] of this.blocks.entries()) {
      if (block.revealed || block.flagged) {
        savedBlocks.push([key, block]);
      }
    }
    
    const data = {
      state: this.state.value,
      blocks: savedBlocks
    };
    
    localStorage.setItem('minesweeper-save', JSON.stringify(data));
  }

  loadFromStorage() {
    if (typeof window === 'undefined') return false;
    
    const save = localStorage.getItem('minesweeper-save');
    if (!save) return false;
    
    try {
      const data = JSON.parse(save);
      this.state.value = data.state;
      
      this.blocks.clear();
      for (const [key, blockData] of data.blocks) {
        this.blocks.set(key, reactive(blockData));
      }
      // 恢复计时器
      if (this.state.value.status === 'play') {
        this.startTimer();
      }
      this.version.value++; // 强制刷新视图
      return true;
    } catch (e) {
      console.error('Failed to load save', e);
      return false;
    }
  }

  // Get block state, generate if not exists
  getBlock(x, y) {
    const key = `${x},${y}`;
    if (this.blocks.has(key)) return this.blocks.get(key);

    const isMine = this.isMine(x, y);
    
    let adjacentMines = 0;
    if (!isMine) {
      for (const [dx, dy] of directions) {
        if (this.isMine(x + dx, y + dy)) {
          adjacentMines++;
        }
      }
    }

    const block = reactive({
      x, y,
      mine: isMine,
      adjacentMines,
      revealed: false,
      flagged: false,
    });

    this.blocks.set(key, block);
    return block;
  }

  // Recalculate properties for all cached blocks (used when safeZone is established)
  recalculateAllBlocks() {
    // 1. Update mine status
    for (const block of this.blocks.values()) {
      block.mine = this.isMine(block.x, block.y);
    }
    // 2. Update adjacent counts
    for (const block of this.blocks.values()) {
      if (block.mine) {
        block.adjacentMines = 0;
      } else {
        let count = 0;
        for (const [dx, dy] of directions) {
          if (this.isMine(block.x + dx, block.y + dy)) count++;
        }
        block.adjacentMines = count;
      }
    }
  }

  getSiblings(block) {
    return directions.map(([dx, dy]) => this.getBlock(block.x + dx, block.y + dy));
  }

  forEachNeighbor(block, cb) {
    this.getSiblings(block).forEach(cb);
  }

  expendZero(block) {
    if (block.adjacentMines) return;

    let changed = false;
    const queue = [block];
    while (queue.length) {
      const current = queue.shift();
      this.forEachNeighbor(current, (neighbor) => {
        if (neighbor.revealed || neighbor.flagged) return;
        neighbor.revealed = true;
        changed = true;
        this.state.value.score += 1;
        if (!neighbor.adjacentMines) queue.push(neighbor);
      });
    }
    if (changed) this.saveToStorage();
  }

  onRightClick(block) {
    if (this.state.value.status !== "play" && this.state.value.status !== "ready") return;
    if (block.revealed) return;
    
    block.flagged = !block.flagged;
    if (block.flagged) this.state.value.flags++;
    else this.state.value.flags--;
    
    this.saveToStorage();
  }

  onClick(block) {
    if (this.state.value.status === "ready") {
      this.state.value.status = "play";
      this.state.value.safeZone = { x: block.x, y: block.y };
      // Refresh all currently cached blocks in the viewport to apply the safeZone
      this.recalculateAllBlocks();
      this.startTimer();
    }

    if (this.state.value.status !== "play" || block.flagged || block.revealed) return;

    block.revealed = true;
    if (block.mine) {
      this.state.value.score -= 10; // Penalty for clicking a mine
      this.saveToStorage();
      return;
    }

    this.state.value.score += 1;
    this.expendZero(block);
    this.saveToStorage();
  }

  autoExpand(block) {
    if (this.state.value.status !== "play" || block.flagged || !block.revealed) return;

    let changed = false;
    const neighbors = this.getSiblings(block);
    const flagCount = neighbors.filter((n) => n.flagged).length;
    const hidden = neighbors.filter((n) => !n.revealed && !n.flagged);

    if (flagCount === block.adjacentMines) {
      hidden.forEach((n) => {
        n.revealed = true;
        changed = true;
        if (n.mine) {
          this.state.value.score -= 10;
          return;
        }
        this.state.value.score += 1;
        this.expendZero(n);
      });
    } else if (hidden.length === block.adjacentMines - flagCount) {
      hidden.forEach((n) => {
        if (!n.flagged) {
          n.flagged = true;
          changed = true;
          this.state.value.flags++;
        }
      });
    }
    
    if (changed) this.saveToStorage();
  }

  startTimer() {
    if (this.timerId) return;
    this.state.value.startTime = Date.now();
    this.state.value.timeElapsed = 0;
    this.timerId = setInterval(() => {
      this.state.value.timeElapsed = Math.floor((Date.now() - this.state.value.startTime) / 1000);
    }, 1000);
  }

  stopTimer() {
    if (!this.timerId) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }
}
