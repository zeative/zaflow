import z from 'zod';
import type { Message, ProviderInterface, ProviderOptions, ProviderResponse } from '../types';

export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | 'o1' | 'o1-mini' | 'o1-preview' | (string & {});
export type GroqModel =
  | 'llama-3.1-8b-instant'
  | 'llama-3.3-70b-versatile'
  | 'moonshotai/kimi-k2-instruct'
  | 'moonshotai/kimi-k2-instruct-0905'
  | 'openai/gpt-oss-120b'
  | 'openai/gpt-oss-20b'
  | 'qwen/qwen3-32b'
  | (string & {});
export type OllamaModel = 'llama3.2' | 'llama3.1' | 'mistral' | 'codellama' | 'phi3' | 'gemma2' | (string & {});

export type OpenAIConfig = {
  apiKey: string;
  model?: OpenAIModel;
  baseUrl?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
};

export type GroqConfig = {
  apiKey: string;
  model?: GroqModel;
  timeout?: number;
  maxRetries?: number;
};

export type OllamaConfig = {
  host?: string;
  model?: OllamaModel;
};

type OpenAIClient = {
  chat: {
    completions: {
      create: (p: unknown) => Promise<{
        choices: Array<{ message: { content: string | null; tool_calls?: unknown[] }; finish_reason: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      }>;
    };
  };
};

type GroqClient = OpenAIClient;
type OllamaClient = {
  chat: (p: unknown) => Promise<{
    message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
    prompt_eval_count?: number;
    eval_count?: number;
  }>;
};

export function openai(config: OpenAIConfig): ProviderInterface {
  let client: OpenAIClient | null = null;
  const model = config.model ?? 'gpt-4o-mini';

  const getClient = async (): Promise<OpenAIClient> => {
    if (client) return client;

    const { default: OpenAI } = await import('openai');

    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    }) as unknown as OpenAIClient;

    return client;
  };

  return {
    name: 'openai',
    async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
      const client = await getClient();

      const tools = options?.tools?.length
        ? options.tools.map((tool) => ({
            type: 'function' as const,
            function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.schema) },
          }))
        : undefined;

      const response = await client.chat.completions.create({
        model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
          name: message.name,
          tool_call_id: message.tool_call_id,
          tool_calls: message.tool_calls,
        })),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        tools,
        tool_choice: tools ? 'auto' : undefined,
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls as ProviderResponse['toolCalls'],
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop',
        usage: response.usage
          ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens, totalTokens: response.usage.total_tokens }
          : undefined,
      };
    },
  };
}

export function groq(config: GroqConfig): ProviderInterface {
  let client: GroqClient | null = null;
  const model = config.model ?? 'llama-3.3-70b-versatile';

  const getClient = async (): Promise<GroqClient> => {
    if (client) return client;

    const mod = await import('groq-sdk');
    const Groq = mod.default ?? mod.Groq;

    client = new Groq({ apiKey: config.apiKey, timeout: config.timeout ?? 60000, maxRetries: config.maxRetries ?? 2 }) as unknown as GroqClient;
    return client;
  };

  return {
    name: 'groq',
    async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
      const client = await getClient();

      const tools = options?.tools?.length
        ? options.tools.map((tool) => ({
            type: 'function' as const,
            function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.schema) },
          }))
        : undefined;

      try {
        const response = await client.chat.completions.create({
          model,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content ?? '',
            name: message.name,
            tool_call_id: message.tool_call_id,
            tool_calls: message.tool_calls,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 4096,
          tools,
          tool_choice: tools ? 'auto' : undefined,
          parallel_tool_calls: false,
        });

        const choice = response.choices?.[0];
        if (!choice) return { content: '', finishReason: 'stop', usage: undefined };

        return {
          content: choice.message.content ?? '',
          toolCalls: choice.message.tool_calls as ProviderResponse['toolCalls'],
          finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop',
          usage: response.usage
            ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens, totalTokens: response.usage.total_tokens }
            : undefined,
        };
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };

        if (err.code === 'tool_use_failed' || err.message?.includes('tool') || err.message?.includes('not supported')) {
          const response = await client.chat.completions.create({
            model,
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content ?? '',
              name: message.name,
              tool_call_id: message.tool_call_id,
              tool_calls: message.tool_calls,
            })),
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
          });

          const choice = response.choices?.[0];
          return {
            content: choice?.message.content ?? '',
            finishReason: 'stop',
            usage: response.usage
              ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens, totalTokens: response.usage.total_tokens }
              : undefined,
          };
        }

        throw e;
      }
    },
  };
}

export function ollama(config: OllamaConfig = {}): ProviderInterface {
  let client: OllamaClient | null = null;
  const host = config.host ?? 'http://localhost:11434';
  const model = config.model ?? 'llama3.2';

  const getClient = async (): Promise<OllamaClient> => {
    if (client) return client;
    const { Ollama } = await import('ollama');

    client = new Ollama({ host }) as unknown as OllamaClient;
    return client;
  };

  return {
    name: 'ollama',
    async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
      const client = await getClient();

      const tools = options?.tools?.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.schema) },
      }));

      const response = await client.chat({
        model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        options: { temperature: options?.temperature, num_predict: options?.maxTokens },
        tools,
      });

      const toolCalls = response.message.tool_calls?.map((t, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: { name: t.function.name, arguments: JSON.stringify(t.function.arguments) },
      }));

      return {
        content: response.message.content,
        toolCalls,
        finishReason: toolCalls?.length ? 'tool_calls' : 'stop',
        usage: {
          promptTokens: response.prompt_eval_count ?? 0,
          completionTokens: response.eval_count ?? 0,
          totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
        },
      };
    },
  };
}
