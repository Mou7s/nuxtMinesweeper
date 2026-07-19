import { globalUserStore } from '../../utils/userStore';
import { signToken } from '../../utils/jwt';
import { isValidPassword, normalizeUsername } from '../../utils/authValidation.mjs';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const username = normalizeUsername(body?.username);
  const password = body?.password;

  if (!username || !isValidPassword(password)) {
    throw createError({
      statusCode: 400,
      statusMessage: '用户名或密码格式不正确'
    });
  }

  const user = await globalUserStore.validateUser(username, password);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '用户名或密码错误'
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
