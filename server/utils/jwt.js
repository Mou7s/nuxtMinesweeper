import { createHmac, timingSafeEqual } from 'node:crypto';

// 生产环境应使用环境变量存储密钥
const JWT_SECRET = process.env.JWT_SECRET || 'minesweeper_dev_secret_fallback_key_stable';
const EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 签发 JWT token (HS256)
 */
export function signToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    iat: Date.now(),
    exp: Date.now() + EXPIRES_IN,
  };

  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url(payload);
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * 验证并解码 JWT token
 */
export function verifyToken(token) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = parts[0];
    const body = parts[1];
    const signature = parts[2];

    // 验证签名
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') return null;

    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    // 解码 payload
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

    // 验证过期时间
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
