import natural from 'natural';

const { TfIdf, SentenceTokenizer } = natural;

export class SemanticSearch {
  private static instance: SemanticSearch;
  private tokenizer = new SentenceTokenizer(['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr']);

  private constructor() {}

  static getInstance(): SemanticSearch {
    if (!SemanticSearch.instance) {
      SemanticSearch.instance = new SemanticSearch();
    }
    return SemanticSearch.instance;
  }

  async initialize(): Promise<void> {
    return;
  }

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

  async findRelevantContext(
    quotedText: string,
    replyText: string,
    options: {
      maxChunks?: number;
      minSimilarity?: number;
      maxChunkLength?: number;
    } = {},
  ): Promise<string> {
    const { maxChunks = 3, maxChunkLength = 200 } = options;

    if (quotedText.length <= maxChunkLength * maxChunks) {
      return quotedText;
    }

    try {
      const chunks = this.semanticChunk(quotedText, maxChunkLength);
      const tfidf = new TfIdf();

      chunks.forEach((chunk) => tfidf.addDocument(chunk));

      const scores: { index: number; score: number; chunk: string }[] = [];

      tfidf.tfidfs(replyText, (i, measure) => {
        scores.push({
          index: i,
          score: measure,
          chunk: chunks[i],
        });
      });

      const relevant = scores
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);

      if (relevant.length === 0) {
        return quotedText.substring(0, maxChunkLength * maxChunks) + '...';
      }

      const result = relevant
        .sort((a, b) => a.index - b.index)
        .map((r) => r.chunk)
        .join(' ');

      return result;
    } catch (error) {
      return quotedText.substring(0, maxChunkLength * maxChunks) + '...';
    }
  }

  clearCache(): void {
  }
}

export const semanticSearch = SemanticSearch.getInstance();
