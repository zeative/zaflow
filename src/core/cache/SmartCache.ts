import { LRUCache } from 'lru-cache';

export class SmartCache {
  private cache: LRUCache<string, any>;

  constructor(max: number = 500) {
    this.cache = new LRUCache({
      max,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  get(key: string): any | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
      this.cache.clear();
  }
}
