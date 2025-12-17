import type { ContentPart } from './content';

/**
 * Quote configuration options
 */
export interface QuoteConfig {
  /**
   * Strategy for handling long quoted messages
   * - 'full': Include full quote (no truncation)
   * - 'semantic': Use semantic search to find relevant parts
   * - 'truncate': Simple truncation
   */
  strategy?: 'full' | 'semantic' | 'truncate';

  /**
   * Options for semantic search
   */
  semanticOptions?: {
    /** Enable semantic search (default: true if strategy is 'semantic') */
    enabled?: boolean;
    /** Maximum number of relevant chunks to include (default: 3) */
    maxChunks?: number;
    /** Minimum similarity score threshold (default: 0.3) */
    minSimilarity?: number;
    /** Maximum length per chunk (default: 200) */
    maxChunkLength?: number;
  };

  /**
   * Maximum length for truncation strategy (default: 300)
   */
  maxLength?: number;
}
