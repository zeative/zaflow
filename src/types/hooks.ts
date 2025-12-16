import type { ZaFlowResponse } from './core';

/**
 * Error context for error hooks
 */
export interface ErrorContext {
  phase: 'tool' | 'agent' | 'provider' | 'orchestration';
  toolName?: string;
  agentName?: string;
  attempt?: number;
  input?: string;
}

/**
 * Event hooks
 */
export interface Hooks {
  /** Workflow events */
  onStart?: (input: string) => void | Promise<void>;
  onComplete?: (output: ZaFlowResponse) => void | Promise<void>;
  onError?: (error: Error, context: ErrorContext) => void | Promise<void>;

  /** Tool events */
  onToolCall?: (toolName: string, args: any) => void | Promise<void>;
  onToolComplete?: (toolName: string, result: any) => void | Promise<void>;
  onToolError?: (toolName: string, error: Error) => void | Promise<void>;

  /** Agent events */
  onAgentStart?: (agentName: string) => void | Promise<void>;
  onAgentComplete?: (agentName: string, output: string) => void | Promise<void>;
  onAgentError?: (agentName: string, error: Error) => void | Promise<void>;

  /** Streaming events */
  onStreamChunk?: (chunk: string) => void | Promise<void>;
  onStreamComplete?: (fullText: string) => void | Promise<void>;

  /** Retry events */
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;

  /** Context events */
  onContextUpdate?: (context: any) => void | Promise<void>;
  onContextClear?: () => void | Promise<void>;

  /** Memory events */
  onMemoryWrite?: (key: string, value: any) => void | Promise<void>;
  onMemoryRead?: (key: string, value: any) => void | Promise<void>;
}
