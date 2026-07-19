import { globalUserStore } from '../../utils/userStore';
import { signToken } from '../../utils/jwt';
import { isValidPassword, normalizeUsername } from '../../utils/authValidation.mjs';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const username = normalizeUsername(body?.username);
  const password = body?.password;
  const color = body?.color;

  if (!username || !isValidPassword(password, 6)) {
    throw createError({
      statusCode: 400,
      statusMessage: '用户名需为 2-24 个字符，密码需为 6-128 个字符'
    });
  }

  const user = await globalUserStore.createUser(username, password, color);
  if (!user) {
    throw createError({
      statusCode: 409,
      statusMessage: '用户名已存在'
    });
  }

  const token = signToken({ id: user.id, username: user.username });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      score: user.score,
      color: user.color
    }
  };
});
