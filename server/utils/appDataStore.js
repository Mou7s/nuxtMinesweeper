import { and, asc, eq } from 'drizzle-orm';
import { db } from 'hub:db';
import {
  challenges,
  challengeScores,
  dailyScores,
  matchResults,
  runActions,
  runs,
  users,
} from '../db/schema/index';
import { createDailyChallenge } from './challengeEngine.mjs';

export async function getOrCreateDailyChallenge(date) {
  const expected = createDailyChallenge(date);
  const existing = await db.select().from(challenges)
    .where(eq(challenges.id, expected.id))
    .get();
  if (existing) return existing;

  try {
    await db.insert(challenges).values({
      id: expected.id,
      kind: expected.kind,
      challengeDate: expected.challengeDate,
      seed: expected.seed,
      rows: expected.rows,
      cols: expected.cols,
      mines: expected.mines,
      createdAt: Date.now(),
    }).run();
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('unique')) throw error;
  }

  return db.select().from(challenges).where(eq(challenges.id, expected.id)).get();
}

export async function getChallengeById(id) {
  return db.select().from(challenges).where(eq(challenges.id, id)).get();
}

export async function createStoredChallenge(challenge) {
  await db.insert(challenges).values({
    id: challenge.id,
    kind: challenge.kind,
    challengeDate: challenge.challengeDate,
    seed: challenge.seed,
    rows: challenge.rows,
    cols: challenge.cols,
    mines: challenge.mines,
    createdBy: challenge.createdBy || null,
    createdAt: Date.now(),
  }).run();
  return getChallengeById(challenge.id);
}

export async function createRunRecord({ id, challengeId, userId, mode, roomId = null }) {
  await db.insert(runs).values({
    id,
    challengeId,
    userId,
    mode,
    roomId,
    status: 'ready',
    startedAt: null,
    finishedAt: null,
    elapsedMs: null,
    penaltyMs: 0,
    mineHits: 0,
    actionCount: 0,
    completionSeq: null,
    createdAt: Date.now(),
  }).run();
}

export async function appendRunAction({ runId, seq, action, x, y, receivedAt, result }) {
  await db.insert(runActions).values({
    runId,
    seq,
    action,
    x,
    y,
    receivedAt,
    result: JSON.stringify(result),
  }).run();
}

export async function finishRun({ runId, challengeId, userId, mode, roomId = null, run, completionSeq = Date.now() }) {
  const effectiveMs = run.elapsedMs + run.penaltyMs;
  await db.update(runs).set({
    status: 'complete',
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    elapsedMs: run.elapsedMs,
    penaltyMs: run.penaltyMs,
    mineHits: run.mineHits,
    actionCount: run.actionCount,
    completionSeq,
  }).where(eq(runs.id, runId)).run();

  if (!userId) return { effectiveMs, completionSeq };

  const scoreTable = mode === 'daily' ? dailyScores : challengeScores;
  const existing = await db.select().from(scoreTable)
    .where(and(eq(scoreTable.challengeId, challengeId), eq(scoreTable.userId, userId)))
    .get();
  const isBetter = !existing
    || effectiveMs < existing.effectiveMs
    || (effectiveMs === existing.effectiveMs && completionSeq < existing.completionSeq);

  if (isBetter) {
    const values = mode === 'daily'
      ? {
          challengeId,
          userId,
          runId,
          effectiveMs,
          elapsedMs: run.elapsedMs,
          penaltyMs: run.penaltyMs,
          mineHits: run.mineHits,
          completionSeq,
          completedAt: run.finishedAt,
        }
      : {
          challengeId,
          userId,
          runId,
          effectiveMs,
          elapsedMs: run.elapsedMs,
          penaltyMs: run.penaltyMs,
          mineHits: run.mineHits,
          completedAt: run.finishedAt,
        };
    if (existing) {
      await db.update(scoreTable).set(values)
        .where(and(eq(scoreTable.challengeId, challengeId), eq(scoreTable.userId, userId))).run();
    } else {
      await db.insert(scoreTable).values(values).run();
    }
  }

  return { effectiveMs, completionSeq, isBest: isBetter };
}

export async function listScores({ challengeId, mode = 'daily', userId = null, limit = 100 }) {
  const scoreTable = mode === 'daily' ? dailyScores : challengeScores;
  const selection = {
    username: users.username,
    color: users.color,
    userId: users.id,
    effectiveMs: scoreTable.effectiveMs,
    elapsedMs: scoreTable.elapsedMs,
    penaltyMs: scoreTable.penaltyMs,
    mineHits: scoreTable.mineHits,
    completedAt: scoreTable.completedAt,
  };
  if (mode === 'daily') selection.completionSeq = scoreTable.completionSeq;
  const rows = await db.select(selection).from(scoreTable)
    .innerJoin(users, eq(scoreTable.userId, users.id))
    .where(eq(scoreTable.challengeId, challengeId))
    .orderBy(asc(scoreTable.effectiveMs), ...(mode === 'daily' ? [asc(scoreTable.completionSeq)] : []))
    .limit(Math.min(100, Math.max(1, limit)))
    .all();

  const me = userId ? rows.find(row => row.userId === userId) : null;
  return {
    entries: rows.map((row, index) => ({ ...row, rank: index + 1 })),
    me: me ? { ...me, rank: rows.indexOf(me) + 1 } : null,
  };
}

export async function saveMatchResult(result) {
  await db.insert(matchResults).values({
    id: result.id,
    roomId: result.roomId,
    challengeId: result.challengeId,
    winnerUserId: result.winnerUserId || null,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt || null,
    resultJson: JSON.stringify(result.players || []),
    createdAt: Date.now(),
  }).run();
}

export async function getUserProfile(userId) {
  return db.select({ id: users.id, username: users.username, color: users.color })
    .from(users).where(eq(users.id, userId)).get();
}
