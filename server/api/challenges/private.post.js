import { randomBytes } from 'node:crypto';
import { createPrivateChallenge } from '../../utils/challengeEngine.mjs';
import { createStoredChallenge } from '../../utils/appDataStore';
import { requireAuth } from '../../utils/requestAuth.mjs';

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event);
  const code = randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
  const challenge = createPrivateChallenge(`${code}:${randomBytes(24).toString('hex')}`, auth.userId);
  challenge.id = `private-${code}`;
  const stored = await createStoredChallenge(challenge);
  return {
    code,
    id: stored.id,
    kind: stored.kind,
    rows: stored.rows,
    cols: stored.cols,
    mines: stored.mines,
    url: `/challenge/${code}`,
  };
});
