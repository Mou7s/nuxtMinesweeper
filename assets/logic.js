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
  state = ref({});
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
    this.stopTimer();

    this.state.value = {
      mineGenerated: false,
      status: "ready",
      startTime: null,
      timeElapsed: 0,
      board: this.createBoard(width, height),
    };
  }

  /**
   * 创建空棋盘
   * @returns {Array<Array<{x:number,y:number,adjacentMines:number,revealed:boolean,flagged:boolean,mine:boolean}>>}
   * 每个格子只保存必要的状态字段，便于序列化和 UI 绑定
   */
  createBoard(width, height) {
    const board = Array.from({ length: height }, () => Array(width));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        board[y][x] = this.createBlock(x, y);
      }
    }
    return board;
  }

  /** 单个格子模板，集中维护字段，便于调整结构 */
  createBlock(x, y) {
    return {
      x,
      y,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
      mine: false,
    };
  }

  /** Fisher–Yates 洗牌，用于随机布雷 */
  shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 布雷（首点安全）：避开 initial 点及其 8 邻域
   * @param {Array<Array<Block>>} state 当前棋盘
   * @param {{x:number,y:number}} initial 首次点击的格子
   */
  generateMines(initial) {
    const isSafe = (block) =>
      Math.abs(initial.x - block.x) <= 1 && Math.abs(initial.y - block.y) <= 1;

    // 先过滤掉首点及其邻居，再随机抽取固定数量的格子设为雷
    const candidates = this.blocks.filter((b) => !isSafe(b));
    this.shuffle(candidates)
      .slice(0, this.mines)
      .forEach((block) => {
        block.mine = true;
      });
    this.updateNumbers();
  }

  /**
   * 计算并写回每个非雷格的相邻雷数；方法幂等（先清零再叠加）
   */
  updateNumbers() {
    this.blocks.forEach((block) => {
      block.adjacentMines = 0;
    });

    // 只遍历雷格，向其邻居累加计数，避免重复扫描整盘
    this.blocks.forEach((block) => {
      if (!block.mine) return;
      this.forEachNeighbor(block, (neighbor) => {
        neighbor.adjacentMines += 1;
      });
    });
  }

  /**
   * 若当前格相邻雷数为 0，则展开其未翻开且未标记的邻居（迭代版避免递归栈）
   */
  expendZero(block) {
    if (block.adjacentMines) return;

    // 使用队列而非递归，避免大盘面出现调用栈过深
    const queue = [block];
    while (queue.length) {
      const current = queue.shift();
      this.forEachNeighbor(current, (neighbor) => {
        if (neighbor.revealed || neighbor.flagged) return;
        neighbor.revealed = true;
        if (!neighbor.adjacentMines) queue.push(neighbor);
      });
    }
  }

  // alias for readability; keeps backward compatibility
  expandZero(block) {
    return this.expendZero(block);
  }

  /**
   * 右键标记/取消标记：仅在进行中且未翻开的格子上生效
   */
  onRightClick(block) {
    if (this.state.value.status !== "play") return;
    if (block.revealed) return;
    block.flagged = !block.flagged;
  }

  /**
   * 左键点击：首次点击开始计时并布雷；点击雷判负，否则按规则展开
   */
  onClick(block) {
    if (this.state.value.status === "ready") {
      this.state.value.status = "play";
      this.startTimer();
    }

    if (this.state.value.status !== "play" || block.flagged || block.revealed)
      return;

    // 首次点击后再布雷以确保第一步安全
    if (!this.state.value.mineGenerated) {
      this.generateMines(this.board, block);
      this.state.value.mineGenerated = true;
    }

    block.revealed = true;
    if (block.mine) return this.onGameOver("lost");

    this.expendZero(block);
    this.checkGameState();
  }

  /**
   * 获取某格子 8 邻域内的有效邻居格
   */
  getSiblings(block) {
    return directions
      .map(([dx, dy]) => this.board[block.y + dy]?.[block.x + dx])
      .filter(Boolean);
  }

  /** 遍历邻居的帮助函数，减少重复代码 */
  forEachNeighbor(block, cb) {
    this.getSiblings(block).forEach(cb);
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
    if (!this.state.value.mineGenerated || this.state.value.status !== "play")
      return;

    const blocks = this.board.flat();

    if (!blocks.some((block) => !block.mine && !block.revealed))
      this.onGameOver("won");
  }
  /**
   * 自动展开邻居（“串联/chord”操作）：
   * - 若周围旗数量等于数字，则翻开剩余未翻开的邻居
   * - 若未翻开邻居数量等于“数字-旗数量”，则自动为其插旗
   * 仅在当前格已翻开时生效
   */
  autoExpand(block) {
    if (this.state.value.status !== "play" || block.flagged) return;
    if (!block.revealed) return;

    const neighbors = this.getSiblings(block);
    const flagCount = neighbors.filter((n) => n.flagged).length;
    const hidden = neighbors.filter((n) => !n.revealed && !n.flagged);

    if (flagCount === block.adjacentMines) {
      hidden.forEach((n) => {
        n.revealed = true;
        if (n.mine) return this.onGameOver("lost");
        this.expendZero(n);
      });
    } else if (hidden.length === block.adjacentMines - flagCount) {
      hidden.forEach((n) => (n.flagged = true));
    }
    this.checkGameState();
  }
  /**
   * 结束游戏：设置状态并停止计时；若失败则揭示所有雷
   */
  onGameOver(status) {
    this.state.value.status = status;
    this.stopTimer();
    if (status === "lost") this.showAllMines();
  }

  startTimer() {
    if (this.timerId) return;
    this.state.value.startTime = Date.now();
    this.state.value.timeElapsed = 0;
    this.timerId = setInterval(() => {
      this.state.value.timeElapsed = Math.floor(
        (Date.now() - this.state.value.startTime) / 1000
      );
    }, 1000);
  }

  stopTimer() {
    if (!this.timerId) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }
}
