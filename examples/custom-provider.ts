import ZaFlow, { defineProvider } from '../src';
import type { ProviderMessage, ProviderResponse } from '../src/types';
import type { ModelConfig } from '../src/types';
import type { Tool } from '../src/types';

/**
 * Custom Provider Example
 * This shows how to integrate any LLM API with ZaFlow
 */

async function main() {
  // Define a custom provider
  const customProvider = defineProvider({
    name: 'my_custom_api',
    type: 'custom',
    adapter: async (messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> => {
      // Example: Call your custom API
      console.log('[CUSTOM API] Sending request...');
      console.log('Messages:', messages.length);
      console.log('Config:', config);
      console.log('Tools:', tools?.length || 0);

      // Simulate API call
      const response = await simulateCustomAPI(messages, config, tools);

      // Return normalized response
      return {
        content: response.text,
        usage: {
          promptTokens: response.tokensIn,
          completionTokens: response.tokensOut,
          totalTokens: response.tokensIn + response.tokensOut,
        },
      };
    },
  });

  // Create flow with custom provider
  const flow = new ZaFlow({
    mode: 'single',
    provider: customProvider,
    model: 'custom-model-v1',
    config: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  });

  console.log('🚀 ZaFlow - Custom Provider Example\n');

  const response = await flow.run('Hello! How does custom provider integration work?');
  console.log('Assistant:', response.content);
}

/**
 * Simulate a custom LLM API
 * Replace this with actual API calls to your LLM service
 */
async function simulateCustomAPI(
  messages: ProviderMessage[],
  config: ModelConfig,
  tools?: Tool[],
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Example response
  const text = `I'm a response from a custom LLM provider! 
  
The custom provider adapter allows you to integrate ZaFlow with ANY LLM API by:

1. **Normalizing Inputs**: Convert ZaFlow's standard message format to your API's format
2. **Making API Calls**: Use your API's SDK or HTTP client
3. **Normalizing Outputs**: Convert the response back to ZaFlow's format

This makes ZaFlow extremely flexible - you can use it with:
- Proprietary LLMs (Claude, Gemini, etc.)
- Self-hosted models
- Custom fine-tuned models
- Any HTTP-based LLM API

The adapter function receives:
- Messages array (conversation history)
- Config (temperature, max tokens, etc.)
- Tools (optional, for function calling)

And returns:
- content (the response text)
- usage (token counts)
- toolCalls (optional, if the model supports it)`;

  return {
    text,
    tokensIn: 150,
    tokensOut: 200,
  };
}

main().catch(console.error);
