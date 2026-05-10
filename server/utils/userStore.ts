import { useStorage } from '#imports';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  score: number;
  color: string;
  createdAt: number;
}

export const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

export class UserStore {
  private initialized = false;

  async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
  }

  private getStorage() {
    return useStorage('kv');
  }

  // ─── 密码哈希 (scrypt) ──────────────────────────────────
  private hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  private verifyPassword(password: string, hash: string): Promise<boolean> {
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
  async createUser(username: string, password: string, color?: string): Promise<User | null> {
    const storage = this.getStorage();
    const key = `user:${username.toLowerCase()}`;
    
    if (await storage.hasItem(key)) return null;

    const user: User = {
      id: Math.random().toString(36).substring(2, 10),
      username,
      passwordHash: await this.hashPassword(password),
      score: 0,
      color: (color || PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]) as string,
      createdAt: Date.now()
    };

    // 明文 JSON 存储
    await storage.setItem(key, user);
    await storage.setItem(`userid:${user.id}`, username.toLowerCase());
    
    return user;
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const storage = this.getStorage();
    const user: any = await storage.getItem(`user:${username.toLowerCase()}`);
    if (!user) return null;

    try {
      const valid = await this.verifyPassword(password, user.passwordHash);
      if (valid) return user;
    } catch (e) {}
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const storage = this.getStorage();
    const username: any = await storage.getItem(`userid:${id}`);
    if (!username) return null;

    try {
      return await storage.getItem(`user:${username}`) as User;
    } catch (e) {
      return null;
    }
  }

  async updateScore(id: string, delta: number) {
    const storage = this.getStorage();
    const username: any = await storage.getItem(`userid:${id}`);
    if (!username) return;

    try {
      const user: any = await storage.getItem(`user:${username}`);
      if (!user) return;

      user.score += delta;
      await storage.setItem(`user:${username}`, user);
    } catch (e) {}
  }
}

export const globalUserStore = new UserStore();
