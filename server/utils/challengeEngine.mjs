export const BOARD_ROWS = 16;
export const BOARD_COLS = 16;
export const BOARD_MINES = 40;
export const MINE_PENALTY_MS = 10_000;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export function utcDateString(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function createDailyChallenge(date = utcDateString()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid challenge date');
  return {
    id: `daily-${date}`,
    kind: 'daily',
    challengeDate: date,
    seed: `daily:${date}:v1`,
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    mines: BOARD_MINES,
  };
}

export function createPrivateChallenge(seed, createdBy = null) {
  if (typeof seed !== 'string' || seed.length < 8 || seed.length > 128) {
    throw new Error('Invalid private challenge seed');
  }
  return {
    id: `private-${hashString(seed).toString(16)}`,
    kind: 'private',
    challengeDate: null,
    seed,
    rows: BOARD_ROWS,
    cols: BOARD_COLS,
    mines: BOARD_MINES,
    createdBy,
  };
}

export function createRun(challenge, { userId = null, mode = 'daily', roomId = null } = {}) {
  const cells = createBoard(challenge);
  return {
    id: null,
    challengeId: challenge.id,
    userId,
    mode,
    roomId,
    rows: challenge.rows,
    cols: challenge.cols,
    mines: challenge.mines,
    cells,
    status: 'ready',
    startedAt: null,
    finishedAt: null,
    elapsedMs: null,
    penaltyMs: 0,
    mineHits: 0,
    actionCount: 0,
    revealedSafe: 0,
    lastSeq: 0,
  };
}

export function applyAction(run, action, now = Date.now()) {
  const actionType = action?.type || action?.action;
  if (!run || !['reveal', 'flag'].includes(actionType)) return null;
  if (run.status === 'complete') return null;

  const x = Number(action.x);
  const y = Number(action.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || x >= run.cols || y < 0 || y >= run.rows) return null;

  const cell = run.cells[y * run.cols + x];
  if (!cell) return null;

  if (actionType === 'flag' && cell.revealed) return makeResult(run, [], 'ignored');
  if (actionType === 'reveal' && (cell.revealed || cell.flagged)) return makeResult(run, [], 'ignored');

  if (run.startedAt === null) {
    run.startedAt = now;
    run.status = 'running';
  }

  run.actionCount++;
  const changed = [];

  if (actionType === 'flag') {
    cell.flagged = !cell.flagged;
    changed.push(cell);
    return makeResult(run, changed, 'flag');
  }

  if (cell.mine) {
    cell.revealed = true;
    cell.mineHit = true;
    run.mineHits++;
    if (run.mineHits > 1) run.penaltyMs += MINE_PENALTY_MS;
    changed.push(cell);
  } else {
    revealSafeArea(run, x, y, changed);
  }

  if (run.revealedSafe >= run.rows * run.cols - run.mines) {
    run.status = 'complete';
    run.finishedAt = now;
    run.elapsedMs = Math.max(0, now - run.startedAt);
  }

  return makeResult(run, changed, run.status === 'complete' ? 'complete' : 'reveal');
}

export function effectiveTimeMs(run) {
  if (run.elapsedMs === null || run.startedAt === null) return null;
  return run.elapsedMs + run.penaltyMs;
}

export function publicRunState(run) {
  return {
    id: run.id,
    challengeId: run.challengeId,
    mode: run.mode,
    roomId: run.roomId,
    rows: run.rows,
    cols: run.cols,
    mines: run.mines,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    elapsedMs: run.elapsedMs,
    penaltyMs: run.penaltyMs,
    mineHits: run.mineHits,
    actionCount: run.actionCount,
    effectiveMs: effectiveTimeMs(run),
    cells: run.cells.map(encodeCell),
  };
}

export function encodeCell(cell) {
  return {
    x: cell.x,
    y: cell.y,
    revealed: cell.revealed,
    flagged: cell.flagged,
    mine: cell.revealed ? cell.mine : false,
    adjacentMines: cell.revealed && !cell.mine ? cell.adjacentMines : 0,
    mineHit: Boolean(cell.mineHit),
  };
}

function createBoard(challenge) {
  const total = challenge.rows * challenge.cols;
  const positions = Array.from({ length: total }, (_, index) => index);
  const random = seededRandom(challenge.seed);

  for (let index = positions.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }

  const mines = new Set(positions.slice(0, challenge.mines));
  return Array.from({ length: total }, (_, index) => {
    const x = index % challenge.cols;
    const y = Math.floor(index / challenge.cols);
    return {
      x,
      y,
      mine: mines.has(index),
      adjacentMines: countAdjacentMines(x, y, challenge, mines),
      revealed: false,
      flagged: false,
      mineHit: false,
    };
  });
}

function countAdjacentMines(x, y, challenge, mines) {
  let count = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextX >= challenge.cols || nextY < 0 || nextY >= challenge.rows) continue;
    if (mines.has(nextY * challenge.cols + nextX)) count++;
  }
  return count;
}

function revealSafeArea(run, startX, startY, changed) {
  const queue = [[startX, startY]];
  const queued = new Set();

  while (queue.length) {
    const [x, y] = queue.shift();
    const key = `${x},${y}`;
    if (queued.has(key)) continue;
    queued.add(key);

    const cell = run.cells[y * run.cols + x];
    if (!cell || cell.revealed || cell.flagged || cell.mine) continue;

    cell.revealed = true;
    run.revealedSafe++;
    changed.push(cell);

    if (cell.adjacentMines !== 0) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX >= 0 && nextX < run.cols && nextY >= 0 && nextY < run.rows) {
        queue.push([nextX, nextY]);
      }
    }
  }
}

function makeResult(run, changed, result) {
  return {
    result,
    changed: changed.map(encodeCell),
    state: publicRunState(run),
  };
}

function seededRandom(seed) {
  let value = hashString(seed) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), value | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
