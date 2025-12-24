import pRetry from 'p-retry';
import { RetryConfig } from '../../types/optimization';

const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  exponentialBackoff: true,
  maxDelay: 10000,
};

export async function retryWithBackoff<T>(fn: () => Promise<T>, config?: RetryConfig): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return pRetry(fn, {
    retries: finalConfig.maxAttempts - 1,
    factor: finalConfig.exponentialBackoff ? 2 : 1,
    minTimeout: finalConfig.initialDelay,
    maxTimeout: finalConfig.maxDelay,
    onFailedAttempt: async (error) => {
      if (finalConfig.onRetry) {
        await finalConfig.onRetry(error.attemptNumber, error);
      }
    },
  });
}
