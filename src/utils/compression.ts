import nlp from 'compromise';
import { estimateTokens } from './tokenizer';

/**
 * 🗜️ TEXT COMPRESSION UTILITIES
 *
 * Smart text compression for token optimization without losing context
 */

export interface CompressionOptions {
  /** Target compression ratio (0-1). Lower = more aggressive */
  targetRatio?: number;
  /** Preserve entities (dates, numbers, names) */
  preserveEntities?: boolean;
  /** Keep important sentences based on scoring */
  keepImportant?: boolean;
  /** Maximum tokens allowed */
  maxTokens?: number;
}

/**
 * Compress text using extractive summarization
 */
export function compressText(text: string, options: CompressionOptions = {}): string {
  const { targetRatio = 0.5, preserveEntities = true, keepImportant = true, maxTokens } = options;

  if (!text || text.length === 0) return text;

  const doc = nlp(text);
  const sentences = doc.sentences().out('array');

  if (sentences.length <= 1) return text;

  // Calculate target sentence count
  const targetCount = Math.max(1, Math.ceil(sentences.length * targetRatio));

  // Score sentences based on importance
  const scoredSentences = sentences.map((sentence, index) => {
    let score = 0;

    // Position bias: first and last sentences are often important
    if (index === 0) score += 3;
    if (index === sentences.length - 1) score += 2;

    // Length bias: moderate length sentences tend to be more informative
    const words = sentence.split(/\s+/).length;
    if (words >= 5 && words <= 20) score += 2;

    // Entity density: sentences with entities are often important
    if (preserveEntities) {
      const sentDoc = nlp(sentence);
      const entities = sentDoc.topics().out('array').length;
      const numbers = sentDoc.numbers().out('array').length;
      const dates = sentDoc.dates().out('array').length;
      score += (entities + numbers + dates) * 2;
    }

    // Keyword density: sentences with key terms
    const hasKeywords = /\b(important|critical|must|should|need|require|because|therefore|however)\b/i.test(sentence);
    if (hasKeywords) score += 3;

    return { sentence, score, index };
  });

  // Sort by score and select top N
  const selected = keepImportant
    ? scoredSentences
        .sort((a, b) => b.score - a.score)
        .slice(0, targetCount)
        .sort((a, b) => a.index - b.index) // Maintain original order
    : scoredSentences.slice(0, targetCount);

  let compressed = selected.map((s) => s.sentence).join(' ');

  // If maxTokens specified, truncate further if needed
  if (maxTokens) {
    const currentTokens = estimateTokens(compressed);
    if (currentTokens > maxTokens) {
      const targetChars = Math.floor((maxTokens / currentTokens) * compressed.length);
      compressed = compressed.substring(0, targetChars) + '...';
    }
  }

  return compressed;
}

/**
 * Compress conversation history intelligently
 */
export function compressHistory(
  messages: Array<{ role: string; content: string }>,
  options: CompressionOptions = {},
): Array<{ role: string; content: string }> {
  const { maxTokens = 1000 } = options;

  // Always keep system message uncompressed
  const systemMessages = messages.filter((m) => m.role === 'system');
  const otherMessages = messages.filter((m) => m.role !== 'system');

  if (otherMessages.length === 0) return messages;

  // Calculate current token usage
  let totalTokens = systemMessages.reduce((sum, m) => sum + estimateTokens(m.role + m.content), 0);

  const compressed: Array<{ role: string; content: string }> = [...systemMessages];
  const budget = maxTokens - totalTokens;

  if (budget <= 0) {
    // Keep only most recent messages
    const recentCount = Math.max(2, Math.floor(otherMessages.length * 0.3));
    return [...systemMessages, ...otherMessages.slice(-recentCount)];
  }

  // Sliding window with summarization
  // Keep recent messages, compress old ones
  const recentCount = Math.floor(otherMessages.length * 0.4); // Keep 40% recent
  const recentMessages = otherMessages.slice(-recentCount);
  const oldMessages = otherMessages.slice(0, -recentCount);

  // Compress old messages
  if (oldMessages.length > 0) {
    const oldContent = oldMessages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const compressedOld = compressText(oldContent, {
      targetRatio: 0.3,
      maxTokens: Math.floor(budget * 0.3),
    });

    compressed.push({
      role: 'system',
      content: `[Previous conversation summary]: ${compressedOld}`,
    });
  }

  // Add recent messages (also compress if needed)
  for (const msg of recentMessages) {
    const msgTokens = estimateTokens(msg.content);

    if (msgTokens > 200) {
      // Compress long messages
      compressed.push({
        ...msg,
        content: compressText(msg.content, { targetRatio: 0.6, maxTokens: 150 }),
      });
    } else {
      compressed.push(msg);
    }

    totalTokens += msgTokens;
  }

  return compressed;
}

/**
 * Normalize and compress context object
 */
export function compressContext(context: Record<string, any>, maxTokens: number = 200): string {
  const entries = Object.entries(context);

  if (entries.length === 0) return '';

  // Convert to compact string representation
  const parts: string[] = [];

  for (const [key, value] of entries) {
    let compressed: string;

    if (typeof value === 'string') {
      // Compress long strings
      if (value.length > 100) {
        compressed = `${key}: ${value.substring(0, 50)}...`;
      } else {
        compressed = `${key}: ${value}`;
      }
    } else if (Array.isArray(value)) {
      compressed = `${key}: [${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      compressed = `${key}: {${Object.keys(value).length} props}`;
    } else {
      compressed = `${key}: ${value}`;
    }

    parts.push(compressed);
  }

  let result = parts.join(', ');

  // Truncate if still too long
  const tokens = estimateTokens(result);
  if (tokens > maxTokens) {
    const targetChars = Math.floor((maxTokens / tokens) * result.length);
    result = result.substring(0, targetChars) + '...';
  }

  return result;
}

/**
 * Extract and preserve key entities from text
 */
export function extractKeyEntities(text: string): {
  numbers: string[];
  dates: string[];
  topics: string[];
  organizations: string[];
} {
  const doc = nlp(text);

  return {
    numbers: doc.numbers().out('array'),
    dates: doc.dates().out('array'),
    topics: doc.topics().out('array'),
    organizations: doc.organizations().out('array'),
  };
}

/**
 * Smart truncation that preserves sentence boundaries
 */
export function smartTruncate(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);

  if (currentTokens <= maxTokens) return text;

  const doc = nlp(text);
  const sentences = doc.sentences().out('array');

  let result = '';
  let tokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (tokens + sentenceTokens <= maxTokens) {
      result += sentence + ' ';
      tokens += sentenceTokens;
    } else {
      break;
    }
  }

  return result.trim() + '...';
}
