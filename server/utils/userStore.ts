import { useStorage } from '#imports';
import { crypto } from 'node:crypto';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  score: number;
  color: string;
  createdAt: number;
}

const PLAYER_COLORS = [
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
    return useStorage('data');
  }

  private hashPassword(password: string) {
    return btoa(password); // 演示版：简单编码。生产环境建议使用 crypto.scrypt
  }

  async createUser(username: string, password: string): Promise<User | null> {
    const storage = this.getStorage();
    const key = `user:${username.toLowerCase()}`;
    
    if (await storage.hasItem(key)) return null;

    const user: User = {
      id: Math.random().toString(36).substring(2, 10),
      username,
      passwordHash: this.hashPassword(password),
      score: 0,
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      createdAt: Date.now()
    };

    await storage.setItem(key, user);
    // 同时创建一个 ID 索引以便查找
    await storage.setItem(`userid:${user.id}`, username.toLowerCase());
    
    return user;
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const storage = this.getStorage();
    const user: any = await storage.getItem(`user:${username.toLowerCase()}`);
    
    if (user && user.passwordHash === this.hashPassword(password)) {
      return user;
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const storage = this.getStorage();
    const username: any = await storage.getItem(`userid:${id}`);
    if (!username) return null;
    return await storage.getItem(`user:${username}`) as User;
  }

  async updateScore(id: string, delta: number) {
    const storage = this.getStorage();
    const username: any = await storage.getItem(`userid:${id}`);
    if (!username) return;

    const user: any = await storage.getItem(`user:${username}`);
    if (user) {
      user.score += delta;
      await storage.setItem(`user:${username}`, user);
    }
  }
}

export const globalUserStore = new UserStore();
