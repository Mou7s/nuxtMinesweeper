import { getOptionalAuth } from '../../utils/requestAuth.mjs';
import { getOrCreateDailyChallenge, listScores } from '../../utils/appDataStore';
import { utcDateString } from '../../utils/challengeEngine.mjs';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : utcDateString();
  const challenge = await getOrCreateDailyChallenge(date);
  const auth = getOptionalAuth(event);
  return {
    challengeDate: date,
    ...(await listScores({ challengeId: challenge.id, userId: auth?.userId || null })),
  };
});
