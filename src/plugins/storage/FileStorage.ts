import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import type { StoragePlugin } from '../../types/storage';

export interface FileStorageOptions {
  path: string;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

/**
 * File-based persistent storage
 */
export class FileStorage implements StoragePlugin {
  name = 'file';
  private basePath: string;
  private serialize: (value: any) => string;
  private deserialize: (value: string) => any;
  private ttlStore: Map<string, number> = new Map();

  constructor(options: FileStorageOptions) {
    this.basePath = options.path;
    this.serialize = options.serialize || JSON.stringify;
    this.deserialize = options.deserialize || JSON.parse;
  }

  private getFilePath(key: string): string {
    return join(this.basePath, `${key}.json`);
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Check TTL
      const expiry = this.ttlStore.get(key);
      if (expiry && Date.now() > expiry) {
        await this.delete(key);
        return null;
      }

      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      return this.deserialize(data) as T;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    await this.ensureDir(filePath);

    const data = this.serialize(value);
    await fs.writeFile(filePath, data, 'utf-8');

    if (ttl) {
      this.ttlStore.set(key, Date.now() + ttl);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      this.ttlStore.delete(key);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
      await fs.mkdir(this.basePath, { recursive: true });
      this.ttlStore.clear();
    } catch (error) {
      // Ignore errors
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.basePath);
      let keys = files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

      if (pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        keys = keys.filter((key) => regex.test(key));
      }

      return keys;
    } catch (error) {
      return [];
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}
