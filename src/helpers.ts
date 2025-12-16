import type { z } from 'zod';
import { Agent } from './core/Agent';
import { Tool } from './core/Tool';
import { defineStorage } from './plugins/storage/StoragePlugin';
import { CustomProvider } from './providers/CustomProvider';
import { GroqProvider } from './providers/GroqProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import type { AgentDefinition, Agent as IAgent } from './types/agent';
import type { Provider, ProviderDefinition } from './types/provider';
import type { Tool as ITool, ToolDefinition } from './types/tool';

/**
 * Define a tool
 */
export function defineTool<TSchema extends z.ZodSchema>(definition: ToolDefinition<TSchema>): ITool<TSchema> {
  return new Tool(definition);
}

/**
 * Define an agent
 */
export function defineAgent(definition: AgentDefinition): IAgent {
  return new Agent(definition);
}

/**
 * Define a provider
 */
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

/**
 * Export storage definition helper
 */
export { defineStorage };
