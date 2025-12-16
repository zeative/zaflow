import type { ContentPart, Message, ProviderInterface, ProviderOptions, ProviderResponse, TextPart, ToolCall, ToolDefinition, Usage } from '../types';
import * as z from 'zod';

export type ProviderContext = {
  prompt: string;
  messages: Message[];
  options: ProviderOptions;
  tools?: ToolDefinition[];
};

export type ProviderOutput = {
  content: string;
  toolCalls?: ToolCall[];
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

const buildPrompt = (msgs: Message[], tools?: ToolDefinition[]): string => {
  const base = msgs
    .map((m) => {
      const text = contentToString(m.content);
      if (m.role === 'system') return text;
      if (m.role === 'user') return `User: ${text}`;
      if (m.role === 'assistant' && text) return `Assistant: ${text}`;
      if (m.role === 'tool') return `Tool Result: ${text}`;
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  if (!tools?.length) return base;

  const lastMsg = msgs[msgs.length - 1];
  const isToolResult = lastMsg?.role === 'tool';

  let lastUserIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx !== -1) {
    return msgs
      .map((m, i) => {
        let text = contentToString(m.content);
        if (i === lastUserIdx && !isToolResult) {
          text += `\n\n[SYSTEM]: You MUST use a tool (like "web_search") to answer. Respond with JSON: {"tool": "...", "params": {...}}`;
        }
        if (m.role === 'system') return text;
        if (m.role === 'user') return `User: ${text}`;
        if (m.role === 'assistant' && text) return `Assistant: ${text}`;
        if (m.role === 'tool') return `Tool Result: ${text}`;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return `${base}\n\n[System]: REMINDER: Use JSON format for tools.`;
};

const parseJSON = (content: string): Record<string, unknown> | null => {
  const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }

  let depth = 0,
    start = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(content.slice(start, i + 1));
        } catch {}
        start = -1;
      }
    }
  }
  return null;
};

const extractToolCall = (content: string): ToolCall[] | undefined => {
  const p = parseJSON(content);
  if (p?.tool && typeof p.tool === 'string') {
    return [{ id: `call_${Date.now()}`, type: 'function', function: { name: p.tool, arguments: JSON.stringify(p.params || {}) } }];
  }

  return undefined;
};

export function createProvider(config: CustomProviderConfig): ProviderInterface {
  return {
    name: config.name || 'custom',
    async chat(messages: Message[], options: ProviderOptions = {}): Promise<ProviderResponse> {
      const tools = options.tools;
      const ctx: ProviderContext = { prompt: buildPrompt(messages, tools), messages, options, tools };
      const res = await config.handler(ctx);
      const zero: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      if (typeof res === 'string') {
        const toolCalls = extractToolCall(res);
        if (toolCalls) return { content: res, toolCalls, finishReason: 'tool_calls', usage: zero };
        return { content: res, finishReason: 'stop', usage: zero };
      }

      if (res?.toolCalls?.length) return { content: res.content ?? '', toolCalls: res.toolCalls, finishReason: 'tool_calls', usage: res.usage ?? zero };
      const toolCalls = extractToolCall(res?.content || '');
      if (toolCalls) return { content: res.content ?? '', toolCalls, finishReason: 'tool_calls', usage: res.usage ?? zero };
      return { content: res?.content ?? '', finishReason: 'stop', usage: res?.usage ?? zero };
    },
  };
}
