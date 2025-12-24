import { Agent } from '../../types/agent';
import { ContentPart, extractMediaParts, getTextContent, hasMedia } from '../../types/content';
import { ExecutionMode, Message, ModelConfig, RunOptions, StreamOptions, TokenUsage, ZaFlowResponse } from '../../types/core';
import { Hooks } from '../../types/hooks';
import { Provider, ProviderMessage, ToolCall } from '../../types/provider';
import { Tool } from '../../types/tool';
import { generateExecutionId } from '../../utils/system/id';
import { Intent } from '../../utils/intelligence/Intent';
import { ToolIntelligence } from '../../utils/intelligence/ToolIntelligence';
import { simulateStreaming } from '../../utils/system/streaming';
import { AgentDelegationFormatter } from '../../protocol/AgentDelegation';
import { ResponseFormatter } from '../../protocol/ResponseFormatter';
import { ToolCallParser } from '../../protocol/ToolCallParser';
import { HistoryManager } from '../state/History';
import { ToolExecutor } from './ToolExecutor';

export class ExecutionEngine {
  constructor(
    private provider: Provider,
    private agents: Agent[],
    private tools: Tool[],
    private config: ModelConfig,
    private historyManager: HistoryManager,
    private toolExecutor: ToolExecutor,
    private hooks?: Hooks
  ) {}

  async run(message: Message, mode: ExecutionMode, options?: RunOptions): Promise<ZaFlowResponse> {
    const startTime = Date.now();
    const textMessage = getTextContent(message.content);

    let response: ZaFlowResponse;

    switch (mode) {
      case 'single':
        response = await this.runSingle(textMessage, options);
        break;
      case 'agentic':
        response = await this.runAgentic(options);
        break;
      case 'autonomous':
        response = await this.runAutonomous(message, options);
        break;
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    if (response.metadata) {
      response.metadata.executionTime = Date.now() - startTime;
    }

    return response;
  }

  async *stream(message: Message, mode: ExecutionMode, options?: StreamOptions): AsyncIterableIterator<string> {
    if (mode === 'agentic' || mode === 'autonomous') {
      const response = await this.run(message, mode, {
        persistContext: options?.persistContext,
        detailed: true,
        systemPrompt: options?.systemPrompt,
      });

      for await (const chunk of simulateStreaming(response.content)) {
        this.hooks?.onStreamChunk?.(chunk);
        yield chunk;
      }
      this.hooks?.onStreamComplete?.(response.content);
    } else {
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
      } else {
        const response = await this.run(message, mode, options);
        for await (const chunk of simulateStreaming(response.content)) {
          this.hooks?.onStreamChunk?.(chunk);
          yield chunk;
        }
        this.hooks?.onStreamComplete?.(response.content);
      }
    }
  }

  private prepareMessages(systemPrompt?: string): ProviderMessage[] {
    const history = this.historyManager.getHistory() as ProviderMessage[];
    if (systemPrompt) {
       if (history.length > 0 && history[0].role === 'system') {
         return [{ ...history[0], content: systemPrompt }, ...history.slice(1)];
       } else {
         return [{ role: 'system', content: systemPrompt }, ...history];
       }
    }
    return history;
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
            model: this.provider.defaultModel,
          }
        : undefined,
    };
  }

  private async runAgentic(options?: RunOptions): Promise<ZaFlowResponse> {
    const config = { ...this.config, ...options?.config };
    const toolsCalled: string[] = [];
    const totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
    
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const messages = this.historyManager.getHistory() as ProviderMessage[];
      const agent = options?.agentName ? this.agents.find((a) => a.name === options.agentName) : undefined;
      const provider = agent?.getProvider() || this.provider;
      const tools = agent?.tools || (options?.agentName ? [] : this.tools); 
      const modelConfig = agent?.config || config;

      const response = await provider.chat(messages, modelConfig, tools);
      response.content = response.content || '';

      if (response.usage) {
        totalUsage.prompt += response.usage.promptTokens;
        totalUsage.completion += response.usage.completionTokens;
        totalUsage.total += response.usage.totalTokens;
      }

      let toolCalls = response.toolCalls;

      if (!toolCalls || toolCalls.length === 0) {
        if (ToolCallParser.hasToolCalls(response.content)) {
          toolCalls = ToolCallParser.parse(response.content);
        }
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
                model: this.provider.defaultModel,
              }
            : undefined,
        };
      }

      const toolResults = await this.toolExecutor.execute(toolCalls, 'main', generateExecutionId(), messages as Message[], 'agentic', tools);
      toolsCalled.push(...toolCalls.map((tc) => tc.name));

      this.historyManager.addMessage({
        role: 'assistant',
        content: response.content || 'Using tools...',
        toolCalls: toolCalls,
      });

      for (const result of toolResults) {
        const content = typeof result.result === 'string'
            ? result.result
            : result.result === undefined
              ? 'Tool execution completed with no output.'
              : JSON.stringify(result.result);
        
        this.historyManager.addMessage({
          role: 'tool',
          content,
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
            model: this.provider.defaultModel,
          }
        : undefined,
    };
  }

  private async runAutonomous(userMessage: Message, options?: RunOptions): Promise<ZaFlowResponse> {
    const agentsCalled: string[] = [];
    const toolsCalled: string[] = [];
    const totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };

    const messages = this.prepareMessages(options?.systemPrompt);

    // 🔥 Inject agent delegation instructions if agents are available
    if (this.agents.length > 0) {
      const delegationInstructions = AgentDelegationFormatter.generateAgentInstructions(this.agents, this.tools);
      
      // Check if system message exists
      if (messages.length > 0 && messages[0].role === 'system') {
        messages[0].content = `${messages[0].content}\n\n${delegationInstructions}`;
      } else {
        messages.unshift({ role: 'system', content: delegationInstructions });
      }
    }
    
    if (hasMedia(userMessage.content) && !this.provider.supportsVision) {
      const textOnly = getTextContent(userMessage.content);
      const mediaParts = extractMediaParts(userMessage.content);
      const hint = `\n\n[SYSTEM ALERT]: The user has provided ${mediaParts.length} media item(s) which you CANNOT see directly. Please DELEGATE the analysis to the appropriate agent using the <agent_call> format.`;
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        lastMsg.content = textOnly + hint;
      }
    }

    const response = await this.provider.chat(messages, this.config);
    response.content = response.content || '';

    if (response.usage) {
      totalUsage.prompt += response.usage.promptTokens;
      totalUsage.completion += response.usage.completionTokens;
      totalUsage.total += response.usage.totalTokens;
    }

    let agentCalls = AgentDelegationFormatter.parseAgentCalls(response.content);
    let toolCalls = ToolCallParser.parse(response.content);

    const isConversational = Intent.isConversational(getTextContent(userMessage.content));

    if (agentCalls.length === 0 && toolCalls.length === 0 && this.agents.length > 0 && !isConversational) {
      const enforcementMessage = {
        role: 'user' as const,
        content: `HINT: You have specialized agents available. If the request requires specialized processing, use <agent_call>.`,
      };

      const retryMessages = [...messages, { role: 'assistant' as const, content: response.content }, enforcementMessage];
      const retryResponse = await this.provider.chat(retryMessages, this.config);

      if (retryResponse.usage) {
        totalUsage.prompt += retryResponse.usage.promptTokens;
        totalUsage.completion += retryResponse.usage.completionTokens;
        totalUsage.total += retryResponse.usage.totalTokens;
      }

      agentCalls = AgentDelegationFormatter.parseAgentCalls(retryResponse.content);
      toolCalls = ToolCallParser.parse(retryResponse.content);
    }

    if (agentCalls.length > 0 || toolCalls.length > 0) {
      const agentResults: Array<{ agentName: string; result: string }> = [];
      const directToolResults: Array<{ name: string; result: any }> = [];

      for (const agentCall of agentCalls) {
        const agent = this.agents.find((a) => a.name === agentCall.name);
        if (!agent) {
          agentResults.push({ agentName: agentCall.name, result: `Error: Agent "${agentCall.name}" not found` });
          continue;
        }

        agentsCalled.push(agent.name);
        this.hooks?.onAgentStart?.(agent.name);

        try {
          let agentSystemPrompt = agent.getSystemPrompt();
          if (agent.tools && agent.tools.length > 0) {
            const agentProvider = agent.getProvider() || this.provider;
            if (!agentProvider.supportsNativeTools) {
              agentSystemPrompt += `\n\n${ResponseFormatter.generateToolInstructions(agent.tools, 'xml')}`;
            } else {
              agentSystemPrompt += `\n\nUse tools when relevant.`;
            }
          }

          const agentMessages: ProviderMessage[] = [
            { role: 'system', content: agentSystemPrompt },
            { role: 'user', content: agentCall.task },
          ];

          const agentProvider = agent.getProvider() || this.provider;
          const agentResponse = await agentProvider.chat(agentMessages, agent.config || this.config, agent.tools);

          if (agentResponse.usage) {
            totalUsage.prompt += agentResponse.usage.promptTokens;
            totalUsage.completion += agentResponse.usage.completionTokens;
            totalUsage.total += agentResponse.usage.totalTokens;
          }

          if (subToolCalls.length > 0) {
            const subToolResults = await this.toolExecutor.execute(subToolCalls, agent.name, generateExecutionId(), agentMessages as Message[], 'autonomous', agent.tools);
            toolsCalled.push(...subToolCalls.map((tc) => tc.name));

            const finalMessages = [
              ...agentMessages,
              { role: 'assistant' as const, content: agentResponse.content || 'Using tools...', toolCalls: subToolCalls },
              ...subToolResults.map((tr) => ({
                role: 'tool' as const,
                content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
                name: tr.name,
                toolCallId: tr.id,
              })),
              { role: 'user' as const, content: 'Based on the tool results above, provide a complete answer.' },
            ];

            const finalResponse = await agentProvider.chat(finalMessages, agent.config || this.config, agent.tools);
            
            if (finalResponse.usage) {
              totalUsage.prompt += finalResponse.usage.promptTokens;
              totalUsage.completion += finalResponse.usage.completionTokens;
              totalUsage.total += finalResponse.usage.totalTokens;
            }

            agentResults.push({ agentName: agent.name, result: finalResponse.content });
          } else {
            agentResults.push({ agentName: agent.name, result: agentResponse.content });
          }

          this.hooks?.onAgentComplete?.(agent.name, agentResponse.content);
        } catch (error) {
          const err = error as Error;
          this.hooks?.onAgentError?.(agent.name, err);
          agentResults.push({ agentName: agent.name, result: `Error: ${err.message}` });
        }
      }

      if (toolCalls.length > 0) {
        const toolResults = await this.toolExecutor.execute(toolCalls, '', generateExecutionId(), messages as Message[], 'autonomous', this.tools);
        for (const tr of toolResults) {
          directToolResults.push({ name: tr.name, result: tr.result });
          toolsCalled.push(tr.name);
        }
      }

      const synthesisPrompt = `The agents have completed their tasks. Here are the results:\n\n${agentResults.map(r => `Agent ${r.agentName}: ${r.result}`).join('\n\n')}\n\n${directToolResults.map(r => `Tool ${r.name}: ${JSON.stringify(r.result)}`).join('\n\n')}\n\nBased on these results, provide a final answer to the user. Do NOT delegate again.`;
      
      const synthesisMessages = [...messages, { role: 'user' as const, content: synthesisPrompt }];
      

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
              model: this.provider.defaultModel,
            }
          : undefined,
      };
    }

    return {
      content: response.content,
      metadata: options?.detailed
        ? {
            tokensUsed: totalUsage,
            toolsCalled: [],
            agentsCalled: [],
            executionTime: 0,
            model: this.provider.defaultModel,
          }
        : undefined,
    };
  }
}
