// Main export
export { default } from './core/ZaFlow';
export { default as ZaFlow } from './core/ZaFlow';

// Helper functions
export { defineTool, defineAgent, defineProvider, defineStorage } from './helpers';

// 🔥 Multimodal helpers
export { text, image, imageBase64, audio, file, msg } from './helpers';

// Utils functions
export * from './utils';

// Type exports
export type {
  // Core types
  ZaFlowOptions,
  ZaFlowResponse,
  RunOptions,
  StreamOptions,
  ModelConfig,
  HistoryConfig,
  Message,
  ExecutionMode,
  TokenUsage,
  ExecutionMetadata,
  ErrorResponse,

  // Provider types
  Provider,
  ProviderDefinition,
  ProviderAdapter,
  ProviderResponse,
  ProviderMessage,
  ToolCall,
  RateLimit,

  // Tool types
  Tool,
  ToolDefinition,
  ToolContext,
  SharedMemory,
  StorageInterface,

  // Agent types
  Agent,
  AgentDefinition,
  AgentCapability,
  AgentConstraints,

  // Hook types
  Hooks,
  ErrorContext,

  // Storage types
  StoragePlugin,
  StorageAdapter,
  StorageDefinition,

  // Optimization types
  OptimizationConfig,
  RetryConfig,
  CacheConfig,
  TokenBudget,
} from './types';

// 🔥 Multimodal content types
export type { ContentPart, TextPart, ImagePart, AudioPart, FilePart, MediaType } from './types/content';
