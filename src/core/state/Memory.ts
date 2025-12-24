import { MemoryStorage } from '../../plugins/storage/MemoryStorage';
import type { Hooks } from '../../types/hooks';
import type { SharedMemory } from '../../types/tool';

export class SharedMemoryPool implements SharedMemory {
  private storage: MemoryStorage;
  private hooks?: Hooks;

  constructor(hooks?: Hooks) {
    this.storage = new MemoryStorage();
    this.hooks = hooks;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.storage.get<T>(key);

    if (value !== null) {
      this.hooks?.onMemoryRead?.(key, value);
    }

    return value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.storage.set(key, value, ttl);
    this.hooks?.onMemoryWrite?.(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    return await this.storage.keys(pattern);
  }

  async has(key: string): Promise<boolean> {
    return await this.storage.has(key);
  }
}
