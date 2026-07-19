import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPassword, normalizeUsername } from '../server/utils/authValidation.mjs';

test('usernames are trimmed and constrained', () => {
  assert.equal(normalizeUsername('  player  '), 'player');
  assert.equal(normalizeUsername('x'), null);
  assert.equal(normalizeUsername('a'.repeat(25)), null);
  assert.equal(normalizeUsername('player\nname'), null);
});

test('password validation supports login compatibility and stricter registration', () => {
  assert.equal(isValidPassword('x'), true);
  assert.equal(isValidPassword('12345', 6), false);
  assert.equal(isValidPassword('123456', 6), true);
  assert.equal(isValidPassword('x'.repeat(129)), false);
});
