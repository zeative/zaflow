import { ZaFlow, defineProvider, defineTool, msg } from '../src';

async function testNullContent() {
  const mockProvider = defineProvider({
    type: 'custom',
    name: 'mock',
    adapter: async () => {
      console.log('--- Mock Provider Called ---');
      return {
        content: null as any, // Simulate null content
        toolCalls: [
          {
            id: 'call_123',
            name: 'test_tool',
            arguments: { foo: 'bar' }
          }
        ],
        finishReason: 'tool_calls'
      };
    }
  });

  const testTool = defineTool({
    name: 'test_tool',
    description: 'A test tool',
    schema: (z: any) => ({ foo: 'string' }),
    execute: async (input) => {
      console.log('Tool executed with:', input);
      return 'Tool result';
    }
  });

  const flow = new ZaFlow({
    mode: 'agentic',
    provider: mockProvider,
    tools: [testTool]
  });

  try {
    console.log('Running flow...');
    const response = await flow.run('Hello');
    console.log('Flow completed successfully!');
    console.log('Response:', response.content);
  } catch (error) {
    console.error('Flow failed with error:', error);
    process.exit(1);
  }
}

testNullContent();
