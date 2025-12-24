import type OpenAI from 'openai';
import { BaseProvider } from '../core/entities/Provider';
import { ResponseFormatter } from '../protocol/ResponseFormatter';
import { getTextContent } from '../types/content';
import { ModelConfig } from '../types/core';
import { Provider, ProviderMessage, ProviderResponse } from '../types/provider';
import { Tool } from '../types/tool';
import { LazyLoader } from '../utils/system/LazyLoader';

export class OpenAIProvider extends BaseProvider implements Provider {
  name = 'openai';
  type = 'openai';
  private client: OpenAI;
  declare defaultModel?: string;
  readonly supportsNativeTools = true;

  constructor(apiKey: string, defaultModel?: string) {
    super();
    const mod = LazyLoader.load<any>('openai', 'OpenAI');
    const OpenAIClass = mod.default || mod.OpenAI || mod;
    this.client = new OpenAIClass({ apiKey });
    this.defaultModel = defaultModel || 'gpt-4-turbo-preview';
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    const openaiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.role === 'system' || msg.role === 'tool' ? getTextContent(msg.content) : msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
      ...(msg.toolCalls && {
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      }),
    }));

    const options: any = {
      model: this.defaultModel,
      messages: openaiMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stop: config.stopSequences,
    };

    if (tools && tools.length > 0) {
      options.tools = ResponseFormatter.formatToolsAsJSON(tools);
    }

    const completion = await this.client.chat.completions.create(options);
    const choice = completion.choices[0];
    const message = choice.message;

    const toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: message.content || '',
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      toolCalls,
      finishReason: choice.finish_reason as any,
    };
  }

  async *stream(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string> {
    const openaiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.role === 'system' || msg.role === 'tool' ? getTextContent(msg.content) : msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
    }));

    const options = {
      model: this.defaultModel,
      messages: openaiMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true as const,
      ...(tools &&
        tools.length > 0 && {
          tools: ResponseFormatter.formatToolsAsJSON(tools),
        }),
    };

    const stream = (await this.client.chat.completions.create(options as any)) as any;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield delta.content;
      }
    }
  }
}
