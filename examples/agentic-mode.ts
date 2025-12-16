import ZaFlow, { defineTool, defineProvider } from '../src';
import { z } from 'zod';

/**
 * AGENTIC Mode Example
 * With tool calling (weather and calculator)
 */

async function main() {
  // Define tools
  const weatherTool = defineTool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    schema: z.object({
      city: z.string().describe('City name'),
      unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    }),
    execute: async (args) => {
      // Simulated API call
      console.log(`[TOOL] Getting weather for ${args.city}...`);
      return {
        city: args.city,
        temperature: 22,
        condition: 'Sunny',
        unit: args.unit,
        humidity: 65,
      };
    },
  });

  const calculatorTool = defineTool({
    name: 'calculator',
    description: 'Perform mathematical calculations',
    schema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    execute: async (args) => {
      console.log(`[TOOL] Calculating ${args.a} ${args.operation} ${args.b}...`);
      const ops: Record<string, number> = {
        add: args.a + args.b,
        subtract: args.a - args.b,
        multiply: args.a * args.b,
        divide: args.a / args.b,
      };
      return { result: ops[args.operation] };
    },
  });

  // Define provider
  const provider = defineProvider({
    name: 'groq',
    type: 'groq',
    apiKey: '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',
    defaultModel: 'moonshotai/kimi-k2-instruct-0905',
  });

  // Create flow in AGENTIC mode
  const flow = new ZaFlow({
    mode: 'agentic',
    provider,
    model: 'moonshotai/kimi-k2-instruct-0905',
    tools: [weatherTool, calculatorTool],
    config: {
      temperature: 0.7,
      maxTokens: 3000,
    },
    hooks: {
      onToolCall: (toolName, args) => {
        console.log(`\n[HOOK] Tool called: ${toolName}`, args);
      },
      onToolComplete: (toolName, result) => {
        console.log(`[HOOK] Tool completed: ${toolName}`, result);
      },
    },
  });

  console.log('🚀 ZaFlow - AGENTIC Mode Example\n');

  // Use tools
  const response = await flow.run('What is the weather in Jakarta? Also, calculate 15 * 24', { detailed: true });

  console.log('\n📝 Final Response:');
  console.log(response.content);

  console.log('\n📊 Metadata:');
  console.log('- Tools called:', response.metadata?.toolsCalled);
  console.log('- Tokens used:', response.metadata?.tokensUsed.total);
  console.log('- Execution time:', response.metadata?.executionTime, 'ms');
}

main().catch(console.error);
