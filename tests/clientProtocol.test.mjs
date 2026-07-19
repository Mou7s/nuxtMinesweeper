import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBlockUpdate, viewportChunkSignature } from '../assets/gameProtocol.mjs';

test('client decodes compact block flags and clears omitted colors', () => {
  assert.deepEqual(decodeBlockUpdate([1, -2, 15, 3, '#123456', '#abcdef']), {
    x: 1,
    y: -2,
    revealed: true,
    flagged: true,
    mine: true,
    mistake: true,
    adjacentMines: 3,
    ownerColor: '#123456',
    flagOwnerColor: '#abcdef',
  });

  const hidden = decodeBlockUpdate([1, 2, 0, 0, null, null]);
  assert.equal(hidden.revealed, false);
  assert.equal(hidden.flagOwnerColor, undefined);
});

test('viewport signatures only change when subscribed chunk coverage changes', () => {
  const initial = viewportChunkSignature({ x: 0, y: 0, cols: 20, rows: 15 });
  assert.equal(viewportChunkSignature({ x: 1, y: 1, cols: 20, rows: 15 }), initial);
  assert.notEqual(viewportChunkSignature({ x: 32, y: 0, cols: 20, rows: 15 }), initial);
  assert.equal(viewportChunkSignature({ x: -1, y: -1, cols: 20, rows: 15 }), '-2,-2,1,1');
});
