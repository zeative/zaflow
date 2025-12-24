import { MemoryStorage } from '../plugins/storage/MemoryStorage';
import { Agent } from '../types/agent';
import { ContentPart, extractMediaParts, getTextContent, hasMedia } from '../types/content';
import { ExecutionMode, Message, ModelConfig, RunOptions, StreamOptions, ZaFlowOptions, ZaFlowResponse } from '../types/core';
import { Hooks } from '../types/hooks';
import { Provider } from '../types/provider';
import { StoragePlugin } from '../types/storage';
import { Tool, ToolContext } from '../types/tool';
import { generateExecutionId } from '../utils/system/id';
import { semanticSearch } from '../utils/intelligence/SemanticSearch';
import { ContextManager } from './state/Context';
import { ExecutionEngine } from './execution/ExecutionEngine';
import { HistoryManager } from './state/History';
import { MediaProcessor } from './execution/MediaProcessor';
import { SharedMemoryPool } from './state/Memory';
import { PromptManager } from './prompt/PromptManager';
import { ToolExecutor } from './execution/ToolExecutor';

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
  private historyManager: HistoryManager;
  private promptManager: PromptManager;
  private mediaProcessor: MediaProcessor;
  private toolExecutor: ToolExecutor<TContext>;
  private executionEngine: ExecutionEngine;

  constructor(options: ZaFlowOptions<TContext>) {
    this.mode = options.mode;
    this.provider = options.provider;
    this.agents = options.agents || [];
    this.tools = options.tools || [];
    this.config = options.config || {};
    this.hooks = options.hooks;
    this.storage = options.storage || new MemoryStorage();

    this.contextManager = new ContextManager<TContext>(this.hooks);
    this.sharedMemory = new SharedMemoryPool(this.hooks);
    this.historyManager = new HistoryManager(options.historyConfig);
    this.promptManager = new PromptManager(options.systemPrompt);
    this.mediaProcessor = new MediaProcessor(this.tools);
    
    this.toolExecutor = new ToolExecutor(
      this.tools,
      this.contextManager,
      this.sharedMemory,
      this.storage,
      this.hooks
    );

    this.executionEngine = new ExecutionEngine(
      this.provider,
      this.agents,
      this.tools,
      this.config,
      this.historyManager,
      this.toolExecutor,
      this.hooks
    );
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
    return this.historyManager.getHistory();
  }

  loadHistory(history: Message[]): void {
    this.historyManager.loadHistory(history);
  }

  clearHistory(): void {
    this.historyManager.clear();
  }

  getModel(): string {
    return this.provider.defaultModel;
  }

  addPrompt(prompt: string, context?: any): void {
    this.promptManager.addPrompt(prompt, context);
  }

  async run(message: string | Message | ContentPart[], options?: RunOptions): Promise<ZaFlowResponse> {
    const startTime = Date.now();
    const executionId = generateExecutionId();

    try {
      let userMessage: Message;

      if (typeof message === 'string') {
        userMessage = { role: 'user', content: message };
      } else if (Array.isArray(message)) {
        userMessage = { role: 'user', content: message };
      } else {
        userMessage = message;
      }

      this.hooks?.onStart?.(getTextContent(userMessage.content));
      this.historyManager.addMessage(userMessage);

      if (hasMedia(userMessage.content)) {
        const mediaParts = extractMediaParts(userMessage.content);
        const toolContext: ToolContext<TContext> = {
          userContext: this.getContext(),
          sharedMemory: this.sharedMemory,
          agentName: 'main',
          conversationHistory: this.getHistory(),
          metadata: { executionId, timestamp: Date.now(), mode: this.mode },
          storage: this.storage,
        };

        const { summary } = await this.mediaProcessor.process(mediaParts, toolContext);

        if (summary) {
          this.historyManager.addMessage({ role: 'system', content: summary });
        }
      }

      if (userMessage.quotedMessage) {
        const { content: quotedContent } = userMessage.quotedMessage;
        const config = userMessage.quotedMessage.config || { strategy: 'semantic' };
        const replyText = getTextContent(userMessage.content);
        const strategy = config.strategy || 'semantic';

        if (hasMedia(quotedContent)) {
          const quotedMediaParts = extractMediaParts(quotedContent);
          const toolContext: ToolContext<TContext> = {
            userContext: this.getContext(),
            sharedMemory: this.sharedMemory,
            agentName: 'main',
            conversationHistory: this.getHistory(),
            metadata: { executionId, timestamp: Date.now(), mode: this.mode },
            storage: this.storage,
          };

          const { summary } = await this.mediaProcessor.process(quotedMediaParts, toolContext);

          if (summary) {
            this.historyManager.addMessage({ role: 'system', content: `[QUOTED MESSAGE MEDIA]\n${summary}` });
          }
        }

        const quotedTextContent = getTextContent(quotedContent);
        if (strategy === 'semantic' && quotedTextContent.length > 300) {
          try {
            await semanticSearch.initialize();
            const processedQuote = await semanticSearch.findRelevantContext(quotedTextContent, replyText, {
              maxChunks: config.semanticOptions?.maxChunks || 3,
              minSimilarity: config.semanticOptions?.minSimilarity || 0.3,
              maxChunkLength: config.semanticOptions?.maxChunkLength || 200,
            });

            if (typeof quotedContent === 'string') {
              userMessage.quotedMessage.content = processedQuote;
            } else {
              userMessage.quotedMessage.content = quotedContent.map((part) =>
                part.type === 'text' ? { type: 'text', text: processedQuote } as ContentPart : part,
              );
            }
          } catch (error) {
            if (typeof quotedContent === 'string') {
              userMessage.quotedMessage.content = quotedTextContent.substring(0, config.maxLength || 300) + '...';
            }
          }
        } else if (strategy === 'truncate' && quotedTextContent.length > (config.maxLength || 300)) {
          if (typeof quotedContent === 'string') {
            userMessage.quotedMessage.content = quotedTextContent.substring(0, config.maxLength || 300) + '...';
          }
        }
      }

      const systemPrompt = this.promptManager.getSystemPrompt(options?.systemPrompt);
      const runOptions = { ...options, systemPrompt };

      const response = await this.executionEngine.run(userMessage, this.mode, runOptions);

      this.historyManager.addMessage({ role: 'assistant', content: response.content });

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
    let userMessage: Message;

    if (typeof message === 'string') {
      userMessage = { role: 'user', content: message };
    } else if (Array.isArray(message)) {
      userMessage = { role: 'user', content: message };
    } else {
      userMessage = message;
    }

    this.hooks?.onStart?.(getTextContent(userMessage.content));
    this.historyManager.addMessage(userMessage);

    const systemPrompt = this.promptManager.getSystemPrompt(options?.systemPrompt);
    const streamOptions = { ...options, systemPrompt };

    const streamIter = this.executionEngine.stream(userMessage, this.mode, streamOptions);

    for await (const chunk of streamIter) {
      yield chunk;
    }

    if (!options?.persistContext) {
      this.clearContext();
    }
  }
}
