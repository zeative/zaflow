import { pipeline } from '@xenova/transformers';
import { SentenceTokenizer } from 'natural';

/**
 * 🧠 Local Semantic Search Engine
 * Uses transformer models to find relevant context without API calls
 */
export class SemanticSearch {
  private static instance: SemanticSearch;
  private pipeline: any = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private tokenizer = new SentenceTokenizer(['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr']);
  private isInitialized = false;

  private constructor() {}

  /**
   * Singleton pattern for model reuse
   */
  static getInstance(): SemanticSearch {
    if (!SemanticSearch.instance) {
      SemanticSearch.instance = new SemanticSearch();
    }
    return SemanticSearch.instance;
  }

  /**
   * Initialize the transformer model (one-time download, ~23MB)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[SemanticSearch] Loading transformer model...');
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.isInitialized = true;
      console.log('[SemanticSearch] Model loaded successfully');
    } catch (error) {
      console.error('[SemanticSearch] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text (with caching)
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache
    const cacheKey = text.substring(0, 200); // Cache key from first 200 chars
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    // Generate embedding
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data) as number[];

    // Cache result
    this.embeddingCache.set(cacheKey, embedding);

    // Limit cache size
    if (this.embeddingCache.size > 1000) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Split text into semantic chunks (sentences grouped by length)
   */
  private semanticChunk(text: string, maxChunkLength: number = 200): string[] {
    const sentences = this.tokenizer.tokenize(text);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (currentChunk.length + trimmed.length < maxChunkLength) {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = trimmed;
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * 🔥 Find most relevant context from quoted message
   * @param quotedText - The long quoted text
   * @param replyText - The reply that provides context
   * @param options - Configuration options
   */
  async findRelevantContext(
    quotedText: string,
    replyText: string,
    options: {
      maxChunks?: number;
      minSimilarity?: number;
      maxChunkLength?: number;
    } = {},
  ): Promise<string> {
    const { maxChunks = 3, minSimilarity = 0.3, maxChunkLength = 200 } = options;

    // If text is short enough, return as-is
    if (quotedText.length <= maxChunkLength * maxChunks) {
      return quotedText;
    }

    try {
      // 1. Split into semantic chunks
      const chunks = this.semanticChunk(quotedText, maxChunkLength);

      // 2. Get embeddings
      const replyEmbedding = await this.getEmbedding(replyText);
      const chunkEmbeddings = await Promise.all(chunks.map((c) => this.getEmbedding(c)));

      // 3. Calculate similarities
      const similarities = chunkEmbeddings.map((emb, idx) => ({
        chunk: chunks[idx],
        score: this.cosineSimilarity(replyEmbedding, emb),
        index: idx,
      }));

      // 4. Filter and sort by score
      const relevant = similarities
        .filter((s) => s.score >= minSimilarity)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);

      // 5. Sort by original position and join
      const result = relevant
        .sort((a, b) => a.index - b.index)
        .map((r) => r.chunk)
        .join(' ');

      return result || quotedText.substring(0, maxChunkLength * maxChunks);
    } catch (error) {
      console.error('[SemanticSearch] Error finding relevant context:', error);
      // Fallback to simple truncation
      return quotedText.substring(0, maxChunkLength * maxChunks) + '...';
    }
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}

/**
 * Export singleton instance
 */
export const semanticSearch = SemanticSearch.getInstance();
