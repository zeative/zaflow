import type { ContentPart, Message, ProviderInterface, ProviderOptions, ProviderResponse, TextPart, Usage } from '../types';

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

const contentToString = (content: string | ContentPart[]): string => {
  if (typeof content === 'string') return content;
  return content
    .map((p) => {
      if (p.type === 'text') return (p as TextPart).text;
      if (p.type === 'image_url') return '[Image]';
      if (p.type === 'audio') return '[Audio]';
      if (p.type === 'file') return '[File]';
      return '';
    })
    .filter(Boolean)
    .join(' ');
};

const buildPrompt = (msgs: Message[]): string =>
  msgs
    .map((m) => {
      const text = contentToString(m.content);
      if (m.role === 'system') return `[System]: ${text}`;
      if (m.role === 'user') return `[User]: ${text}`;
      if (m.role === 'assistant' && text) return `[Assistant]: ${text}`;
      if (m.role === 'tool') return `[Tool]: ${text}`;
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

      return { content: res?.content ?? '', finishReason: 'stop', usage: res?.usage ?? zero };
    },
  };
}
