import natural from 'natural';

const { TfIdf, SentenceTokenizer } = natural;

/**
 * 🧠 Local Context Search Engine (Lightweight TF-IDF)
 * Uses statistical relevance to find context without heavy ML models or native binaries
 */
export class SemanticSearch {
  private static instance: SemanticSearch;
  private tokenizer = new SentenceTokenizer(['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr']);

  private constructor() {}

  /**
   * Singleton pattern
   */
  static getInstance(): SemanticSearch {
    if (!SemanticSearch.instance) {
      SemanticSearch.instance = new SemanticSearch();
    }
    return SemanticSearch.instance;
  }

  /**
   * Initialize (No-op for TF-IDF, kept for API compatibility)
   */
  async initialize(): Promise<void> {
    // No heavy initialization needed! 🚀
    return;
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
   * 🔥 Find most relevant context using TF-IDF
   * @param quotedText - The long quoted text
   * @param replyText - The reply that provides context
   * @param options - Configuration options
   */
  async findRelevantContext(
    quotedText: string,
    replyText: string,
    options: {
      maxChunks?: number;
      minSimilarity?: number; // Not used in TF-IDF the same way, but kept for API
      maxChunkLength?: number;
    } = {},
  ): Promise<string> {
    const { maxChunks = 3, maxChunkLength = 200 } = options;

    // If text is short enough, return as-is
    if (quotedText.length <= maxChunkLength * maxChunks) {
      return quotedText;
    }

    try {
      // 1. Split into chunks
      const chunks = this.semanticChunk(quotedText, maxChunkLength);

      // 2. Create TF-IDF instance
      const tfidf = new TfIdf();

      // 3. Add chunks as documents
      chunks.forEach((chunk) => tfidf.addDocument(chunk));

      // 4. Score chunks against the reply text
      const scores: { index: number; score: number; chunk: string }[] = [];

      tfidf.tfidfs(replyText, (i, measure) => {
        scores.push({
          index: i,
          score: measure,
          chunk: chunks[i],
        });
      });

      // 5. Filter and sort by score
      // Note: TF-IDF scores are not normalized 0-1 like cosine similarity
      // We just take the top scoring ones that have > 0 score
      const relevant = scores
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);

      // If no relevant chunks found (score 0), fallback to first chunks or truncate
      if (relevant.length === 0) {
        return quotedText.substring(0, maxChunkLength * maxChunks) + '...';
      }

      // 6. Sort by original position and join
      const result = relevant
        .sort((a, b) => a.index - b.index)
        .map((r) => r.chunk)
        .join(' ');

      return result;
    } catch (error) {
      console.error('[SemanticSearch] Error finding relevant context:', error);
      // Fallback to simple truncation
      return quotedText.substring(0, maxChunkLength * maxChunks) + '...';
    }
  }

  /**
   * Clear cache (No-op)
   */
  clearCache(): void {
    // No cache needed
  }
}

/**
 * Export singleton instance
 */
export const semanticSearch = SemanticSearch.getInstance();
