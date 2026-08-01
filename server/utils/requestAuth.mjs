import { getHeader } from 'h3';
import { verifyToken } from './jwt';

export function getBearerToken(event) {
  const header = getHeader(event, 'authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export function getOptionalAuth(event) {
  const token = getBearerToken(event);
  return token ? verifyToken(token) : null;
}

export function requireAuth(event) {
  const payload = getOptionalAuth(event);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: '请先登录' });
  }
  return payload;
}
