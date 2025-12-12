import type { ToolCall } from './index';

export type ChatChoice = {
  message: {
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string;
};

export type ChatUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type ChatCompletionResponse = {
  choices: ChatChoice[];
  usage?: ChatUsage;
};

export type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type OllamaChatResponse = {
  message: {
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  prompt_eval_count?: number;
  eval_count?: number;
};
