import ZaFlow, { defineProvider } from '../src';

/**
 * Streaming Example
 * Real-time response streaming
 */

async function main() {
  const provider = defineProvider({
    name: 'groq',
    type: 'groq',
    apiKey: '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',
    defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  });

  const flow = new ZaFlow({
    mode: 'single',
    provider,
    model: 'moonshotai/kimi-k2-instruct-0905',
    hooks: {
      onStreamChunk: (chunk) => {
        // Process each chunk
        // console.log('[CHUNK]', chunk);
      },
      onStreamComplete: (fullText) => {
        console.log('\n\n✅ Streaming complete!');
        console.log(`Total length: ${fullText.length} characters`);
      },
    },
  });

  console.log('🚀 ZaFlow - Streaming Example\n');
  console.log('Question: Tell me a short story about AI\n');
  console.log('Response (streaming):');
  console.log('---');

  // Stream the response
  for await (const chunk of flow.stream('Tell me a short story about AI and robots')) {
    process.stdout.write(chunk);
  }
}

main().catch(console.error);
