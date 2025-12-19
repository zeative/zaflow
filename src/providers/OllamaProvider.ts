import type { Ollama } from 'ollama';
import type { Provider, ProviderMessage, ProviderResponse } from '../types/provider';
import type { ModelConfig } from '../types/core';
import type { Tool } from '../types/tool';
import { BaseProvider } from '../core/Provider';
import { ResponseFormatter } from '../protocol/ResponseFormatter';
import { ToolCallParser } from '../protocol/ToolCallParser';
import { LazyLoader } from '../utils/LazyLoader';

/**
 * Ollama provider implementation
 * Uses custom XML tool calling protocol since Ollama doesn't support native function calling
 */
export class OllamaProvider extends BaseProvider implements Provider {
  name = 'ollama';
  type = 'ollama';
  private client: Ollama;
  declare defaultModel?: string;

  constructor(baseURL: string = 'http://localhost:11434', defaultModel?: string) {
    super();
    const { Ollama: OllamaClass } = LazyLoader.load<any>('ollama', 'Ollama');
    this.client = new OllamaClass({ host: baseURL });
    this.defaultModel = defaultModel || 'llama3.1:8b';
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    // Prepare messages - inject tool system prompt if tools are provided
    let finalMessages = [...messages];

    if (tools && tools.length > 0) {
      const toolInstructions = ResponseFormatter.generateToolInstructions(tools, 'xml');

      // Add or append to system message
      if (finalMessages[0]?.role === 'system') {
        finalMessages[0] = {
          ...finalMessages[0],
          content: `${finalMessages[0].content}\n\n${toolInstructions}`,
        };
      } else {
        finalMessages = [{ role: 'system', content: toolInstructions }, ...finalMessages];
      }
    }

    // Convert to Ollama format
    const ollamaMessages = finalMessages.map((msg) => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role, // Ollama doesn't have tool role
      content: msg.role === 'tool' ? `Tool result: ${msg.content}` : msg.content,
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
    // Prepare messages with tool instructions
    let finalMessages = [...messages];

    if (tools && tools.length > 0) {
      const toolInstructions = ResponseFormatter.generateToolInstructions(tools, 'xml');

      if (finalMessages[0]?.role === 'system') {
        finalMessages[0] = {
          ...finalMessages[0],
          content: `${finalMessages[0].content}\n\n${toolInstructions}`,
        };
      } else {
        finalMessages = [{ role: 'system', content: toolInstructions }, ...finalMessages];
      }
    }

    const ollamaMessages = finalMessages.map((msg) => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.role === 'tool' ? `Tool result: ${msg.content}` : msg.content,
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
