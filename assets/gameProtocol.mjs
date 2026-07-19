export function decodeBlockUpdate(update) {
  if (!Array.isArray(update)) return update;
  const [x, y, status, adjacentMines, ownerColor, flagOwnerColor] = update;
  return {
    x,
    y,
    revealed: Boolean(status & 1),
    flagged: Boolean(status & 2),
    mine: Boolean(status & 4),
    mistake: Boolean(status & 8),
    adjacentMines,
    ownerColor: ownerColor || undefined,
    flagOwnerColor: flagOwnerColor || undefined,
  };
}

export function viewportChunkSignature(viewport, chunkSize = 32) {
  const minChunkX = Math.floor(viewport.x / chunkSize) - 1;
  const minChunkY = Math.floor(viewport.y / chunkSize) - 1;
  const maxChunkX = Math.floor((viewport.x + viewport.cols - 1) / chunkSize) + 1;
  const maxChunkY = Math.floor((viewport.y + viewport.rows - 1) / chunkSize) + 1;
  return `${minChunkX},${minChunkY},${maxChunkX},${maxChunkY}`;
}
