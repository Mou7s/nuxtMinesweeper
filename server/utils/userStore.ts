import { useStorage } from '#imports';
import { scrypt, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

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

// 生产环境应通过环境变量注入密钥
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : randomBytes(32); // 临时密钥，重启后失效（开发环境用）

export class UserStore {
  private initialized = false;

  async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
  }

  private getStorage() {
    return useStorage('data');
  }

  // ─── AES-256-GCM 加密 ───────────────────────────────────
  private encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // 格式: iv:tag:ciphertext (全部 hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    const ivHex = parts[0] as string;
    const tagHex = parts[1] as string;
    const dataHex = parts[2] as string;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
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

    // 加密后存储
    await storage.setItem(key, this.encrypt(JSON.stringify(user)));
    await storage.setItem(`userid:${user.id}`, this.encrypt(username.toLowerCase()));
    
    return user;
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const storage = this.getStorage();
    const encrypted: any = await storage.getItem(`user:${username.toLowerCase()}`);
    if (!encrypted) return null;

    try {
      const user: User = JSON.parse(this.decrypt(encrypted));
      const valid = await this.verifyPassword(password, user.passwordHash);
      if (valid) return user;
    } catch (e) {}
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const storage = this.getStorage();
    const encryptedUsername: any = await storage.getItem(`userid:${id}`);
    if (!encryptedUsername) return null;

    try {
      const username = this.decrypt(encryptedUsername);
      const encryptedUser: any = await storage.getItem(`user:${username}`);
      if (!encryptedUser) return null;
      return JSON.parse(this.decrypt(encryptedUser)) as User;
    } catch (e) {
      return null;
    }
  }

  async updateScore(id: string, delta: number) {
    const storage = this.getStorage();
    const encryptedUsername: any = await storage.getItem(`userid:${id}`);
    if (!encryptedUsername) return;

    try {
      const username = this.decrypt(encryptedUsername);
      const encryptedUser: any = await storage.getItem(`user:${username}`);
      if (!encryptedUser) return;

      const user: User = JSON.parse(this.decrypt(encryptedUser));
      user.score += delta;
      await storage.setItem(`user:${username}`, this.encrypt(JSON.stringify(user)));
    } catch (e) {}
  }
}

export const globalUserStore = new UserStore();