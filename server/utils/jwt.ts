import { createHmac, randomBytes } from 'node:crypto';

// 生产环境应使用环境变量存储密钥
const JWT_SECRET = process.env.JWT_SECRET || 'minesweeper_dev_secret_fallback_key_stable';
const EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 天

export interface JwtPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * 签发 JWT token (HS256)
 */
export function signToken(user: { id: string; username: string }): string {
  const payload: JwtPayload = {
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
export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = parts[0] as string;
    const body = parts[1] as string;
    const signature = parts[2] as string;

    // 验证签名
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    // 解码 payload
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;

    // 验证过期时间
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

function base64url(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}