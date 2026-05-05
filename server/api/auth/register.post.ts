import { globalUserStore } from '../../utils/userStore';
import { signToken } from '../../utils/jwt';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password, color } = body;

  if (!username || !password || username.length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: '用户名或密码格式不正确'
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
