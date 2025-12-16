/**
 * Create an async iterable from chunks
 */
export async function* streamFromChunks(chunks: string[]): AsyncIterableIterator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Collect all chunks from an async iterable
 */
export async function collectChunks(stream: AsyncIterableIterator<string>): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Simulate streaming by chunking text
 */
export async function* simulateStreaming(text: string, chunkSize: number = 3, delayMs: number = 20): AsyncIterableIterator<string> {
  const words = text.split(' ');

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
    yield chunk;

    // Add delay to simulate network latency
    if (i + chunkSize < words.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
