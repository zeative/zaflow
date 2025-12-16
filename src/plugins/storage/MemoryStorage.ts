import type { StoragePlugin } from '../../types/storage';

/**
 * In-memory storage with TTL support
 */
export class MemoryStorage implements StoragePlugin {
  name = 'memory';
  private store: Map<string, { value: any; expiry?: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);

    if (!item) {
      return null;
    }

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const item: { value: T; expiry?: number } = { value };

    if (ttl) {
      item.expiry = Date.now() + ttl;
    }

    this.store.set(key, item);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());

    if (!pattern) {
      return keys;
    }

    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return keys.filter((key) => regex.test(key));
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}
