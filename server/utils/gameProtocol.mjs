export const CHUNK_SIZE = 32;
export const MAX_VIEWPORT_CELLS = 200;
export const MAX_WORLD_COORD = 10_000_000;
export const MAX_ACTION_UPDATES = 500;
export const VALID_ACTIONS = new Set(['click', 'rightclick', 'autoexpand']);

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function chunkCoords(x, y) {
  return {
    x: Math.floor(x / CHUNK_SIZE),
    y: Math.floor(y / CHUNK_SIZE),
  };
}

export function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

export function chunkKeyForCell(x, y) {
  const chunk = chunkCoords(x, y);
  return chunkKey(chunk.x, chunk.y);
}

export function chunkTopic(key) {
  return `minesweeper:chunk:${key}`;
}

export function isWorldCoordinate(value) {
  return Number.isInteger(value) && Math.abs(value) <= MAX_WORLD_COORD;
}

export function normalizeViewport(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return null;
  if (!Number.isFinite(payload.cols) || !Number.isFinite(payload.rows)) return null;

  const x = Math.trunc(payload.x);
  const y = Math.trunc(payload.y);
  const cols = Math.ceil(payload.cols);
  const rows = Math.ceil(payload.rows);

  if (!isWorldCoordinate(x) || !isWorldCoordinate(y)) return null;
  if (cols < 1 || rows < 1 || cols > MAX_VIEWPORT_CELLS || rows > MAX_VIEWPORT_CELLS) return null;

  return { x, y, cols, rows };
}

export function chunkKeysForViewport(viewport, padding = 1) {
  const min = chunkCoords(viewport.x, viewport.y);
  const max = chunkCoords(viewport.x + viewport.cols - 1, viewport.y + viewport.rows - 1);
  const keys = [];

  for (let chunkY = min.y - padding; chunkY <= max.y + padding; chunkY++) {
    for (let chunkX = min.x - padding; chunkX <= max.x + padding; chunkX++) {
      keys.push(chunkKey(chunkX, chunkY));
    }
  }

  return keys;
}

export function parseChunkKey(key) {
  if (typeof key !== 'string') return null;
  const [rawX, rawY, ...rest] = key.split(',');
  if (rest.length || rawX === undefined || rawY === undefined) return null;
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

export function isValidActionPayload(payload) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && VALID_ACTIONS.has(payload.action)
    && isWorldCoordinate(payload.x)
    && isWorldCoordinate(payload.y),
  );
}

export function groupBlocksByChunk(blocks) {
  const groups = new Map();

  for (const block of blocks) {
    const key = chunkKeyForCell(block.x, block.y);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(block);
  }

  return groups;
}

export function encodeBlockUpdate(block) {
  let status = 0;
  if (block.revealed) status |= 1;
  if (block.flagged) status |= 2;
  if (block.mine && block.revealed) status |= 4;
  if (block.mistake) status |= 8;

  return [
    block.x,
    block.y,
    status,
    block.adjacentMines || 0,
    block.ownerColor || null,
    block.flagOwnerColor || null,
  ];
}
