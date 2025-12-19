import { MemoryStorage } from '../plugins/storage/MemoryStorage';
import { Intent } from '../utils/Intent';
import { AgentDelegationFormatter } from '../protocol/AgentDelegation';
import { ToolCallParser } from '../protocol/ToolCallParser';
import type { Agent } from '../types/agent';
import type { ContentPart } from '../types/content';
import { extractMediaParts, getTextContent, hasMedia } from '../types/content';
import type { ExecutionMode, Message, ModelConfig, RunOptions, StreamOptions, TokenUsage, ZaFlowOptions, ZaFlowResponse } from '../types/core';
import type { Hooks } from '../types/hooks';
import type { Provider, ProviderMessage, ToolCall } from '../types/provider';
import type { StoragePlugin } from '../types/storage';
import type { Tool, ToolContext } from '../types/tool';
import { generateExecutionId } from '../utils/id';
import { semanticSearch } from '../utils/SemanticSearch';
import { simulateStreaming } from '../utils/streaming';
import { ContextManager } from './Context';
import { MediaProcessor } from './MediaProcessor';
import { SharedMemoryPool } from './Memory';

/**
 * Main ZaFlow class for orchestrating AI workflows
 */
export default class ZaFlow<TContext = any> {
  private mode: ExecutionMode;
  private provider: Provider;
  private agents: Agent[];
  private tools: Tool[];
  private config: ModelConfig;
  private contextManager: ContextManager<TContext>;
  private sharedMemory: SharedMemoryPool;
  private storage: StoragePlugin;
  private hooks?: Hooks;
  private history: Message[] = [];
  private systemPrompt?: string;
  private prompts: Array<{ prompt: string; context?: any }> = [];
  private mediaProcessor: MediaProcessor; // 🔥 Genius Media Processor

  constructor(options: ZaFlowOptions<TContext>) {
    this.mode = options.mode;
    this.provider = options.provider;
    this.agents = options.agents || [];
    this.tools = options.tools || [];
    this.config = options.config || {};
    this.hooks = options.hooks;
    this.systemPrompt = options.systemPrompt;

    this.contextManager = new ContextManager<TContext>(this.hooks);
    this.sharedMemory = new SharedMemoryPool(this.hooks);
    this.storage = options.storage || new MemoryStorage();
    this.mediaProcessor = new MediaProcessor(this.tools); // 🔥 Initialize processor
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

  loadHistory(history: Message[]): void {
    this.history = [...history];
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the model from provider's defaultModel
   */
  getModel(): string {
    return this.provider.defaultModel;
  }

  /**
   * Add custom prompt with optional context
   * This allows adding additional prompts that can use context data
   */
  addPrompt(prompt: string, context?: any): void {
    this.prompts.push({ prompt, context });
  }

  /**
   * Get compiled prompts with context interpolation
   */
  private getCompiledPrompts(): string {
    if (this.prompts.length === 0) {
      return '';
    }

    return this.prompts
      .map(({ prompt, context }) => {
        if (!context) {
          return prompt;
        }

        // Simple context replacement: {key} -> value
        return prompt.replace(/\{([^}]+)\}/g, (match, key) => {
          const value = context[key];
          return value !== undefined ? String(value) : match;
        });
      })
      .join('\n\n');
  }

  async run(message: string | Message | ContentPart[], options?: RunOptions): Promise<ZaFlowResponse> {
    const startTime = Date.now();
    const executionId = generateExecutionId();

    try {
      // 🔥 GENIUS MULTIMODAL SUPPORT
      let userMessage: Message;

      if (typeof message === 'string') {
        userMessage = { role: 'user', content: message };
      } else if (Array.isArray(message)) {
        userMessage = { role: 'user', content: message };
      } else {
        userMessage = message;
      }

      this.hooks?.onStart?.(getTextContent(userMessage.content));
      this.history.push(userMessage);

      // 🔥 AUTO-DETECT AND PROCESS MEDIA
      if (hasMedia(userMessage.content)) {
        const mediaParts = extractMediaParts(userMessage.content);
        console.log(`[ZaFlow] 🎯 Auto-detected ${mediaParts.length} media item(s)`);

        const toolContext: ToolContext<TContext> = {
          userContext: this.getContext(),
          sharedMemory: this.sharedMemory,
          agentName: 'main',
          conversationHistory: this.history,
          metadata: { executionId, timestamp: Date.now(), mode: this.mode },
          storage: this.storage,
        };

        const { summary } = await this.mediaProcessor.process(mediaParts, toolContext);

        if (summary) {
          // Inject analysis results into history
          this.history.push({ role: 'system', content: summary });
          console.log('[ZaFlow] ✅ Media processing complete, results injected into context');
        }
      }

      // 🔥 AUTO-PROCESS QUOTED MESSAGES (Semantic Search)
      if (userMessage.quotedMessage) {
        const { content: quotedContent } = userMessage.quotedMessage;
        const config = userMessage.quotedMessage.config || { strategy: 'semantic' };
        const replyText = getTextContent(userMessage.content);
        const strategy = config.strategy || 'semantic';

        if (strategy === 'semantic' && quotedContent.length > 300) {
          try {
            console.log('[ZaFlow] 🧠 Starting semantic search for quoted message...');
            await semanticSearch.initialize();

            const processedQuote = await semanticSearch.findRelevantContext(quotedContent, replyText, {
              maxChunks: config.semanticOptions?.maxChunks || 3,
              minSimilarity: config.semanticOptions?.minSimilarity || 0.3,
              maxChunkLength: config.semanticOptions?.maxChunkLength || 200,
            });

            console.log(`[ZaFlow] 🧠 Semantic extraction: ${quotedContent.length} → ${processedQuote.length} chars`);
            userMessage.quotedMessage.content = processedQuote;
          } catch (error) {
            console.warn('[ZaFlow] Semantic search failed, falling back to truncate:', error);
            userMessage.quotedMessage.content = quotedContent.substring(0, config.maxLength || 300) + '...';
          }
        } else if (strategy === 'truncate' && quotedContent.length > (config.maxLength || 300)) {
          userMessage.quotedMessage.content = quotedContent.substring(0, config.maxLength || 300) + '...';
        }
      }

      console.log('🔍 ~ run ~ src/core/ZaFlow.ts:184 ~ userMessage:', userMessage);

      const textMessage = getTextContent(userMessage.content);
      let response: ZaFlowResponse;

      switch (this.mode) {
        case 'single':
          response = await this.runSingle(textMessage, options);
          break;
        case 'agentic':
          response = await this.runAgentic(textMessage, options);
          break;
        case 'autonomous':
          response = await this.runAutonomous(userMessage, options);
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
      const errorInput = typeof message === 'string' ? message : getTextContent(Array.isArray(message) ? message : message.content);
      this.hooks?.onError?.(err, { phase: 'orchestration', input: errorInput });

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

  async *stream(message: string | Message | ContentPart[], options?: StreamOptions): AsyncIterableIterator<string> {
    const textMessage = typeof message === 'string' ? message : getTextContent(Array.isArray(message) ? message : message.content);
    this.hooks?.onStart?.(textMessage);
    this.history.push({ role: 'user', content: typeof message === 'string' ? message : Array.isArray(message) ? message : message.content });

    // Complex modes (AGENTIC, AUTONOMOUS) need full execution before streaming
    // because tool calling and agent delegation can't be truly streamed
    if (this.mode === 'agentic' || this.mode === 'autonomous') {
      console.log(`[STREAM] ${this.mode.toUpperCase()} mode - executing fully then streaming result...`);

      // Execute fully with all tools/agents - ALWAYS get detailed metadata
      const response = await this.run(message, {
        persistContext: options?.persistContext,
        detailed: true, // Always generate metadata for hooks
        systemPrompt: options?.systemPrompt, // Pass systemPrompt for override
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
        const messages = this.prepareMessages(options?.systemPrompt);
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
        const response = await this.run(message, { persistContext: options?.persistContext, systemPrompt: options?.systemPrompt });

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
    const messages = this.prepareMessages(options?.systemPrompt);
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
            model: this.getModel(),
          }
        : undefined,
    };
  }

  private async runAgentic(message: string, options?: RunOptions): Promise<ZaFlowResponse> {
    const messages = this.prepareMessages(options?.systemPrompt);
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
                model: this.getModel(),
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
            model: this.getModel(),
          }
        : undefined,
    };
  }

  private async runAutonomous(userMessage: Message, options?: RunOptions): Promise<ZaFlowResponse> {
    const agentsCalled: string[] = [];
    const toolsCalled: string[] = [];
    let totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    const agentInstructions = AgentDelegationFormatter.generateAgentInstructions(this.agents, this.tools);

    // Priority: runtime systemPrompt > class systemPrompt > default
    let baseSystemPrompt = options?.systemPrompt || this.systemPrompt || this.getDefaultSystemPrompt();

    // Append compiled prompts if any
    const compiledPrompts = this.getCompiledPrompts();
    if (compiledPrompts) {
      baseSystemPrompt = `${baseSystemPrompt}\n\n${compiledPrompts}`;
    }

    // Merge base system prompt with agent instructions
    const systemContent = `${baseSystemPrompt}\n\n---\n\n${agentInstructions}`;

    // 🔥 Format content with quoted message
    let content = getTextContent(userMessage.content);
    if (userMessage.quotedMessage) {
      const { role, content: quotedText } = userMessage.quotedMessage;
      content = `[QUOTED MESSAGE]\nRole: ${role.toUpperCase()}\nContent: "${quotedText}"\n---\n\n${content}`;
    }

    const messages: ProviderMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content },
    ];

    const response = await this.provider.chat(messages, this.config);

    if (response.usage) {
      totalUsage.prompt += response.usage.promptTokens;
      totalUsage.completion += response.usage.completionTokens;
      totalUsage.total += response.usage.totalTokens;
    }

    console.log('[AUTONOMOUS] Main agent response length:', response.content.length);

    let agentCalls = AgentDelegationFormatter.parseAgentCalls(response.content);
    let toolCalls = ToolCallParser.parse(response.content);

    // 🚨 ENFORCEMENT: If no agent calls detected BUT agents are available, force retry
    // SKIP enforcement if the user message is just a greeting/conversational
    const isConversational = Intent.isConversational(content);

    if (agentCalls.length === 0 && toolCalls.length === 0 && this.agents.length > 0 && !isConversational) {
      console.log('[AUTONOMOUS] ⚠️  No agent delegation detected, but agents are available. Enforcing delegation...');

      // Add helpful reminder message
      const enforcementMessage = {
        role: 'user' as const,
        content: `💡 HINT: You have specialized agents available that might be better suited for this task:
${this.agents.map((a) => `- "${a.name}" (${a.role})`).join('\n')}

If the user's request requires specialized processing, please use the <agent_call> XML format to delegate. Otherwise, if it's just general conversation, you can respond directly.`,
      };

      const retryMessages = [...messages, { role: 'assistant' as const, content: response.content }, enforcementMessage];

      const retryResponse = await this.provider.chat(retryMessages, this.config);

      if (retryResponse.usage) {
        totalUsage.prompt += retryResponse.usage.promptTokens;
        totalUsage.completion += retryResponse.usage.completionTokens;
        totalUsage.total += retryResponse.usage.totalTokens;
      }

      // Parse again after enforcement
      agentCalls = AgentDelegationFormatter.parseAgentCalls(retryResponse.content);
      toolCalls = ToolCallParser.parse(retryResponse.content);

      if (agentCalls.length > 0 || toolCalls.length > 0) {
        console.log('[AUTONOMOUS] ✅ Enforcement successful! Delegation/Tool call now detected.');
      } else {
        console.log('[AUTONOMOUS] ⚠️  Model still refusing to delegate. Proceeding with direct response.');
      }
    }

    if (agentCalls.length > 0 || toolCalls.length > 0) {
      if (agentCalls.length > 0) {
        console.log(
          `[AUTONOMOUS] 🚀 Delegating to ${agentCalls.length} agent(s):`,
          agentCalls.map((ac) => ac.name),
        );
      }

      if (toolCalls.length > 0) {
        console.log(`[AUTONOMOUS] 🔧 Executing ${toolCalls.length} direct tool call(s)`);
      }

      const agentResults: Array<{ agentName: string; result: string }> = [];
      const directToolResults: Array<{ name: string; result: any }> = [];

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
          // Build sub-agent system prompt with tool enforcement
          let agentSystemPrompt = agent.getSystemPrompt();

          // 🧠 TOOL GUIDELINES: Add tool calling instructions if agent has tools
          if (agent.tools && agent.tools.length > 0) {
            const toolInstructions = `\n\n📋 TOOL USAGE PROTOCOL
            
You have ${agent.tools.length} specialized tool(s) available to help complete this task:

${agent.tools.map((t) => `- **${t.name}**: ${t.description}`).join('\n')}

⚠️ GUIDELINES:

1. **TOOL USAGE**: When you need to perform an action that a tool can handle, you should use that tool.

2. **DECISION PROCESS**:
   - Check if ANY available tool matches what you need to do
   - If YES → Use <tool_call> XML format (see below)
   - If NO tools match → Respond directly

3. **TOOL CALL FORMAT**:
<tool_call>
<name>exact_tool_name</name>
<arguments>{"param1": "value1", "param2": "value2"}</arguments>
</tool_call>

REMEMBER: Use tools when they are relevant to the task.`;

            agentSystemPrompt += toolInstructions;
          }

          const agentMessages: ProviderMessage[] = [
            { role: 'system', content: agentSystemPrompt },
            { role: 'user', content: agentCall.task },
          ];

          const agentResponse = await this.provider.chat(agentMessages, agent.config || this.config, agent.tools);

          if (agentResponse.usage) {
            totalUsage.prompt += agentResponse.usage.promptTokens;
            totalUsage.completion += agentResponse.usage.completionTokens;
            totalUsage.total += agentResponse.usage.totalTokens;
          }

          // 🧠 GENIUS MULTI-LAYER TOOL INTELLIGENCE
          // Use advanced cascade to extract tool calls no matter what
          const { ToolIntelligence } = await import('../utils/ToolIntelligence');

          let toolCalls = ToolIntelligence.extractToolCallsWithFallback(agentResponse.content, agentCall.task, agent.tools || [], agentResponse.toolCalls);

          // If still no tool calls after intelligent extraction, try one more time with template
          if (toolCalls.length === 0 && agent.tools && agent.tools.length > 0) {
            console.log(`[AUTONOMOUS] ${agent.name} 🎯 Trying template-guided retry...`);

            const template = ToolIntelligence.generateFillableTemplate(agent.tools, agentCall.task);
            const templateMessage = {
              role: 'user' as const,
              content: `You MUST use the tool. Here's the exact template:${template}`,
            };

            const retryMessages = [...agentMessages, { role: 'assistant' as const, content: agentResponse.content }, templateMessage];
            const retryResponse = await this.provider.chat(retryMessages, agent.config || this.config, agent.tools);

            if (retryResponse.usage) {
              totalUsage.prompt += retryResponse.usage.promptTokens;
              totalUsage.completion += retryResponse.usage.completionTokens;
              totalUsage.total += retryResponse.usage.totalTokens;
            }

            // Try extraction again with retry response
            toolCalls = ToolIntelligence.extractToolCallsWithFallback(retryResponse.content, agentCall.task, agent.tools || [], retryResponse.toolCalls);
          }

          if (toolCalls && toolCalls.length > 0) {
            console.log(`[AUTONOMOUS] ${agent.name} 🔧 called ${toolCalls.length} tool(s)`);

            const toolResults = await this.executeToolCalls(toolCalls, agent.name, generateExecutionId());

            toolsCalled.push(...toolCalls.map((tc) => tc.name));

            const finalMessages = [
              ...agentMessages,
              {
                role: 'assistant' as const,
                content: agentResponse.content || 'Using tools...',
                toolCalls: toolCalls,
              },
              ...toolResults.map((tr) => ({
                role: 'tool' as const,
                content: JSON.stringify(tr.result),
                name: tr.name,
                toolCallId: tr.id,
              })),
              {
                role: 'user' as const,
                content: 'Based on the tool results above, provide a complete answer to the task.',
              },
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

      // Execute direct tool calls if any
      if (toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(toolCalls, '', generateExecutionId());
        for (const tr of toolResults) {
          directToolResults.push({ name: tr.name, result: tr.result });
          toolsCalled.push(tr.name);
        }
      }

      console.log('[AUTONOMOUS] 🔄 Synthesizing results...');

      // Priority: runtime systemPrompt > class systemPrompt > default
      let synthesisBasePrompt = options?.systemPrompt || this.systemPrompt;

      // Add synthesizer instruction
      const synthesizerInstruction = 'You are the main orchestrator. Synthesize the results from specialized agents into a comprehensive final answer.';

      if (synthesisBasePrompt) {
        synthesisBasePrompt = `${synthesisBasePrompt}\n\n${synthesizerInstruction}`;
      } else {
        synthesisBasePrompt = synthesizerInstruction;
      }

      // Append compiled prompts if any
      const compiledPrompts = this.getCompiledPrompts();
      if (compiledPrompts) {
        synthesisBasePrompt = `${synthesisBasePrompt}\n\n${compiledPrompts}`;
      }

      const synthesisMessages: ProviderMessage[] = [
        {
          role: 'system',
          content: synthesisBasePrompt,
        },
        { role: 'user', content },
        {
          role: 'assistant',
          content: response.content,
        },
        {
          role: 'user',
          content: `Results to synthesize:\n\n${
            agentResults.length > 0
              ? `Agent results:\n${agentResults.map((ar) => `**${ar.agentName}:**\n${ar.result}`).join('\n\n')}\n\n`
              : ''
          }${
            directToolResults.length > 0
              ? `Direct tool results:\n${directToolResults.map((tr) => `**${tr.name}:**\n${JSON.stringify(tr.result)}`).join('\n\n')}\n\n`
              : ''
          }Please synthesize these results into a comprehensive final answer for the user.`,
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
              model: this.getModel(),
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
              model: this.getModel(),
            }
          : undefined,
      };
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[], agentName: string, executionId: string): Promise<Array<{ id: string; name: string; result: any }>> {
    const results: Array<{ id: string; name: string; result: any }> = [];

    for (const toolCall of toolCalls) {
      // 🔍 SMART TOOL LOOKUP: Search in both main tools AND agent-specific tools
      let tool = this.tools.find((t) => t.name === toolCall.name);

      // If not found in main tools, search in the agent's tools
      if (!tool && agentName) {
        const agent = this.agents.find((a) => a.name === agentName);
        if (agent && agent.tools) {
          tool = agent.tools.find((t) => t.name === toolCall.name);
          if (tool) {
            console.log(`[TOOL EXECUTION] 🎯 Found tool "${toolCall.name}" in agent "${agentName}"`);
          }
        }
      }

      if (!tool) {
        console.log(`[TOOL EXECUTION] ❌ Tool "${toolCall.name}" not found in main tools or agent tools`);
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

  private prepareMessages(runtimeSystemPrompt?: string): ProviderMessage[] {
    const messages: ProviderMessage[] = [];

    // Priority: runtime systemPrompt > class systemPrompt > default
    let baseSystemPrompt = runtimeSystemPrompt || this.systemPrompt || this.getDefaultSystemPrompt();

    // Append compiled prompts if any
    const compiledPrompts = this.getCompiledPrompts();
    if (compiledPrompts) {
      baseSystemPrompt = `${baseSystemPrompt}\n\n${compiledPrompts}`;
    }

    messages.push({ role: 'system', content: baseSystemPrompt });

    for (const msg of this.history) {
      // Convert multimodal content to string for providers that don't support it
      let content = typeof msg.content === 'string' ? msg.content : getTextContent(msg.content);

      // 🔥 Format quoted message if present
      if (msg.quotedMessage) {
        const quotedRole = msg.quotedMessage.role.toUpperCase();
        const quotedText = msg.quotedMessage.content.length > 100 ? msg.quotedMessage.content.substring(0, 100) + '...' : msg.quotedMessage.content;

        content = `[QUOTED MESSAGE]\nRole: ${quotedRole}\nContent: "${quotedText}"\n---\n\n${content}`;
      }

      messages.push({
        role: msg.role,
        content,
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
