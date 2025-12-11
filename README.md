# ZaFlow

Lightweight AI flow orchestration library for building flexible, repeatable AI workflows with any AI provider.

## Features

✨ **Provider Agnostic** - Works with OpenAI, Anthropic, or any custom AI API  
🔄 **Automatic Tool Orchestration** - AI automatically calls tools until task is complete  
🎯 **Smart Flow Control** - Conditional branching, loops, parallel execution  
💰 **Cost Optimization** - Built-in caching, retry logic, and cost tracking  
🔧 **Type Safe** - Full TypeScript support with Zod validation  
🪶 **Lightweight** - Minimal dependencies, maximum flexibility

## Installation

```bash
npm install zaflow zod
```

## Quick Start

```typescript
import { ZaFlow, defineTool, OpenAIProvider } from 'zaflow';
import { z } from 'zod';

// 1. Create a tool
const searchWeb = defineTool({
  name: 'search_web',
  description: 'Search the internet for information',
  schema: z.object({
    query: z.string().describe('Search query'),
  }),
  handler: async ({ query }) => {
    // Your search implementation
    const results = await fetch(`https://api.search.com?q=${query}`);
    return results.json();
  },
});

// 2. Setup ZaFlow
const zaflow = new ZaFlow({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_KEY,
  }),
});

// 3. Register tools
zaflow.registerTools([searchWeb]);

// 4. Run!
const result = await zaflow.run("What's the latest news about AI?");
console.log(result.output);
```

## Core Concepts

### Tools

Tools are functions that AI can call. Define them with Zod schemas for type safety:

```typescript
const calculateData = defineTool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  schema: z.object({
    expression: z.string(),
    precision: z.number().optional(),
  }),
  handler: async ({ expression, precision = 2 }) => {
    // Your calculation logic
    return eval(expression).toFixed(precision);
  },
  config: {
    timeout: 5000,
    cacheable: true,
    retryable: true,
    maxRetries: 3,
  },
});
```

### Multi-Step Flows

Chain multiple steps together:

```typescript
const flow = zaflow
  .step('research', async (ctx) => {
    const data = await ctx.ai({
      prompt: 'Research about ' + ctx.input,
    });
    ctx.set('researchData', data);
    return data;
  })

  .step('analyze', async (ctx) => {
    const data = ctx.get('researchData');
    return await ctx.ai({
      prompt: `Analyze this: ${data}`,
      temperature: 0.3,
    });
  })

  .step('save', async (ctx) => {
    await database.save(ctx.previous);
    return { saved: true };
  });

await flow.run('AI trends 2024');
```

### Conditional Flows

```typescript
zaflow
  .step('check', async (ctx) => {
    const result = await ctx.ai('Is this data complete?');
    ctx.set('isComplete', result.includes('yes'));
    return result;
  })

  .if((ctx) => ctx.get('isComplete') === false)
  .then([
    zaflow.step('fetch_more', async (ctx) => {
      return await ctx.ai('Fetch additional data');
    }),
  ])
  .else([
    zaflow.step('proceed', async (ctx) => {
      return { skipped: true };
    }),
  ])
  .endif()

  .step('finalize', async (ctx) => {
    return await ctx.ai('Create final report');
  });
```

### Loops

```typescript
zaflow
  .step('generate', async (ctx) => {
    return await ctx.ai('Generate article about ' + ctx.input);
  })

  .loop({
    condition: (ctx) => {
      const quality = ctx.get('qualityScore', 0);
      return quality < 0.85;
    },
    maxIterations: 5,
    steps: [
      zaflow.step('review', async (ctx) => {
        const review = await ctx.ai({
          prompt: `Review and score (0-1): ${ctx.previous}`,
          response_format: { type: 'json' },
        });

        const score = JSON.parse(review).score;
        ctx.set('qualityScore', score);
        return review;
      }),

      zaflow.step('improve', async (ctx) => {
        if (ctx.get('qualityScore') < 0.85) {
          return await ctx.ai(`Improve based on feedback`);
        }
        return ctx.previous;
      }),
    ],
  });
```

### Parallel Execution

```typescript
zaflow
  .parallel([
    zaflow.step('source_a', async (ctx) => {
      return await ctx.ai('Get data from source A');
    }),

    zaflow.step('source_b', async (ctx) => {
      return await ctx.ai('Get data from source B');
    }),

    zaflow.step('calculate', async (ctx) => {
      return calculateSomething(ctx.input);
    }),
  ])

  .step('merge', async (ctx) => {
    const [a, b, calc] = ctx.parallel;
    return await ctx.ai({
      prompt: `Merge: ${JSON.stringify({ a, b, calc })}`,
    });
  });
```

## Custom Providers

### Simple Custom Provider

```typescript
import { createProvider } from 'zaflow';

const myAI = createProvider({
  name: 'MyCustomAI',
  endpoint: 'https://my-ai-api.com/chat',
  headers: {
    Authorization: 'Bearer ' + process.env.MY_API_KEY,
  },

  mapRequest: (messages, options) => ({
    prompt: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
    max_tokens: options.maxTokens || 1000,
    temperature: options.temperature || 0.7,
  }),

  mapResponse: (apiResponse) => ({
    content: apiResponse.result || apiResponse.text,
    finishReason: 'stop',
    usage: {
      promptTokens: apiResponse.tokens_in || 0,
      completionTokens: apiResponse.tokens_out || 0,
      totalTokens: apiResponse.tokens_total || 0,
    },
  }),
});

const zaflow = new ZaFlow({ provider: myAI });
```

### Provider with Tool Support

```typescript
const advancedAI = createProvider({
  name: 'AdvancedAI',
  endpoint: 'https://advanced-ai.com/v1/chat',

  mapRequest: (messages, options) => ({
    messages,
    functions: options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.schema,
    })),
  }),

  mapResponse: (res) => ({
    content: res.message,
    toolCalls: res.function_calls?.map((fc) => ({
      id: fc.id,
      name: fc.name,
      arguments: fc.args,
    })),
    finishReason: res.done ? 'stop' : 'tool_calls',
  }),
});
```

### Multiple Providers in One Flow

```typescript
const openai = new OpenAIProvider({ apiKey: '...' });
const claude = new AnthropicProvider({ apiKey: '...' });

const zaflow = new ZaFlow({ provider: openai });

zaflow
  .step('research', async (ctx) => {
    return await ctx.ai('Research topic'); // Uses OpenAI
  })

  .step('analyze', async (ctx) => {
    return await ctx.ai({
      prompt: 'Deep analysis',
      provider: claude, // Override with Claude
    });
  });
```

## Advanced Features

### Cost Tracking

```typescript
const zaflow = new ZaFlow({
  provider: openai,
  cost: {
    trackUsage: true,
    budget: {
      maxCost: 1.0, // Stop at $1
      onExceed: 'stop',
    },
  },
});

const result = await zaflow.run('Task');
console.log(`Cost: $${result.cost.toFixed(4)}`);
console.log(`Tokens: ${result.tokens}`);
```

### State Persistence

```typescript
const zaflow = new ZaFlow({
  provider: openai,
  persistence: {
    enabled: true,
    path: './zaflow-state',
  },
});

// Run with ID
const result = await zaflow.run('Long task', {
  executionId: 'task-123',
});

// Resume later
const resumed = await zaflow.resume('task-123');
```

### Streaming

```typescript
const result = await zaflow.run('Generate essay', {
  stream: true,
  onChunk: (chunk) => {
    process.stdout.write(chunk.content);
  },
});
```

## API Reference

### ZaFlow

```typescript
class ZaFlow {
  constructor(config?: ZaFlowConfig);
  registerTools(tools: ToolDefinition[]): this;
  step(id: string, handler: StepHandler, options?: StepOptions): this;
  if(condition: Condition): ConditionalBuilder;
  loop(options: LoopOptions): this;
  parallel(steps: Step[]): this;
  run(input: string | Message[], options?: ExecutionOptions): Promise<ExecutionResult>;
}
```

### ExecutionContext

```typescript
interface ExecutionContext {
  input: any;
  previous: any;
  parallel: any[];
  tokens: number;
  cost: number;

  ai(prompt: string | AIOptions): Promise<string>;
  set(key: string, value: any): void;
  get<T>(key: string, defaultValue?: T): T;
  has(key: string): boolean;
  addMessage(role: string, content: string): void;
}
```

### Tool Definition

```typescript
defineTool({
  name: string
  description: string
  schema: ZodSchema
  handler: (params, context?) => Promise<any>
  config?: {
    timeout?: number
    cacheable?: boolean
    retryable?: boolean
    maxRetries?: number
  }
})
```

## Examples

Check the `/examples` folder for more:

- Simple chatbot
- Web scraping pipeline
- Multi-agent system
- RAG implementation
- Creative writing workflow

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT © [Your Name]
