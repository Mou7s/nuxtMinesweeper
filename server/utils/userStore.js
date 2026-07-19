import { useStorage } from '#imports';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

export const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

export class UserStore {
  initialized = false;

  async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
  }

  getStorage() {
    return useStorage('kv');
  }

  // ─── 密码哈希 (scrypt) ──────────────────────────────────
  hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const parts = hash.split(':');
      const salt = parts[0];
      const key = parts[1];
      if (!salt || !key) return resolve(false);
      scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
      });
    });
  }

  // ─── CRUD 操作 ──────────────────────────────────────────
  async createUser(username, password, color) {
    const storage = this.getStorage();
    const key = `user:${username.toLowerCase()}`;
    
    if (await storage.hasItem(key)) return null;

    const selectedColor = PLAYER_COLORS.includes(color) ? color : null;
    const user = {
      id: randomBytes(8).toString('hex'),
      username,
      passwordHash: await this.hashPassword(password),
      score: 0,
      color: selectedColor || PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      createdAt: Date.now()
    };

    // 明文 JSON 存储
    await storage.setItem(key, user);
    await storage.setItem(`userid:${user.id}`, username.toLowerCase());
    
    return user;
  }

  async validateUser(username, password) {
    const storage = this.getStorage();
    const user = await storage.getItem(`user:${username.toLowerCase()}`);
    if (!user) return null;

    try {
      const valid = await this.verifyPassword(password, user.passwordHash);
      if (valid) return user;
    } catch (error) {
      console.error('[UserStore] Password verification failed:', error);
    }
    return null;
  }

  async getUserById(id) {
    const storage = this.getStorage();
    const username = await storage.getItem(`userid:${id}`);
    if (!username) return null;

    try {
      return await storage.getItem(`user:${username}`);
    } catch (error) {
      console.error(`[UserStore] Failed to load user ${id}:`, error);
      return null;
    }
  }

  async updateScore(id, delta) {
    const storage = this.getStorage();
    const username = await storage.getItem(`userid:${id}`);
    if (!username) return;

    try {
      const user = await storage.getItem(`user:${username}`);
      if (!user) return;

      user.score += delta;
      await storage.setItem(`user:${username}`, user);
    } catch (error) {
      console.error(`[UserStore] Failed to update score for ${id}:`, error);
      throw error;
    }
  }
}

export const globalUserStore = new UserStore();
