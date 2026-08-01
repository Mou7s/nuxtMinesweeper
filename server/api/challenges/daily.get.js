import { utcDateString } from '../../utils/challengeEngine.mjs';
import { getOrCreateDailyChallenge } from '../../utils/appDataStore';

export default defineEventHandler(async () => {
  const challenge = await getOrCreateDailyChallenge(utcDateString());
  return {
    id: challenge.id,
    kind: challenge.kind,
    challengeDate: challenge.challengeDate,
    rows: challenge.rows,
    cols: challenge.cols,
    mines: challenge.mines,
  };
});
