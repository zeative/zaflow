import type { z } from 'zod';
import { Agent } from './core/entities/Agent';
import { Tool } from './core/entities/Tool';
import { defineStorage } from './plugins/storage/StoragePlugin';
import { CustomProvider } from './providers/CustomProvider';
import { GroqProvider } from './providers/GroqProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import type { AgentDefinition, Agent as IAgent } from './types/agent';
import type { Provider, ProviderDefinition } from './types/provider';
import type { Tool as ITool, ToolDefinition } from './types/tool';
import type { AudioPart, ContentPart, FilePart, ImagePart, TextPart } from './types/content';
import type { Message } from './types/core';
import { QuoteConfig } from './types/quote';

export function defineTool<TSchema extends z.ZodSchema>(definition: ToolDefinition<TSchema>): ITool<TSchema> {
  return new Tool(definition);
}

export function defineAgent(definition: AgentDefinition): IAgent {
  return new Agent(definition);
}

export function defineProvider(definition: ProviderDefinition): Provider {
  switch (definition.type) {
    case 'groq':
      if (!definition.apiKey) {
        throw new Error('Groq provider requires an API key');
      }
      return new GroqProvider(definition.apiKey, definition.defaultModel);

    case 'ollama':
      return new OllamaProvider(definition.baseURL, definition.defaultModel);

    case 'openai':
      if (!definition.apiKey) {
        throw new Error('OpenAI provider requires an API key');
      }
      return new OpenAIProvider(definition.apiKey, definition.defaultModel);

    case 'custom':
      return new CustomProvider(definition);

    default:
      throw new Error(`Unknown provider type: ${definition.type}`);
  }
}

export { defineStorage };

export function text(content: string): TextPart {
  return { type: 'text', text: content };
}

export function image(url: string, detail?: 'low' | 'high' | 'auto'): ImagePart {
  return { type: 'image_url', image_url: { url, detail } };
}

export function imageBase64(base64: string, mimeType: string = 'image/png', detail?: 'low' | 'high' | 'auto'): ImagePart {
  return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail } };
}

export function audio(base64Data: string, format?: 'mp3' | 'wav' | 'ogg'): AudioPart {
  return { type: 'audio', audio: { data: base64Data, format } };
}

export function file(base64Data: string, mimeType: string, filename?: string): FilePart {
  return { type: 'file', file: { data: base64Data, mimeType, filename } };
}

export const msg = {
  user(content: string | ContentPart[]): Message {
    return { role: 'user', content };
  },
  system(content: string): Message {
    return { role: 'system', content };
  },
  assistant(content: string): Message {
    return { role: 'assistant', content };
  },
  tool(content: string, name: string, toolCallId: string): Message {
    return { role: 'tool', content, name, toolCallId };
  },
  reply(quotedMsg: Message, content: string | ContentPart[] | Message, config?: QuoteConfig): Message {
    const actualContent = (content as any).role ? (content as Message).content : (content as string | ContentPart[]);

    return {
      role: 'user',
      content: actualContent,
      quotedMessage: {
        role: quotedMsg.role as 'user' | 'assistant' | 'system',
        content: quotedMsg.content,
        timestamp: Date.now(),
        config,
      },
    };
  },
};
