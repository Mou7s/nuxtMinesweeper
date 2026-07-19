import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_SIZE,
  chunkCoords,
  chunkKeysForViewport,
  chunkKeyForCell,
  encodeBlockUpdate,
  isValidActionPayload,
  normalizeViewport,
} from '../server/utils/gameProtocol.mjs';

test('chunk coordinates remain stable across positive and negative boundaries', () => {
  assert.deepEqual(chunkCoords(0, 0), { x: 0, y: 0 });
  assert.deepEqual(chunkCoords(CHUNK_SIZE - 1, CHUNK_SIZE - 1), { x: 0, y: 0 });
  assert.deepEqual(chunkCoords(CHUNK_SIZE, CHUNK_SIZE), { x: 1, y: 1 });
  assert.deepEqual(chunkCoords(-1, -1), { x: -1, y: -1 });
  assert.deepEqual(chunkCoords(-CHUNK_SIZE, -CHUNK_SIZE), { x: -1, y: -1 });
  assert.deepEqual(chunkCoords(-CHUNK_SIZE - 1, -CHUNK_SIZE - 1), { x: -2, y: -2 });
  assert.equal(chunkKeyForCell(-1, 32), '-1,1');
});

test('compact block updates preserve the visible state without leaking hidden mines', () => {
  assert.deepEqual(encodeBlockUpdate({
    x: 1,
    y: 2,
    revealed: true,
    flagged: false,
    mine: true,
    adjacentMines: 0,
    ownerColor: '#fff',
  }), [1, 2, 5, 0, '#fff', null]);

  const hiddenMine = encodeBlockUpdate({
    x: 3,
    y: 4,
    revealed: false,
    flagged: false,
    mine: true,
    adjacentMines: 0,
  });
  assert.equal(Boolean(hiddenMine[2] & 4), false);
});

test('viewport normalization rejects oversized and invalid requests', () => {
  assert.deepEqual(normalizeViewport({ x: -12.8, y: 3.4, cols: 40, rows: 25 }), {
    x: -12,
    y: 3,
    cols: 40,
    rows: 25,
  });
  assert.equal(normalizeViewport({ x: 0, y: 0, cols: 201, rows: 20 }), null);
  assert.equal(normalizeViewport({ x: Infinity, y: 0, cols: 20, rows: 20 }), null);
  assert.equal(normalizeViewport({ x: null, y: 0, cols: 20, rows: 20 }), null);
  assert.equal(normalizeViewport(null), null);
});

test('viewport chunk list includes one prefetch chunk around the visible area', () => {
  const keys = chunkKeysForViewport({ x: 0, y: 0, cols: 32, rows: 32 });
  assert.equal(keys.length, 9);
  assert.ok(keys.includes('-1,-1'));
  assert.ok(keys.includes('0,0'));
  assert.ok(keys.includes('1,1'));
});

test('action payload validation only accepts known actions and integer coordinates', () => {
  assert.equal(isValidActionPayload({ action: 'click', x: -1, y: 2 }), true);
  assert.equal(isValidActionPayload({ action: 'reset', x: 0, y: 0 }), false);
  assert.equal(isValidActionPayload({ action: 'click', x: 0.5, y: 0 }), false);
  assert.equal(isValidActionPayload({ action: 'click', x: 10000001, y: 0 }), false);
});
