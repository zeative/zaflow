import { ToolCall } from '../../types/provider';
import { Tool, ToolContext } from '../../types/tool';
import { Hooks } from '../../types/hooks';
import { ContextManager } from '../state/Context';
import { SharedMemoryPool } from '../state/Memory';
import { StoragePlugin } from '../../types/storage';
import { Message } from '../../types/core';

export class ToolExecutor<TContext = any> {
  constructor(
    private tools: Tool[],
    private contextManager: ContextManager<TContext>,
    private sharedMemory: SharedMemoryPool,
    private storage: StoragePlugin,
    private hooks?: Hooks
  ) {}

  async execute(
    toolCalls: ToolCall[],
    agentName: string,
    executionId: string,
    history: Message[],
    mode: import('../../types/core').ExecutionMode,
    availableTools?: Tool[]
  ): Promise<Array<{ id: string; name: string; result: any }>> {
    const results = [];

    for (const call of toolCalls) {
      const toolsToSearch = availableTools || this.tools;
      const tool = toolsToSearch.find((t) => t.name === call.name);
      
      if (!tool) {
        results.push({
          id: call.id || 'unknown',
          name: call.name,
          result: `Error: Tool "${call.name}" not found.`,
        });
        continue;
      }

      this.hooks?.onToolCall?.(call.name, call.arguments);

      try {
        const context: ToolContext<TContext> = {
          userContext: this.contextManager.getContext(),
          sharedMemory: this.sharedMemory,
          agentName,
          conversationHistory: history,
          metadata: { executionId, timestamp: Date.now(), mode },
          storage: this.storage,
        };

        const result = await tool.execute(call.arguments, context);
        
        this.hooks?.onToolComplete?.(call.name, result);
        
        results.push({
          id: call.id || 'unknown',
          name: call.name,
          result,
        });
      } catch (error) {
        const err = error as Error;
        this.hooks?.onToolError?.(call.name, err);
        
        results.push({
          id: call.id || 'unknown',
          name: call.name,
          result: `Error executing tool "${call.name}": ${err.message}`,
        });
      }
    }

    return results;
  }
}
