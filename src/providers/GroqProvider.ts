import Groq from 'groq-sdk';
import type { Provider, ProviderMessage, ProviderResponse } from '../types/provider';
import type { ModelConfig } from '../types/core';
import type { Tool } from '../types/tool';
import { BaseProvider } from '../core/Provider';
import { ResponseFormatter } from '../protocol/ResponseFormatter';
import { ToolCallParser } from '../protocol/ToolCallParser';

/**
 * Groq provider with dual protocol support
 * - Native tool calling for compatible models
 * - XML protocol for incompatible models
 */
export class GroqProvider extends BaseProvider implements Provider {
  name = 'groq';
  type = 'groq';
  private client: Groq;
  declare defaultModel?: string;

  // Models that support native tool calling
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
    this.client = new Groq({ apiKey });
    this.defaultModel = defaultModel || 'moonshotai/kimi-k2-instruct-0905';
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    const supportsNative = this.supportsNativeToolCalling();

    // Convert messages to Groq format
    let groqMessages = messages.map((msg) => ({
      role: msg.role === 'tool' ? ('tool' as const) : msg.role,
      content: msg.content,
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

    // DUAL PROTOCOL STRATEGY
    if (tools && tools.length > 0) {
      if (supportsNative) {
        // Strategy 1: Native tool calling (preferred)
        options.tools = ResponseFormatter.formatToolsAsJSON(tools);
        console.log(`[GROQ] 🔧 NATIVE protocol - ${tools.length} tools`);
      } else {
        // Strategy 2: XML Protocol (universal fallback)
        console.log(`[GROQ] 📝 XML protocol - ${tools.length} tools (model=${this.defaultModel})`);

        const toolInstructions = ResponseFormatter.generateToolInstructions(tools, 'xml');

        // Inject into system prompt with STRONG enforcement
        if (groqMessages[0]?.role === 'system') {
          groqMessages[0] = {
            ...groqMessages[0],
            content: `${groqMessages[0].content}\n\n${toolInstructions}\n\n🚨 CRITICAL: When the user asks a question that requires tool usage, you MUST call the tools using the XML format shown above. Do NOT just describe what you would do - ACTUALLY output the XML tool_call format. This is mandatory.`,
          };
        } else {
          groqMessages = [
            {
              role: 'system',
              content: `${toolInstructions}\n\n🚨 CRITICAL: When the user asks a question that requires tool usage, you MUST call the tools using the XML format shown above. Do NOT just describe what you would do - ACTUALLY output the XML tool_call format. This is mandatory.`,
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

    console.log('[GROQ] 📊 finish_reason:', choice.finish_reason);
    console.log('[GROQ] 🎯 has native tool_calls:', !!message.tool_calls);

    // Parse tool calls - try native first, then XML fallback
    let toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    // XML Fallback: If no native tool calls but we sent tools, parse from content
    if (!toolCalls && tools && tools.length > 0 && message.content) {
      if (ToolCallParser.hasToolCalls(message.content)) {
        toolCalls = ToolCallParser.parse(message.content);
        console.log(`[GROQ] ✅ Parsed ${toolCalls.length} tool calls from XML`);
      } else {
        console.log('[GROQ] ⚠️  No tool calls detected (neither native nor XML)');
        console.log('[GROQ] 📄 Response preview:', message.content.substring(0, 200));
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
    // Convert messages
    const groqMessages = messages.map((msg) => ({
      role: msg.role === 'tool' ? ('tool' as const) : msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
    }));

    const options: any = {
      model: this.defaultModel,
      messages: groqMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    };

    if (tools && tools.length > 0) {
      options.tools = ResponseFormatter.formatToolsAsJSON(tools);
    }

    const stream = await this.client.chat.completions.create(options);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield delta.content;
      }
    }
  }

  /**
   * Check if current model supports native tool calling
   */
  private supportsNativeToolCalling(): boolean {
    if (!this.defaultModel) return false;
    return GroqProvider.NATIVE_TOOL_CALLING_MODELS.some((model) => this.defaultModel?.includes(model));
  }
}
