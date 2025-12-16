/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

/**
 * Storage definition
 */
export interface StorageDefinition {
  name: string;
  adapter: StorageAdapter;
}

/**
 * Storage plugin interface
 */
export interface StoragePlugin {
  name: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  has(key: string): Promise<boolean>;
}
