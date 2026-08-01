import { db } from 'hub:db';
import { eq } from 'drizzle-orm';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { users } from '../db/schema/index';

export const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

export class UserStore {
  hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(password, salt, 64, (error, derivedKey) => {
        if (error) return reject(error);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const [salt, encodedKey] = String(hash || '').split(':');
      if (!salt || !encodedKey) return resolve(false);
      scrypt(password, salt, 64, (error, derivedKey) => {
        if (error) return reject(error);
        const expected = Buffer.from(encodedKey, 'hex');
        resolve(expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey));
      });
    });
  }

  async createUser(username, password, color) {
    const usernameLower = username.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.usernameLower, usernameLower))
      .get();
    if (existing) return null;

    const user = {
      id: randomBytes(16).toString('hex'),
      username,
      usernameLower,
      passwordHash: await this.hashPassword(password),
      color: PLAYER_COLORS.includes(color)
        ? color
        : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      createdAt: Date.now(),
    };

    try {
      await db.insert(users).values(user).run();
      return user;
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('unique')) return null;
      throw error;
    }
  }

  async validateUser(username, password) {
    const user = await db.select().from(users)
      .where(eq(users.usernameLower, username.toLowerCase()))
      .get();
    if (!user) return null;

    try {
      return await this.verifyPassword(password, user.passwordHash) ? user : null;
    } catch (error) {
      console.error('[UserStore] Password verification failed:', error);
      return null;
    }
  }

  async getUserById(id) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
}

export const globalUserStore = new UserStore();
