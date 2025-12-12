export type TextPart = { type: 'text'; text: string };
export type ImagePart = { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };
export type AudioPart = { type: 'audio'; audio: { data: string; format: 'wav' | 'mp3' } };
export type FilePart = { type: 'file'; file: { data: string; mimeType: string; filename?: string } };
export type ContentPart = TextPart | ImagePart | AudioPart | FilePart;

export type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ProviderResponse = {
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: Usage;
};

export type ProviderOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  signal?: AbortSignal;
};

export interface ProviderInterface {
  name: string;
  chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse>;
  chatStream?(messages: Message[], options?: ProviderOptions): AsyncIterable<{ content: string; done: boolean }>;
}

export type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  defaultOptions?: Partial<ProviderOptions>;
};

export type ToolConfig = {
  timeout?: number;
  cacheable?: boolean;
  cacheKey?: (params: unknown) => string;
  cacheTTL?: number;
  retryable?: boolean;
  maxRetries?: number;
  dependsOn?: string[];
  keywords?: string[];
};

export type ToolHandler<T = unknown> = (params: T, context: ExecutionContext) => unknown | Promise<unknown>;

export type MediaType = 'image' | 'audio' | 'file' | 'video';

export type ToolDefinition<T extends import('zod').ZodType = import('zod').ZodType> = {
  name: string;
  description: string;
  schema: T;
  handler: ToolHandler<import('zod').infer<T>>;
  config?: ToolConfig;
  handles?: MediaType[];
};

export type AgentConfig = {
  name: string;
  provider: ProviderInterface;
  model?: string;
  tools?: ToolDefinition[];
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  shareContext?: string[];
  needsMedia?: MediaType[];
};

export type AgentDefinition = AgentConfig & { id: string };

export type ExecutionMode = 'single' | 'agentic' | 'autonomous';

export type AgentEvent = {
  type: 'delegation' | 'tool_call' | 'tool_result' | 'agent_response' | 'synthesis';
  agent?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  timestamp: number;
};

export type OutputFormat = 'auto' | 'json' | 'whatsapp';

export type ExecutionOptions = {
  mode?: ExecutionMode;
  format?: OutputFormat;
  stream?: boolean;
  onChunk?: (chunk: { content: string; done: boolean }) => void;
  onAgentEvent?: (event: AgentEvent) => void;
  maxIterations?: number;
  maxToolCalls?: number;
  maxTokens?: number;
  timeout?: number;
  signal?: AbortSignal;
};

export type ExecutionStats = {
  agentCalls: Record<string, number>;
  toolCalls: Record<string, number>;
  totalAgentCalls: number;
  totalToolCalls: number;
  tokens: number;
  cost: number;
};

export type ExecutionResult = {
  output: string;
  thinking?: string;
  messages: Message[];
  steps: StepResult[];
  events: AgentEvent[];
  stats: ExecutionStats;
  duration: number;
};

export type StepResult = {
  id: string;
  output: unknown;
  tokens: number;
  duration: number;
};

export interface ExecutionContext {
  input: unknown;
  previous: unknown;
  parallel: unknown[];
  tokens: number;
  cost: number;
  messages: Message[];
  set<T>(key: string, value: T): void;
  get<T>(key: string, defaultValue?: T): T;
  has(key: string): boolean;
  addMessage(role: Message['role'], content: string): void;
  ai(prompt: string | AIOptions): Promise<string>;
}

export type AIOptions = {
  prompt: string;
  provider?: ProviderInterface;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  response_format?: { type: 'text' | 'json' };
};

export type StepHandler = (context: ExecutionContext) => unknown | Promise<unknown>;

export type StepDefinition = {
  id: string;
  handler: StepHandler;
  options?: StepOptions;
};

export type StepOptions = {
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
};

export type LoopOptions = {
  condition: (context: ExecutionContext) => boolean;
  maxIterations?: number;
  steps: StepDefinition[];
};

export type ConditionalBranch = {
  condition: (context: ExecutionContext) => boolean;
  then: StepDefinition[];
  else?: StepDefinition[];
};

export type ZaFlowConfig = {
  provider: ProviderInterface;
  cost?: CostConfig;
  persistence?: PersistenceConfig;
};

export type CostConfig = {
  trackUsage?: boolean;
  budget?: {
    maxCost?: number;
    maxTokens?: number;
    onExceed?: 'stop' | 'warn';
  };
};

export type PersistenceConfig = {
  enabled?: boolean;
  path?: string;
};
