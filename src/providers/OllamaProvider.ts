import type { Ollama } from 'ollama';
import type { Provider, ProviderMessage, ProviderResponse } from '../types/provider';
import type { ModelConfig } from '../types/core';
import type { Tool } from '../types/tool';
import { BaseProvider } from '../core/Provider';
import { ResponseFormatter } from '../protocol/ResponseFormatter';
import { ToolCallParser } from '../protocol/ToolCallParser';
import { LazyLoader } from '../utils/LazyLoader';
import { getTextContent } from '../types/content';

/**
 * Ollama provider implementation
 * Uses custom XML tool calling protocol since Ollama doesn't support native function calling
 */
export class OllamaProvider extends BaseProvider implements Provider {
  name = 'ollama';
  type = 'ollama';
  private client: Ollama;
  declare defaultModel?: string;
  readonly supportsNativeTools = false;

  constructor(baseURL: string = 'http://localhost:11434', defaultModel?: string) {
    super();
    const mod = LazyLoader.load<any>('ollama', 'Ollama');
    // Handle both: module.Ollama (named export) and module.default.Ollama (ESM)
    const OllamaClass = mod.Ollama || mod.default?.Ollama || mod.default || mod;
    this.client = new OllamaClass({ host: baseURL });
    this.defaultModel = defaultModel || 'llama3.1:8b';
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    // Convert to Ollama format
    const ollamaMessages = messages.map((msg) => ({
      role: (msg.role === 'tool' ? 'user' : msg.role) as any, // Map tool results to user role for better grounding
      content: msg.role === 'tool' ? `Tool result: ${getTextContent(msg.content)}` : getTextContent(msg.content),
    }));

    const response = await this.client.chat({
      model: this.defaultModel!,
      messages: ollamaMessages,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
        top_p: config.topP,
        top_k: config.topK,
        stop: config.stopSequences,
      },
    });

    const content = response.message.content;

    // Parse tool calls from XML format
    const toolCalls = ToolCallParser.parse(content);

    // Estimate token usage (Ollama doesn't provide exact counts)
    const estimatedPromptTokens = ollamaMessages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    const estimatedCompletionTokens = Math.ceil(content.length / 4);

    return {
      content,
      usage: {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: response.done ? 'stop' : 'length',
    };
  }

  async *stream(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string> {
    const ollamaMessages = messages.map((msg) => ({
      role: (msg.role === 'tool' ? 'user' : msg.role) as any,
      content: msg.role === 'tool' ? `Tool result: ${getTextContent(msg.content)}` : getTextContent(msg.content),
    }));

    const stream = await this.client.chat({
      model: this.defaultModel!,
      messages: ollamaMessages,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.message?.content) {
        yield chunk.message.content;
      }
    }
  }
}
