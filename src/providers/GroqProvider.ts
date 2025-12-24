import type Groq from 'groq-sdk';
import { BaseProvider } from '../core/entities/Provider';
import { ResponseFormatter } from '../protocol/ResponseFormatter';
import { ToolCallParser } from '../protocol/ToolCallParser';
import { getTextContent } from '../types/content';
import { ModelConfig } from '../types/core';
import { Provider, ProviderMessage, ProviderResponse } from '../types/provider';
import { Tool } from '../types/tool';
import { LazyLoader } from '../utils/system/LazyLoader';

export class GroqProvider extends BaseProvider implements Provider {
  name = 'groq';
  type = 'groq';
  private client: Groq;
  declare defaultModel?: string;
  readonly supportsNativeTools = true;

  private static NATIVE_TOOL_CALLING_MODELS = [
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama-3.3-70b-specdec',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ];

  constructor(apiKey: string, defaultModel?: string) {
    super();
    const mod = LazyLoader.load<any>('groq-sdk', 'Groq');
    const GroqClass = mod.default || mod.Groq || mod;
    this.client = new GroqClass({ apiKey });
    this.defaultModel = defaultModel || 'moonshotai/kimi-k2-instruct-0905';
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    const supportsNative = this.supportsNativeToolCalling();

    let groqMessages = messages.map((msg) => ({
      role: msg.role === 'tool' ? ('tool' as const) : msg.role,
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
      messages: groqMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stop: config.stopSequences,
    };

    if (tools && tools.length > 0) {
      if (supportsNative) {
        options.tools = ResponseFormatter.formatToolsAsJSON(tools);
      } else {
        const toolInstructions = ResponseFormatter.generateToolInstructions(tools, 'xml');
        const enforcement = `\n\n${toolInstructions}\n\nUse the XML tool_call format if tool usage is required.`;

        if (groqMessages[0]?.role === 'system') {
          groqMessages[0] = {
            ...groqMessages[0],
            content: `${groqMessages[0].content}${enforcement}`,
          };
        } else {
          groqMessages = [
            {
              role: 'system',
              content: enforcement,
              tool_calls: [],
              tool_call_id: '',
              name: '',
            },
            ...groqMessages,
          ];
        }
      }
    }

    const completion = await this.client.chat.completions.create(options);
    const choice = completion.choices[0];
    const message = choice.message;

    let toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    if (!toolCalls && tools && tools.length > 0 && message.content) {
      if (ToolCallParser.hasToolCalls(message.content)) {
        toolCalls = ToolCallParser.parse(message.content);
      }
    }

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
    const groqMessages = messages.map((msg) => ({
      role: msg.role === 'tool' ? ('tool' as const) : msg.role,
      content: msg.role === 'system' || msg.role === 'tool' ? getTextContent(msg.content) : msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
    }));

    const options = {
      model: this.defaultModel,
      messages: groqMessages,
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

  private supportsNativeToolCalling(): boolean {
    if (!this.defaultModel) return false;
    return GroqProvider.NATIVE_TOOL_CALLING_MODELS.some((model) => this.defaultModel?.includes(model));
  }
}
