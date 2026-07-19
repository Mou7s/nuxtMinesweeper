export const DIRECTIONS = [
  [1, 1], [1, 0], [1, -1], [0, -1],
  [-1, -1], [-1, 0], [-1, 1], [0, 1],
];

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(value) {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash;
}

export function isMineAt(x, y, worldSeed) {
  const coordinateSeed = stringToSeed(`${x},${y},${worldSeed}`);
  return mulberry32(coordinateSeed)() < 0.15;
}

export function adjacentMineCount(x, y, worldSeed) {
  let count = 0;
  for (const [offsetX, offsetY] of DIRECTIONS) {
    if (isMineAt(x + offsetX, y + offsetY, worldSeed)) count++;
  }
  return count;
}
