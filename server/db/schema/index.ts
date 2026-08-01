import {
  integer,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  usernameLower: text('username_lower').notNull(),
  passwordHash: text('password_hash').notNull(),
  color: text('color').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  usernameUnique: uniqueIndex('users_username_lower_unique').on(table.usernameLower),
}));

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  challengeDate: text('challenge_date'),
  seed: text('seed').notNull(),
  rows: integer('rows').notNull(),
  cols: integer('cols').notNull(),
  mines: integer('mines').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  dateUnique: uniqueIndex('challenges_date_unique').on(table.challengeDate),
  kindIndex: index('challenges_kind_idx').on(table.kind),
}));

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  userId: text('user_id'),
  mode: text('mode').notNull(),
  roomId: text('room_id'),
  status: text('status').notNull(),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
  elapsedMs: integer('elapsed_ms'),
  penaltyMs: integer('penalty_ms').notNull().default(0),
  mineHits: integer('mine_hits').notNull().default(0),
  actionCount: integer('action_count').notNull().default(0),
  completionSeq: integer('completion_seq'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  userIndex: index('runs_user_idx').on(table.userId),
  challengeIndex: index('runs_challenge_idx').on(table.challengeId),
  roomIndex: index('runs_room_idx').on(table.roomId),
}));

export const dailyScores = sqliteTable('daily_scores', {
  challengeId: text('challenge_id').notNull(),
  userId: text('user_id').notNull(),
  runId: text('run_id').notNull(),
  effectiveMs: integer('effective_ms').notNull(),
  elapsedMs: integer('elapsed_ms').notNull(),
  penaltyMs: integer('penalty_ms').notNull(),
  mineHits: integer('mine_hits').notNull(),
  completionSeq: integer('completion_seq').notNull(),
  completedAt: integer('completed_at').notNull(),
}, (table) => ({
  primary: primaryKey({ columns: [table.challengeId, table.userId] }),
  rankingIndex: index('daily_scores_ranking_idx').on(table.challengeId, table.effectiveMs, table.completionSeq),
}));

export const challengeScores = sqliteTable('challenge_scores', {
  challengeId: text('challenge_id').notNull(),
  userId: text('user_id').notNull(),
  runId: text('run_id').notNull(),
  effectiveMs: integer('effective_ms').notNull(),
  elapsedMs: integer('elapsed_ms').notNull(),
  penaltyMs: integer('penalty_ms').notNull(),
  mineHits: integer('mine_hits').notNull(),
  completedAt: integer('completed_at').notNull(),
}, (table) => ({
  primary: primaryKey({ columns: [table.challengeId, table.userId] }),
  rankingIndex: index('challenge_scores_ranking_idx').on(table.challengeId, table.effectiveMs),
}));

export const runActions = sqliteTable('run_actions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),
  seq: integer('seq').notNull(),
  action: text('action').notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  receivedAt: integer('received_at').notNull(),
  result: text('result').notNull(),
}, (table) => ({
  sequenceUnique: uniqueIndex('run_actions_sequence_unique').on(table.runId, table.seq),
  runIndex: index('run_actions_run_idx').on(table.runId, table.seq),
}));

export const matchResults = sqliteTable('match_results', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  challengeId: text('challenge_id').notNull(),
  winnerUserId: text('winner_user_id'),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  resultJson: text('result_json').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  roomUnique: uniqueIndex('match_results_room_unique').on(table.roomId),
}));

export type User = typeof users.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Run = typeof runs.$inferSelect;
