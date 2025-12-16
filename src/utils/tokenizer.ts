/**
 * Estimate token count for text
 * Approximation: ~4 characters per token on average
 */
export function estimateTokens(text: string): number {
  // Simple approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens in messages
 */
export function countMessageTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0;

  for (const message of messages) {
    // Count role tokens
    total += estimateTokens(message.role);
    // Count content tokens
    total += estimateTokens(message.content);
    // Add overhead for message structure (~3 tokens)
    total += 3;
  }

  // Add overhead for message array structure
  total += 3;

  return total;
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Approximate character count needed
  const targetChars = maxTokens * 4;
  return text.substring(0, targetChars) + '...';
}
