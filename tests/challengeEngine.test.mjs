import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_COLS,
  BOARD_MINES,
  BOARD_ROWS,
  applyAction,
  createDailyChallenge,
  createRun,
  effectiveTimeMs,
} from '../server/utils/challengeEngine.mjs';

test('daily challenge is stable and creates exactly 40 mines', () => {
  const first = createDailyChallenge('2026-08-01');
  const second = createDailyChallenge('2026-08-01');
  assert.deepEqual(first, second);

  const run = createRun(first);
  assert.equal(run.rows, BOARD_ROWS);
  assert.equal(run.cols, BOARD_COLS);
  assert.equal(run.mines, BOARD_MINES);
  assert.equal(run.cells.filter(cell => cell.mine).length, BOARD_MINES);
});

test('flags are markers and mine penalties begin after the first hit', () => {
  const run = createRun(createDailyChallenge('2026-08-02'));
  const mines = run.cells.filter(cell => cell.mine).slice(0, 2);

  const flag = applyAction(run, { type: 'flag', x: 0, y: 0 }, 1000);
  assert.equal(flag.result, 'flag');
  assert.equal(run.cells[0].revealed, false);

  applyAction(run, { type: 'reveal', x: mines[0].x, y: mines[0].y }, 2000);
  assert.equal(run.mineHits, 1);
  assert.equal(run.penaltyMs, 0);

  applyAction(run, { type: 'reveal', x: mines[1].x, y: mines[1].y }, 3000);
  assert.equal(run.mineHits, 2);
  assert.equal(run.penaltyMs, 10_000);
  assert.equal(effectiveTimeMs(run), null);
});

test('revealing all safe cells completes the run and applies server time', () => {
  const run = createRun(createDailyChallenge('2026-08-03'));
  let now = 10_000;
  for (const cell of run.cells) {
    if (!cell.mine && !cell.flagged && !cell.revealed) {
      applyAction(run, { type: 'reveal', x: cell.x, y: cell.y }, now++);
    }
  }

  assert.equal(run.status, 'complete');
  assert.equal(run.finishedAt, now - 1);
  assert.equal(run.elapsedMs, now - 1 - 10_000);
  assert.equal(effectiveTimeMs(run), run.elapsedMs);
});

test('repeated actions on a revealed cell are rejected', () => {
  const run = createRun(createDailyChallenge('2026-08-04'));
  const safe = run.cells.find(cell => !cell.mine && cell.adjacentMines > 0) || run.cells.find(cell => !cell.mine);
  applyAction(run, { type: 'reveal', x: safe.x, y: safe.y }, 1000);
  const result = applyAction(run, { type: 'reveal', x: safe.x, y: safe.y }, 2000);
  assert.equal(result.result, 'ignored');
  assert.equal(run.actionCount, 1);
});
