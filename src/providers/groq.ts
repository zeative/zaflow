import type { Message, ProviderConfig, ProviderOptions, ProviderResponse } from '../types';
import type { ChatCompletionResponse } from '../types/sdk';
import { BaseProvider } from './base';

type GroqClient = {
  chat: { completions: { create: (p: unknown) => Promise<ChatCompletionResponse> } };
};

export class GroqProvider extends BaseProvider {
  name = 'groq';
  private client: GroqClient | null = null;

  constructor(config: ProviderConfig & { apiKey: string }) {
    super({ ...config, model: config.model ?? 'llama-3.3-70b-versatile' });
  }

  private async getClient(): Promise<GroqClient> {
    if (this.client) return this.client;
    const mod = await import('groq-sdk');
    const Groq = mod.default ?? mod.Groq;
    this.client = new Groq({ apiKey: this.config.apiKey, timeout: 60000, maxRetries: 2 }) as unknown as GroqClient;
    return this.client;
  }

  async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
    const client = await this.getClient();
    const opts = this.mergeOptions(options);
    const tools = this.toolsToFunctions(opts.tools);

    try {
      return await this.req(client, messages, opts, tools);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'tool_use_failed' || err.message?.includes('tool') || err.message?.includes('not supported')) {
        return await this.req(client, messages, opts, undefined);
      }
      throw e;
    }
  }

  private async req(c: GroqClient, msgs: Message[], o: ProviderOptions, tools: ReturnType<typeof this.toolsToFunctions>): Promise<ProviderResponse> {
    const r = await c.chat.completions.create({
      model: o.model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content ?? '', name: m.name, tool_call_id: m.tool_call_id, tool_calls: m.tool_calls })),
      temperature: o.temperature ?? 0.7,
      max_tokens: o.maxTokens ?? 4096,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      parallel_tool_calls: false,
    });

    const ch = r.choices?.[0];
    if (!ch) return { content: '', finishReason: 'stop', usage: undefined };

    return {
      content: ch.message.content ?? '',
      toolCalls: ch.message.tool_calls,
      finishReason: ch.finish_reason === 'tool_calls' ? 'tool_calls' : ch.finish_reason === 'length' ? 'length' : 'stop',
      usage: r.usage ? { promptTokens: r.usage.prompt_tokens, completionTokens: r.usage.completion_tokens, totalTokens: r.usage.total_tokens } : undefined,
    };
  }

  destroy(): void {
    this.client = null;
  }
}
