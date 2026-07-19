import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTIONS, adjacentMineCount, isMineAt } from '../server/utils/mineGenerator.mjs';

test('mine generation is deterministic for a world seed and coordinate', () => {
  const samples = [];
  for (let x = -20; x <= 20; x++) {
    for (let y = -20; y <= 20; y++) samples.push(isMineAt(x, y, 'test-seed'));
  }
  const repeated = [];
  for (let x = -20; x <= 20; x++) {
    for (let y = -20; y <= 20; y++) repeated.push(isMineAt(x, y, 'test-seed'));
  }
  assert.deepEqual(repeated, samples);
  assert.ok(samples.some(Boolean));
  assert.ok(samples.some(value => !value));
});

test('adjacent mine count matches the eight neighboring coordinates', () => {
  const seed = 'neighbor-test';
  const expected = DIRECTIONS.reduce((count, [offsetX, offsetY]) => (
    count + Number(isMineAt(12 + offsetX, -8 + offsetY, seed))
  ), 0);
  assert.equal(adjacentMineCount(12, -8, seed), expected);
  assert.ok(expected >= 0 && expected <= 8);
});
