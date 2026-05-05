import { globalUserStore } from '../../utils/userStore';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password } = body;

  const user = await globalUserStore.validateUser(username, password);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '用户名或密码错误'
    });
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      score: user.score,
      color: user.color
    }
  };
});
