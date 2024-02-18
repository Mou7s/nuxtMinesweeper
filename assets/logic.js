// 它包含了所有可能的方向的数组
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
  state = ref();
  //init game
  constructor(width, height, mines) {
    this.width = width;
    this.height = height;
    this.mines = mines;
    //reset game
    this.reset();
  }

  get board() {
    return this.state.value.board;
  }

  get blocks() {
    return this.state.value.board.flat();
  }

  reset(width, height, mines) {
    this.width = width;
    this.height = height;
    this.mines = mines;

    this.state.value = {
      mineGenerated: false,
      status: 'ready',
      board: this.createBoard(width, height),
    };
  }

  createBoard(width, height) {
    return Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        x,
        y,
        adjacentMines: 0,
        revealed: false,
      }))
    );
  }

  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  randomInt(min, max) {
    return Math.round(this.randomRange(min, max));
  }

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

      if (block.mine) return false;
      block.mine = true;
      return true;
    };

    Array.from({ length: this.mines }, () => null).forEach(() => {
      let placed = false;
      while (!placed) placed = placeRandom();
    });
    this.updateNumbers();
  }

  updateNumbers() {
    this.board.forEach((row) => {
      row.forEach((block) => {
        if (block.mine) return;
        this.getSiblings(block).forEach((b) => {
          if (b.mine) block.adjacentMines += 1;
        });
      });
    });
  }

  expendZero(block) {
    if (block.adjacentMines) return;

    this.getSiblings(block).forEach((s) => {
      if (!s.revealed) {
        if (!s.flagged) s.revealed = true;
        this.expendZero(s);
      }
    });
  }

  onRightClick(block) {
    if (this.state.value.status !== 'play') return;

    if (block.revealed) return;
    block.flagged = !block.flagged;
  }

  onClick(block) {
    if ((this.state.value.status = 'ready')) {
      this.state.value.status = 'play';
      // this.state.value.startMS = +new Date();
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
  }

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
  //reveal all mines
  showAllMines() {
    for (const block of this.board.flat()) {
      if (block.mine) {
        block.revealed = true;
      }
    }
  }

  checkGameState() {
    if (!this.state.value.mineGenerated || this.state.value.status !== 'play')
      return;

    const blocks = this.board.flat();

    if (!blocks.some((block) => !block.mine && !block.revealed))
      this.onGameOver('won');
  }
  //auto expand sibling blocks
  autoExpand(block) {
    if (this.state.value.status !== 'play' || block.flagged) return;

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
  }
  //game over situation
  onGameOver(status) {
    const ALERT_DELAY = 10;
    this.state.value.status = status;
    if (status === 'lost') {
      this.showAllMines();
      setTimeout(() => {
        alert('YOU LOST');
      }, ALERT_DELAY);
    }
  }
}
