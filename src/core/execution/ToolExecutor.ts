import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { ToolCall } from '../../types/provider';
import { Tool, ToolContext, SharedMemory, StorageInterface } from '../../types/tool';
import { ContextManager } from '../state/Context';
import { Hooks } from '../../types/hooks';
import { generateExecutionId } from '../../utils/system/id';

export class ToolExecutor<TContext = any> {
  private queue: PQueue;
  private tools: Map<string, Tool>;
  private contextManager: ContextManager<TContext>;
  private sharedMemory: SharedMemory;
  private storage: StorageInterface;
  private hooks?: Hooks;

  constructor(
    tools: Tool[],
    contextManager: ContextManager<TContext>,
    sharedMemory: SharedMemory,
    storage: StorageInterface,
    hooks?: Hooks,
    concurrency: number = 3,
  ) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.contextManager = contextManager;
    this.sharedMemory = sharedMemory;
    this.storage = storage;
    this.hooks = hooks;
    this.queue = new PQueue({ concurrency });
  }

  async execute(toolCall: ToolCall, agentName: string = 'system', metadata: any = {}, tools?: Tool[]): Promise<{ result: any; name: string; id: string }> {
    let tool = this.tools.get(toolCall.name);

    if (!tool && tools) {
      tool = tools.find((t) => t.name === toolCall.name);
    }

    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found.`);
    }

    const context: ToolContext<TContext> = {
      userContext: this.contextManager.getContext(),
      sharedMemory: this.sharedMemory,
      agentName,
      conversationHistory: [],
      metadata: {
        executionId: metadata.executionId || generateExecutionId(),
        timestamp: Date.now(),
        mode: metadata.mode || 'single',
      },
      storage: this.storage,
    };

    const executeTask = () =>
      pRetry(() => tool.run(toolCall.arguments, context), {
        retries: tool.retry?.maxAttempts || 3,
        onFailedAttempt: (error) => {
          console.warn(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
        },
      });

    if (tool.background) {
      // Fire and forget
      this.queue.add(executeTask).catch((err) => console.error(`Background tool '${toolCall.name}' failed:`, err));
      return { result: 'Background task started', name: toolCall.name, id: toolCall.id };
    }

    const result = await this.queue.add(executeTask);

    return { result, name: toolCall.name, id: toolCall.id };
  }

  async executeBatch(toolCalls: ToolCall[], agentName?: string, metadata?: any, tools?: Tool[]): Promise<{ result: any; name: string; id: string }[]> {
    return Promise.all(toolCalls.map((call) => this.execute(call, agentName, metadata, tools)));
  }
}
