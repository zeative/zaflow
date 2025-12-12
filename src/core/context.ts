import { toolRegistry } from '../tools';
import type { AIOptions, ExecutionContext as IExecutionContext, Message, ProviderInterface, ToolDefinition } from '../types';

export class ExecutionContext implements IExecutionContext {
  input: unknown;
  previous: unknown = null;
  parallel: unknown[] = [];
  tokens = 0;
  cost = 0;
  messages: Message[] = [];
  private state = new Map<string, unknown>();
  private provider: ProviderInterface;
  private tools: ToolDefinition[];

  constructor(input: unknown, provider: ProviderInterface, tools: ToolDefinition[] = []) {
    this.input = input;
    this.provider = provider;
    this.tools = tools;
  }

  set<T>(key: string, value: T): void {
    this.state.set(key, value);
  }
  get<T>(key: string, defaultValue?: T): T {
    return (this.state.has(key) ? this.state.get(key) : defaultValue) as T;
  }
  has(key: string): boolean {
    return this.state.has(key);
  }
  addMessage(role: Message['role'], content: string): void {
    this.messages.push({ role, content });
  }

  async ai(opts: string | AIOptions): Promise<string> {
    const o = typeof opts === 'string' ? { prompt: opts } : opts;
    const p = o.provider ?? this.provider;
    const t = o.tools ?? this.tools;
    const msgs: Message[] = [...this.messages, { role: 'user', content: o.prompt }];

    const r = await p.chat(msgs, { model: o.model, temperature: o.temperature, maxTokens: o.maxTokens, tools: t.length ? t : undefined });
    if (r.usage && r.usage.totalTokens > 0) this.tokens += r.usage.totalTokens;
    else this.tokens += this.estimateTokens(JSON.stringify(msgs) + (r.content || ''));
    this.messages.push({ role: 'user', content: o.prompt });

    if (r.toolCalls?.length) return this.handleToolCalls(r.toolCalls, msgs, p, t);
    if (r.content) this.messages.push({ role: 'assistant', content: r.content });
    return r.content ?? '';
  }

  private async handleToolCalls(calls: import('../types').ToolCall[], msgs: Message[], p: ProviderInterface, t: ToolDefinition[]): Promise<string> {
    const am: Message = { role: 'assistant', content: null as unknown as string, tool_calls: calls };
    msgs.push(am);
    this.messages.push(am);

    for (const c of calls) {
      const res = await toolRegistry.execute(c.function.name, JSON.parse(c.function.arguments), this);
      const tm: Message = { role: 'tool', tool_call_id: c.id, content: typeof res === 'string' ? res : JSON.stringify(res) };
      msgs.push(tm);
      this.messages.push(tm);
    }

    const f = await p.chat(msgs, { tools: t.length ? t : undefined });
    if (f.usage && f.usage.totalTokens > 0) this.tokens += f.usage.totalTokens;
    else this.tokens += this.estimateTokens(JSON.stringify(msgs) + (f.content || ''));
    if (f.toolCalls?.length) return this.handleToolCalls(f.toolCalls, msgs, p, t);
    if (f.content) this.messages.push({ role: 'assistant', content: f.content });
    return f.content ?? '';
  }

  clone(): ExecutionContext {
    const c = new ExecutionContext(this.input, this.provider, this.tools);
    c.previous = this.previous;
    c.parallel = [...this.parallel];
    c.tokens = this.tokens;
    c.cost = this.cost;
    c.messages = [...this.messages];
    this.state.forEach((v, k) => c.state.set(k, v));
    return c;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
