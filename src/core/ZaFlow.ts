import { MemoryStorage } from '../plugins/storage/MemoryStorage';
import { AgentDelegationFormatter } from '../protocol/AgentDelegation';
import { ToolCallParser } from '../protocol/ToolCallParser';
import type { Agent } from '../types/agent';
import type { ExecutionMode, Message, ModelConfig, RunOptions, StreamOptions, TokenUsage, ZaFlowOptions, ZaFlowResponse } from '../types/core';
import type { Hooks } from '../types/hooks';
import type { Provider, ProviderMessage, ToolCall } from '../types/provider';
import type { StoragePlugin } from '../types/storage';
import type { Tool, ToolContext } from '../types/tool';
import { generateExecutionId } from '../utils/id';
import { simulateStreaming } from '../utils/streaming';
import { ContextManager } from './Context';
import { SharedMemoryPool } from './Memory';

/**
 * Main ZaFlow class for orchestrating AI workflows
 */
export default class ZaFlow<TContext = any> {
  private mode: ExecutionMode;
  private provider: Provider;
  private model: string;
  private agents: Agent[];
  private tools: Tool[];
  private config: ModelConfig;
  private contextManager: ContextManager<TContext>;
  private sharedMemory: SharedMemoryPool;
  private storage: StoragePlugin;
  private hooks?: Hooks;
  private history: Message[] = [];
  private systemPrompt?: string;

  constructor(options: ZaFlowOptions<TContext>) {
    this.mode = options.mode;
    this.provider = options.provider;
    this.model = options.model;
    this.agents = options.agents || [];
    this.tools = options.tools || [];
    this.config = options.config || {};
    this.hooks = options.hooks;
    this.systemPrompt = options.systemPrompt;

    this.contextManager = new ContextManager<TContext>(this.hooks);
    this.sharedMemory = new SharedMemoryPool(this.hooks);
    this.storage = options.storage || new MemoryStorage();
  }

  addContext(context: Partial<TContext>): void {
    this.contextManager.addContext(context);
  }

  getContext(): TContext {
    return this.contextManager.getContext();
  }

  clearContext(): void {
    this.contextManager.clearContext();
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  async run(message: string, options?: RunOptions): Promise<ZaFlowResponse> {
    const startTime = Date.now();
    const executionId = generateExecutionId();

    try {
      this.hooks?.onStart?.(message);
      this.history.push({ role: 'user', content: message });

      let response: ZaFlowResponse;

      switch (this.mode) {
        case 'single':
          response = await this.runSingle(message, options);
          break;
        case 'agentic':
          response = await this.runAgentic(message, options);
          break;
        case 'autonomous':
          response = await this.runAutonomous(message, options);
          break;
        default:
          throw new Error(`Unknown mode: ${this.mode}`);
      }

      this.history.push({ role: 'assistant', content: response.content });

      if (response.metadata) {
        response.metadata.executionTime = Date.now() - startTime;
      }

      this.hooks?.onComplete?.(response);

      if (!options?.persistContext) {
        this.clearContext();
      }

      return response;
    } catch (error) {
      const err = error as Error;
      this.hooks?.onError?.(err, { phase: 'orchestration', input: message });

      return {
        content: '',
        error: {
          message: err.message,
          code: 'EXECUTION_ERROR',
          details: err,
        },
      };
    }
  }

  async *stream(message: string, options?: StreamOptions): AsyncIterableIterator<string> {
    this.hooks?.onStart?.(message);
    this.history.push({ role: 'user', content: message });

    // Complex modes (AGENTIC, AUTONOMOUS) need full execution before streaming
    // because tool calling and agent delegation can't be truly streamed
    if (this.mode === 'agentic' || this.mode === 'autonomous') {
      console.log(`[STREAM] ${this.mode.toUpperCase()} mode - executing fully then streaming result...`);

      // Execute fully with all tools/agents - ALWAYS get detailed metadata
      const response = await this.run(message, {
        persistContext: options?.persistContext,
        detailed: true, // Always generate metadata for hooks
      });

      // Simulate streaming of the complete result
      for await (const chunk of simulateStreaming(response.content)) {
        this.hooks?.onStreamChunk?.(chunk);
        yield chunk;
      }

      this.hooks?.onStreamComplete?.(response.content);
      // Note: history already updated by run()
    } else {
      // SINGLE mode can use true provider streaming
      if (this.provider.stream) {
        const messages = this.prepareMessages();
        const config = { ...this.config, ...options?.config, stream: true };

        const streamIter = this.provider.stream(messages, config, this.tools);
        let fullText = '';

        for await (const chunk of streamIter) {
          fullText += chunk;
          this.hooks?.onStreamChunk?.(chunk);
          yield chunk;
        }

        this.hooks?.onStreamComplete?.(fullText);
        this.history.push({ role: 'assistant', content: fullText });
      } else {
        const response = await this.run(message, { persistContext: options?.persistContext });

        for await (const chunk of simulateStreaming(response.content)) {
          this.hooks?.onStreamChunk?.(chunk);
          yield chunk;
        }

        this.hooks?.onStreamComplete?.(response.content);
      }
    }

    if (!options?.persistContext) {
      this.clearContext();
    }
  }

  private async runSingle(message: string, options?: RunOptions): Promise<ZaFlowResponse> {
    const messages = this.prepareMessages();
    const config = { ...this.config, ...options?.config };

    const response = await this.provider.chat(messages, config);

    return {
      content: response.content,
      metadata: options?.detailed
        ? {
            tokensUsed: {
              prompt: response.usage?.promptTokens || 0,
              completion: response.usage?.completionTokens || 0,
              total: response.usage?.totalTokens || 0,
            },
            toolsCalled: [],
            agentsCalled: [],
            executionTime: 0,
            model: this.model,
          }
        : undefined,
    };
  }

  private async runAgentic(message: string, options?: RunOptions): Promise<ZaFlowResponse> {
    const messages = this.prepareMessages();
    const config = { ...this.config, ...options?.config };
    const toolsCalled: string[] = [];
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    let currentMessages = messages;
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const response = await this.provider.chat(currentMessages, config, this.tools);

      if (response.usage) {
        totalUsage.prompt += response.usage.promptTokens;
        totalUsage.completion += response.usage.completionTokens;
        totalUsage.total += response.usage.totalTokens;
      }

      let toolCalls = response.toolCalls;

      if (!toolCalls || toolCalls.length === 0) {
        if (ToolCallParser.hasToolCalls(response.content)) {
          toolCalls = ToolCallParser.parse(response.content);
          console.log('[AGENTIC] ✅ Parsed', toolCalls.length, 'tool calls from XML');
        }
      } else {
        console.log('[AGENTIC] 🎯 Native tool calls:', toolCalls.length);
      }

      if (!toolCalls || toolCalls.length === 0) {
        return {
          content: response.content,
          metadata: options?.detailed
            ? {
                tokensUsed: totalUsage,
                toolsCalled,
                agentsCalled: [],
                executionTime: 0,
                model: this.model,
              }
            : undefined,
        };
      }

      const toolResults = await this.executeToolCalls(toolCalls, 'main', generateExecutionId());
      toolsCalled.push(...toolCalls.map((tc) => tc.name));

      currentMessages.push({
        role: 'assistant',
        content: response.content || 'Using tools...',
        toolCalls: toolCalls,
      });

      for (const result of toolResults) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          name: result.name,
          toolCallId: result.id,
        });
      }

      iterations++;
    }

    return {
      content: 'Maximum tool calling iterations reached',
      metadata: options?.detailed
        ? {
            tokensUsed: totalUsage,
            toolsCalled,
            agentsCalled: [],
            executionTime: 0,
            model: this.model,
          }
        : undefined,
    };
  }

  private async runAutonomous(message: string, options?: RunOptions): Promise<ZaFlowResponse> {
    const agentsCalled: string[] = [];
    const toolsCalled: string[] = [];
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    const agentInstructions = AgentDelegationFormatter.generateAgentInstructions(this.agents, this.tools);

    const messages: ProviderMessage[] = [
      { role: 'system', content: agentInstructions },
      { role: 'user', content: message },
    ];

    const response = await this.provider.chat(messages, this.config);

    if (response.usage) {
      totalUsage.prompt += response.usage.promptTokens;
      totalUsage.completion += response.usage.completionTokens;
      totalUsage.total += response.usage.totalTokens;
    }

    console.log('[AUTONOMOUS] Main agent response length:', response.content.length);

    const agentCalls = AgentDelegationFormatter.parseAgentCalls(response.content);

    if (agentCalls.length > 0) {
      console.log(
        `[AUTONOMOUS] 🚀 Delegating to ${agentCalls.length} agent(s):`,
        agentCalls.map((ac) => ac.name),
      );

      const agentResults: Array<{ agentName: string; result: string }> = [];

      for (const agentCall of agentCalls) {
        const agent = this.agents.find((a) => a.name === agentCall.name);

        if (!agent) {
          console.log(`[AUTONOMOUS] ⚠️  Agent "${agentCall.name}" not found`);
          agentResults.push({
            agentName: agentCall.name,
            result: `Error: Agent "${agentCall.name}" not found`,
          });
          continue;
        }

        agentsCalled.push(agent.name);
        this.hooks?.onAgentStart?.(agent.name);

        try {
          const agentMessages: ProviderMessage[] = [
            { role: 'system', content: agent.getSystemPrompt() },
            { role: 'user', content: agentCall.task },
          ];

          const agentResponse = await this.provider.chat(agentMessages, agent.config || this.config, agent.tools);

          if (agentResponse.usage) {
            totalUsage.prompt += agentResponse.usage.promptTokens;
            totalUsage.completion += agentResponse.usage.completionTokens;
            totalUsage.total += agentResponse.usage.totalTokens;
          }

          if (agentResponse.toolCalls && agentResponse.toolCalls.length > 0) {
            console.log(`[AUTONOMOUS] ${agent.name} 🔧 called ${agentResponse.toolCalls.length} tool(s)`);

            const toolResults = await this.executeToolCalls(agentResponse.toolCalls, agent.name, generateExecutionId());

            toolsCalled.push(...agentResponse.toolCalls.map((tc) => tc.name));

            const finalMessages = [
              ...agentMessages,
              {
                role: 'assistant' as const,
                content: agentResponse.content,
                toolCalls: agentResponse.toolCalls,
              },
              ...toolResults.map((tr) => ({
                role: 'tool' as const,
                content: JSON.stringify(tr.result),
                name: tr.name,
                toolCallId: tr.id,
              })),
            ];

            const finalResponse = await this.provider.chat(finalMessages, agent.config || this.config);

            if (finalResponse.usage) {
              totalUsage.prompt += finalResponse.usage.promptTokens;
              totalUsage.completion += finalResponse.usage.completionTokens;
              totalUsage.total += finalResponse.usage.totalTokens;
            }

            agentResults.push({
              agentName: agent.name,
              result: finalResponse.content,
            });
          } else {
            agentResults.push({
              agentName: agent.name,
              result: agentResponse.content,
            });
          }

          this.hooks?.onAgentComplete?.(agent.name, agentResponse.content);
          console.log(`[AUTONOMOUS] ✅ ${agent.name} completed`);
        } catch (error) {
          const err = error as Error;
          this.hooks?.onAgentError?.(agent.name, err);
          console.log(`[AUTONOMOUS] ❌ ${agent.name} failed:`, err.message);

          agentResults.push({
            agentName: agent.name,
            result: `Error: ${err.message}`,
          });
        }
      }

      console.log('[AUTONOMOUS] 🔄 Synthesizing results from', agentResults.length, 'agent(s)');

      const synthesisMessages: ProviderMessage[] = [
        {
          role: 'system',
          content: 'You are the main orchestrator. Synthesize the results from specialized agents into a comprehensive final answer.',
        },
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: response.content,
        },
        {
          role: 'user',
          content: `Agent results:\n\n${agentResults
            .map((ar) => `**${ar.agentName}:**\n${ar.result}`)
            .join('\n\n')}\n\nPlease synthesize these results into a comprehensive final answer for the user.`,
        },
      ];

      const finalResponse = await this.provider.chat(synthesisMessages, this.config);

      if (finalResponse.usage) {
        totalUsage.prompt += finalResponse.usage.promptTokens;
        totalUsage.completion += finalResponse.usage.completionTokens;
        totalUsage.total += finalResponse.usage.totalTokens;
      }

      return {
        content: finalResponse.content,
        metadata: options?.detailed
          ? {
              tokensUsed: totalUsage,
              toolsCalled,
              agentsCalled,
              executionTime: 0,
              model: this.model,
            }
          : undefined,
      };
    } else {
      console.log('[AUTONOMOUS] ℹ️  No agent delegation detected, returning orchestrator response');

      return {
        content: response.content,
        metadata: options?.detailed
          ? {
              tokensUsed: totalUsage,
              toolsCalled,
              agentsCalled,
              executionTime: 0,
              model: this.model,
            }
          : undefined,
      };
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[], agentName: string, executionId: string): Promise<Array<{ id: string; name: string; result: any }>> {
    const results: Array<{ id: string; name: string; result: any }> = [];

    for (const toolCall of toolCalls) {
      const tool = this.tools.find((t) => t.name === toolCall.name);

      if (!tool) {
        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result: { error: `Tool ${toolCall.name} not found` },
        });
        continue;
      }

      try {
        this.hooks?.onToolCall?.(toolCall.name, toolCall.arguments);

        const context: ToolContext<TContext> = {
          userContext: this.getContext(),
          sharedMemory: this.sharedMemory,
          agentName,
          conversationHistory: this.history,
          metadata: {
            executionId,
            timestamp: Date.now(),
            mode: this.mode,
          },
          storage: this.storage,
        };

        const result = await tool.run(toolCall.arguments, context);

        this.hooks?.onToolComplete?.(toolCall.name, result);

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result,
        });
      } catch (error) {
        const err = error as Error;
        this.hooks?.onToolError?.(toolCall.name, err);

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result: { error: err.message },
        });
      }
    }

    return results;
  }

  private prepareMessages(): ProviderMessage[] {
    const messages: ProviderMessage[] = [];

    const systemContent = this.systemPrompt || this.getDefaultSystemPrompt();
    messages.push({ role: 'system', content: systemContent });

    for (const msg of this.history) {
      messages.push({
        role: msg.role,
        content: msg.content,
        name: msg.name,
        toolCallId: msg.toolCallId,
      });
    }

    return messages;
  }

  private getDefaultSystemPrompt(): string {
    switch (this.mode) {
      case 'single':
        return 'You are a helpful AI assistant.';
      case 'agentic':
        return 'You are a helpful AI assistant with access to tools. Use tools when needed to help answer questions.';
      case 'autonomous':
        return 'You are an AI orchestrator managing multiple specialized agents. Coordinate agents effectively to complete tasks.';
      default:
        return 'You are a helpful AI assistant.';
    }
  }
}
