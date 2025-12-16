/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Use exponential backoff */
  exponentialBackoff?: boolean;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Callback on retry */
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable caching */
  enabled?: boolean;
  /** Cache strategy */
  strategy?: 'exact' | 'semantic';
  /** Cache TTL in milliseconds */
  ttl?: number;
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  /** Maximum tokens per request */
  maxPerRequest?: number;
  /** Maximum tokens per agent */
  maxPerAgent?: number;
  /** Budget distribution strategy */
  strategy?: 'distribute' | 'prioritize';
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  /** Enable compression */
  enableCompression?: boolean;
  /** Compression ratio target (0.0 - 1.0) */
  compressionRatio?: number;
  /** Enable caching */
  enableCaching?: boolean;
  /** Cache strategy */
  cacheStrategy?: 'exact' | 'semantic';
  /** Cache TTL */
  cacheTTL?: number;
  /** Token budget */
  tokenBudget?: TokenBudget;
  /** Lazy load tools */
  lazyLoadTools?: boolean;
  /** Tool selection threshold */
  toolSelectionThreshold?: number;
}
