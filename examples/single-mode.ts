import ZaFlow, { defineProvider } from '../src';

/**
 * SINGLE Mode Example
 * Simple Q&A without tools
 */

async function main() {
  // Define provider
  const provider = defineProvider({
    name: 'groq',
    type: 'groq',
    apiKey: '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',
    defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  });

  // Create flow in SINGLE mode
  const flow = new ZaFlow({
    mode: 'single',
    provider,
    model: 'moonshotai/kimi-k2-instruct-0905',
    config: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  });

  console.log('🚀 ZaFlow - SINGLE Mode Example\n');

  // Simple conversation
  const response1 = await flow.run('Hello! Who are you?');
  console.log('Assistant:', response1.content);
  console.log('---\n');

  const response2 = await flow.run('What is the capital of France?');
  console.log('Assistant:', response2.content);
  console.log('---\n');

  // With detailed metadata
  const response3 = await flow.run('Tell me a fun fact about space', { detailed: true });
  console.log('Assistant:', response3.content);
  console.log('\nMetadata:');
  console.log('- Tokens used:', response3.metadata?.tokensUsed.total);
  console.log('- Execution time:', response3.metadata?.executionTime, 'ms');
  console.log('- Model:', response3.metadata?.model);
}

main().catch(console.error);
