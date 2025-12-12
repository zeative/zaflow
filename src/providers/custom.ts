import type { Message, ProviderInterface, ProviderOptions, ProviderResponse, Usage } from '../types';

export type ProviderContext = {
  prompt: string;
  messages: Message[];
  options: ProviderOptions;
};

export type ProviderOutput = {
  content: string;
  usage?: Usage;
};

export type CustomProviderConfig = {
  name?: string;
  handler: (ctx: ProviderContext) => Promise<string | ProviderOutput>;
};

const buildPrompt = (msgs: Message[]): string =>
  msgs
    .map((m) => {
      if (m.role === 'system') return `[System]: ${m.content}`;
      if (m.role === 'user') return `[User]: ${m.content}`;
      if (m.role === 'assistant' && m.content) return `[Assistant]: ${m.content}`;
      if (m.role === 'tool') return `[Tool]: ${m.content}`;
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

export function createProvider(config: CustomProviderConfig): ProviderInterface {
  return {
    name: config.name || 'custom',
    async chat(messages: Message[], options: ProviderOptions = {}): Promise<ProviderResponse> {
      const ctx: ProviderContext = { prompt: buildPrompt(messages), messages, options };
      const res = await config.handler(ctx);
      const zero: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      if (typeof res === 'string') {
        return { content: res, finishReason: 'stop', usage: zero };
      }

      return { content: res.content, finishReason: 'stop', usage: res.usage ?? zero };
    },
  };
}
