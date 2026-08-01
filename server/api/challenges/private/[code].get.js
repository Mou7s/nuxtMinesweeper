import { getChallengeById } from '../../../utils/appDataStore';

export default defineEventHandler(async (event) => {
  const code = String(getRouterParam(event, 'code') || '').toUpperCase();
  if (!/^[A-Z0-9_-]{4,16}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: '挑战码无效' });
  }
  const challenge = await getChallengeById(`private-${code}`);
  if (!challenge) throw createError({ statusCode: 404, statusMessage: '挑战不存在' });
  return {
    code,
    id: challenge.id,
    kind: challenge.kind,
    rows: challenge.rows,
    cols: challenge.cols,
    mines: challenge.mines,
  };
});
