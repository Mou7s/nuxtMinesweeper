/**
 * 扫雷核心逻辑（无 UI）：负责棋盘生成、布雷、展开、标记、胜负判定与计时。
 * 使用方式：在组件中 new GamePlay(width, height, mines) 并绑定到 UI。
 * 注意：ref 由 Vue 提供；在 Nuxt 3 中通常可自动导入，如在纯 JS 环境中需手动 `import { ref } from 'vue'`。
 */

// 8 个相邻方向（dx, dy）：从右下角开始，顺时针一圈
const directions = [
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export class GamePlay {
  /**
   * 响应式状态
   * status: 'ready' | 'play' | 'won' | 'lost'
   * mineGenerated: 是否已布雷（首点安全策略）
   * startTime/timeElapsed: 计时信息（秒）
   * board: 二维数组，元素为格子 Block
   */
  state = ref('');
  /**
   * 初始化游戏
   * @param {number} width  棋盘宽度（列数）
   * @param {number} height 棋盘高度（行数）
   * @param {number} mines  地雷数量
   */
  constructor(width, height, mines) {
    this.timerId = null;
    this.reset(width, height, mines);
  }

  /** 获取棋盘（二维数组） */
  get board() {
    return this.state.value.board;
  }

  /** 将棋盘拍平为一维数组，便于遍历统计 */
  get blocks() {
    return this.state.value.board.flat();
  }

  /**
   * 重置游戏状态与棋盘，同时清理计时器与时间数据
   */
  reset(width, height, mines) {
    this.width = width;
    this.height = height;
    this.mines = mines;

    // ensure previous timer is cleared when resetting during a game
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.state.value = {
      mineGenerated: false,
      status: 'ready',
      startTime: null,
      timeElapsed: 0,
      board: this.createBoard(width, height),
    };
  }

  /**
   * 创建空棋盘
   * @returns {Array<Array<{x:number,y:number,adjacentMines:number,revealed:boolean,flagged:boolean,mine:boolean}>>}
   */
  createBoard(width, height) {
    return Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        x,
        y,
        adjacentMines: 0,
        revealed: false,
  flagged: false,
  mine: false,
      }))
    );
  }

  /** 生成 [min, max) 浮点随机数（内部使用） */
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  /** 生成 [min, max] 的均匀整数随机数（包含端点） */
  randomInt(min, max) {
  // unbiased inclusive integer in [min, max]
  return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 布雷（首点安全）：避开 initial 点及其 8 邻域
   * @param {Array<Array<Block>>} state 当前棋盘
   * @param {{x:number,y:number}} initial 首次点击的格子
   */
  generateMines(state, initial) {
    const placeRandom = () => {
      const x = this.randomInt(0, this.width - 1);
      const y = this.randomInt(0, this.height - 1);

      const block = state[y][x];

      if (
        Math.abs(initial.x - block.x) <= 1 &&
        Math.abs(initial.y - block.y) <= 1
      ) {
        return false;
      }

      if (block.mine) {
        return false;
      }

      block.mine = true;
      return true;
    };

    Array.from({ length: this.mines }, () => null).forEach(() => {
      let placed = false;
      while (!placed) placed = placeRandom();
    });
    this.updateNumbers();
  }

  /**
   * 计算并写回每个非雷格的相邻雷数；方法幂等（先清零再叠加）
   */
  updateNumbers() {
    // reset counts first to keep the method idempotent
    this.board.forEach((row) => {
      row.forEach((block) => {
        block.adjacentMines = 0;
      });
    });
    this.board.forEach((row) => {
      row.forEach((block) => {
        if (block.mine) return;
        this.getSiblings(block).forEach((b) => {
          if (b.mine) block.adjacentMines += 1;
        });
      });
    });
  }

  /**
   * 若当前格相邻雷数为 0，则递归展开其未翻开且未标记的邻居
   * 注意：递归实现简单明了；若担心极端大盘面栈深，可改为 BFS 迭代
   */
  expendZero(block) {
    if (block.adjacentMines) return;

    this.getSiblings(block).forEach((s) => {
      if (!s.revealed) {
        if (!s.flagged) s.revealed = true;
        this.expendZero(s);
      }
    });
  }

  // alias for readability; keeps backward compatibility
  expandZero(block) {
    return this.expendZero(block);
  }

  /**
   * 右键标记/取消标记：仅在进行中且未翻开的格子上生效
   */
  onRightClick(block) {
    if (this.state.value.status !== 'play') return;
    if (block.revealed) return;
    block.flagged = !block.flagged;
  }

  /**
   * 左键点击：首次点击开始计时并布雷；点击雷判负，否则按规则展开
   */
  onClick(block) {
    if (this.state.value.status == 'ready') {
      this.state.value.status = 'play';
      this.state.value.startTime = Date.now();
      this.timerId = setInterval(() => {
        this.state.value.timeElapsed = Math.floor(
          (Date.now() - this.state.value.startTime) / 1000
        );
      }, 1000);
    }

    if (this.state.value.status !== 'play' || block.flagged) return;

    if (!this.state.value.mineGenerated) {
      this.generateMines(this.board, block);
      this.state.value.mineGenerated = true;
    }

    block.revealed = true;
    if (block.mine) {
      this.onGameOver('lost');
      return;
    }

    this.expendZero(block);
  this.checkGameState();
  }

  /**
   * 获取某格子 8 邻域内的有效邻居格
   */
  getSiblings(block) {
    return directions
      .map(([dx, dy]) => {
        const x2 = block.x + dx;
        const y2 = block.y + dy;
        if (x2 < 0 || x2 >= this.width || y2 < 0 || y2 >= this.height)
          return undefined;
        return this.board[y2][x2];
      })
      .filter(Boolean);
  }
  /** 显示所有雷（用于判负后揭示） */
  showAllMines() {
    for (const block of this.board.flat()) {
      if (block.mine) {
        block.revealed = true;
      }
    }
  }

  /**
   * 检查当前是否胜利：所有非雷格均已翻开
   * 仅在已布雷且游戏进行中时触发
   */
  checkGameState() {
    if (!this.state.value.mineGenerated || this.state.value.status !== 'play')
      return;

    const blocks = this.board.flat();

    if (!blocks.some((block) => !block.mine && !block.revealed))
      this.onGameOver('won');
  }
  /**
   * 自动展开邻居（“串联/chord”操作）：
   * - 若周围旗数量等于数字，则翻开剩余未翻开的邻居
   * - 若未翻开邻居数量等于“数字-旗数量”，则自动为其插旗
   * 仅在当前格已翻开时生效
   */
  autoExpand(block) {
  if (this.state.value.status !== 'play' || block.flagged) return;
  if (!block.revealed) return;

    const siblings = this.getSiblings(block);
    const flags = siblings.reduce((a, b) => a + (b.flagged ? 1 : 0), 0);
    const notRevealed = siblings.reduce(
      (a, b) => a + (!b.revealed && !b.flagged ? 1 : 0),
      0
    );
    if (flags === block.adjacentMines) {
      siblings.forEach((i) => {
        if (i.revealed || i.flagged) return;
        i.revealed = true;
        this.expendZero(i);
        if (i.mine) this.onGameOver('lost');
      });
    }
    const missingFlags = block.adjacentMines - flags;
    if (notRevealed === missingFlags) {
      siblings.forEach((i) => {
        if (!i.revealed && !i.flagged) i.flagged = true;
      });
    }
  this.checkGameState();
  }
  /**
   * 结束游戏：设置状态并停止计时；若失败则揭示所有雷
   */
  onGameOver(status) {
    this.state.value.status = status;
    clearInterval(this.timerId);
    if (status === 'lost') {
      this.showAllMines();
    }
  }
}
