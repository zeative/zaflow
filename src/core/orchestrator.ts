import type {
  AgentEvent,
  ConditionalBranch,
  ExecutionMode,
  ExecutionOptions,
  ExecutionResult,
  ExecutionStats,
  LoopOptions,
  Message,
  ProviderInterface,
  StepDefinition,
  StepResult,
  ToolDefinition,
} from '../types';
import * as z from 'zod';
import { agentRegistry } from '../agents';
import { toolRegistry } from '../tools';
import { ExecutionContext } from './context';
import { formatOutput } from './formatter';
import { StepBuilder, type FlowNode } from './step';
import { getTextContent, estimateTokens } from '../helpers';

const TOOL_PROMPT = `You have access to tools. Use them when needed.

TOOLS:
{{tools}}

To call a tool, respond with JSON: {"tool": "name", "params": {...}}
After receiving results, provide your final answer.`;

const AUTONOMOUS_PROMPT = `You are an intelligent AI assistant. ALWAYS remember the full conversation history.

AGENTS:
{{agents}}

TOOLS:
{{tools}}

CRITICAL RULES:
1. BE PROACTIVE - automatically detect when a tool or agent is needed
2. If user mentions [Image], [Audio], [File] - IMMEDIATELY use the appropriate analyzer agent/tool
3. If user asks to generate/create something - IMMEDIATELY use the appropriate generation agent/tool
4. If user asks about prompts/prompt engineering - delegate to the agent
5. NEVER ask user "should I use a tool?" - just DO IT
6. Remember user's name and all context from conversation history

ACTIONS:
- Use tool: {"tool": "tool_name", "params": {...}}
- Delegate: {"delegate": "agent_name", "task": "..."}
- Normal reply: just respond in plain text

Be smart and proactive!`;

export class Orchestrator {
  private provider: ProviderInterface;
  private tools: ToolDefinition[] = [];
  private stepBuilder = new StepBuilder();
  private toolIndex = new Map<string, Set<string>>();
  private maxToolsPerPrompt = 5;
  private llmSelectThreshold = 30;

  constructor(provider: ProviderInterface) {
    this.provider = provider;
  }

  setTools(tools: ToolDefinition[]): void {
    this.tools = tools;
    toolRegistry.registerMany(tools);
    this.buildToolIndex();
  }

  private buildToolIndex(): void {
    this.toolIndex.clear();
    for (const t of this.tools) {
      const words = new Set<string>();
      this.extractWords(t.name).forEach((w) => words.add(w));
      this.extractWords(t.description).forEach((w) => words.add(w));
      t.config?.keywords?.forEach((k) => this.extractWords(k).forEach((w) => words.add(w)));
      this.toolIndex.set(t.name, words);
    }
  }

  private extractWords(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_\-./]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'can', 'are'].includes(w));
  }

  setMaxToolsPerPrompt(max: number): void {
    this.maxToolsPerPrompt = max;
  }
  setLLMSelectThreshold(threshold: number): void {
    this.llmSelectThreshold = threshold;
  }
  getStepBuilder(): StepBuilder {
    return this.stepBuilder;
  }

  private selectToolsFast(query: string, max: number): ToolDefinition[] {
    if (this.tools.length <= max) return this.tools;
    const queryWords = new Set(this.extractWords(query));
    if (!queryWords.size) return this.tools.slice(0, max);
    const scored = this.tools.map((t) => {
      const toolWords = this.toolIndex.get(t.name) || new Set();
      let score = 0;
      for (const qw of queryWords) for (const tw of toolWords) score += tw === qw ? 10 : tw.includes(qw) || qw.includes(tw) ? 5 : 0;
      return { t, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map((s) => s.t);
  }

  private async selectTools(query: string, max?: number): Promise<ToolDefinition[]> {
    const limit = max ?? this.maxToolsPerPrompt;
    if (this.tools.length <= limit) return this.tools;
    return this.selectToolsFast(query, limit);
  }

  private formatToolSchema(t: ToolDefinition): string {
    const schema = z.toJSONSchema(t.schema) as { properties?: Record<string, { type?: string }>; required?: string[] };
    const params = schema.properties
      ? Object.entries(schema.properties)
          .map(([k, v]) => `${k}: ${v.type || 'any'}${schema.required?.includes(k) ? '' : '?'}`)
          .join(', ')
      : '';
    return `- ${t.name}: ${t.description} {${params}}`;
  }

  private parseJSON(content: string): Record<string, unknown> | null {
    let depth = 0,
      start = -1;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (content[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            return JSON.parse(content.slice(start, i + 1));
          } catch {}
          start = -1;
        }
      }
    }
    return null;
  }

  private parseThinking(text: string | null | undefined): { thinking?: string; output: string } {
    if (!text) return { output: '' };
    const match = text.match(/<think>([\s\S]*?)<\/think>/);
    if (!match) return { output: text };
    const thinking = match[1].trim();
    const output = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    return { thinking, output };
  }

  private extractTextFromJSON(text: string): string {
    if (!text.trim().startsWith('{')) return text;
    try {
      const p = JSON.parse(text);
      return p?.response || p?.content || p?.message || p?.answer || p?.text || p?.result || text;
    } catch {
      return text;
    }
  }

  private async autoProcessMedia(context: ExecutionContext, events: AgentEvent[], options: ExecutionOptions): Promise<string[]> {
    const results: string[] = [];
    const lastUserMsg = context.messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMsg || typeof lastUserMsg.content === 'string') return results;

    for (const part of lastUserMsg.content) {
      if (part.type === 'image_url') {
        const tool = this.tools.find((t) => t.handles?.includes('image'));
        if (tool) {
          try {
            const url = (part as import('../types').ImagePart).image_url.url;
            this.emit(events, options, { type: 'tool_call', tool: tool.name, input: { media: url } });
            const result = await toolRegistry.execute(tool.name, { media: url }, context);
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            results.push(`[Image Analysis]: ${resultStr}`);
            context.messages.push({ role: 'system', content: `Auto-analyzed image: ${resultStr}` });
            this.emit(events, options, { type: 'tool_result', tool: tool.name, output: resultStr });
          } catch (e) {
            results.push(`[Image Analysis Error]: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      if (part.type === 'audio') {
        const tool = this.tools.find((t) => t.handles?.includes('audio'));
        if (tool) {
          try {
            const data = (part as import('../types').AudioPart).audio.data;
            this.emit(events, options, { type: 'tool_call', tool: tool.name, input: { audio: data } });
            const result = await toolRegistry.execute(tool.name, { audio: data }, context);
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            results.push(`[Audio Analysis]: ${resultStr}`);
            context.messages.push({ role: 'system', content: `Auto-analyzed audio: ${resultStr}` });
            this.emit(events, options, { type: 'tool_result', tool: tool.name, output: resultStr });
          } catch (e) {
            results.push(`[Audio Analysis Error]: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      if (part.type === 'file') {
        const tool = this.tools.find((t) => t.handles?.includes('file'));
        if (tool) {
          try {
            const filePart = part as import('../types').FilePart;
            this.emit(events, options, { type: 'tool_call', tool: tool.name, input: { file: filePart.file } });
            const result = await toolRegistry.execute(tool.name, { file: filePart.file }, context);
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            results.push(`[File Analysis]: ${resultStr}`);
            context.messages.push({ role: 'system', content: `Auto-analyzed file: ${resultStr}` });
            this.emit(events, options, { type: 'tool_result', tool: tool.name, output: resultStr });
          } catch (e) {
            results.push(`[File Analysis Error]: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
    }
    return results;
  }

  private emit(events: AgentEvent[], options: ExecutionOptions, event: Omit<AgentEvent, 'timestamp'>): void {
    const e: AgentEvent = { ...event, timestamp: Date.now() };
    events.push(e);
    options.onAgentEvent?.(e);
  }

  async execute(input: string | Message[], options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const start = Date.now();
    const mode = options.mode ?? 'agentic';
    const context = new ExecutionContext(input, this.provider, this.tools);
    const events: AgentEvent[] = [];
    if (typeof input === 'string') context.addMessage('user', input);
    else for (const m of input) context.messages.push(m);
    const steps: StepResult[] = [];
    const nodes = this.stepBuilder.getNodes();
    if (nodes.length > 0) await this.executeNodes(nodes, context, steps, options);
    else await this.executeMode(mode, context, steps, options, events);

    const { thinking, output } = this.parseThinking(context.previous as string);
    const cleanOutput = this.extractTextFromJSON(output);
    const formattedOutput = formatOutput(cleanOutput, options.format);
    const stats = this.calculateStats(events, context.tokens, context.cost);
    return {
      output: formattedOutput,
      thinking,
      messages: context.messages,
      steps,
      events,
      stats,
      duration: Date.now() - start,
    };
  }

  private calculateStats(events: AgentEvent[], tokens: number, cost: number): ExecutionStats {
    const agentCalls: Record<string, number> = {};
    const toolCalls: Record<string, number> = {};
    for (const e of events) {
      if (e.type === 'delegation' && e.agent) agentCalls[e.agent] = (agentCalls[e.agent] || 0) + 1;
      if (e.type === 'tool_call' && e.tool && e.output) toolCalls[e.tool] = (toolCalls[e.tool] || 0) + 1;
    }
    return {
      agentCalls,
      toolCalls,
      totalAgentCalls: Object.values(agentCalls).reduce((a, b) => a + b, 0),
      totalToolCalls: Object.values(toolCalls).reduce((a, b) => a + b, 0),
      tokens,
      cost,
    };
  }

  private async executeNodes(nodes: FlowNode[], context: ExecutionContext, steps: StepResult[], options: ExecutionOptions): Promise<void> {
    for (const node of nodes) {
      if (options.signal?.aborted) break;
      if (node.type === 'step') await this.executeStep(node.step, context, steps);
      else if (node.type === 'conditional') await this.executeConditional(node.branch, context, steps);
      else if (node.type === 'loop') await this.executeLoop(node.options, context, steps, options);
      else if (node.type === 'parallel') await this.executeParallel(node.steps, context, steps);
    }
  }

  private async executeStep(step: StepDefinition, context: ExecutionContext, steps: StepResult[]): Promise<void> {
    const start = Date.now(),
      tb = context.tokens;
    const result = await step.handler(context);
    context.previous = result;
    steps.push({ id: step.id, output: result, tokens: context.tokens - tb, duration: Date.now() - start });
  }

  private async executeConditional(branch: ConditionalBranch, context: ExecutionContext, steps: StepResult[]): Promise<void> {
    for (const step of branch.condition(context) ? branch.then : branch.else ?? []) await this.executeStep(step, context, steps);
  }

  private async executeLoop(opts: LoopOptions, context: ExecutionContext, steps: StepResult[], options: ExecutionOptions): Promise<void> {
    const max = opts.maxIterations ?? 10;
    for (let i = 0; i < max && opts.condition(context) && !options.signal?.aborted; i++) {
      for (const step of opts.steps) await this.executeStep(step, context, steps);
    }
  }

  private async executeParallel(ps: StepDefinition[], context: ExecutionContext, steps: StepResult[]): Promise<void> {
    const results = await Promise.all(
      ps.map(async (step) => {
        const start = Date.now(),
          c = context.clone();
        const result = await step.handler(c);
        context.tokens += c.tokens - context.tokens;
        return { id: step.id, output: result, tokens: c.tokens, duration: Date.now() - start };
      }),
    );
    context.parallel = results.map((r) => r.output);
    steps.push(...results);
  }

  private async executeMode(mode: ExecutionMode, context: ExecutionContext, steps: StepResult[], options: ExecutionOptions, events: AgentEvent[]): Promise<void> {
    const lastUserMsg = context.messages.filter((m) => m.role === 'user').pop();
    const query = lastUserMsg ? getTextContent(lastUserMsg.content) : '';
    if (mode === 'single') {
      const r = await this.provider.chat(context.messages);
      if (r.usage && r.usage.totalTokens > 0) context.tokens += r.usage.totalTokens;
      else context.tokens += estimateTokens(JSON.stringify(context.messages) + (r.content || ''));
      context.previous = r.content ?? '';
      if (r.content) context.messages.push({ role: 'assistant', content: r.content });
      steps.push({ id: 'single', output: r.content, tokens: context.tokens, duration: 0 });
    } else if (mode === 'agentic') {
      context.previous = await this.agenticExec(context, options, query, events);
    } else if (mode === 'autonomous') {
      context.previous = await this.autonomousExec(context, options, query, events);
    }
  }

  private async agenticExec(context: ExecutionContext, options: ExecutionOptions, query: string, events: AgentEvent[]): Promise<string> {
    const maxIter = options.maxIterations ?? 5;
    const maxTc = options.maxToolCalls ?? 10;
    const selectedTools = await this.selectTools(query);
    const usedTools = new Set<string>();
    let tc = 0;

    if (selectedTools.length) {
      context.messages.unshift({ role: 'system', content: TOOL_PROMPT.replace('{{tools}}', selectedTools.map((t) => this.formatToolSchema(t)).join('\n')) });
    }

    for (let iter = 0; iter < maxIter; iter++) {
      if (options.signal?.aborted || tc >= maxTc) break;

      const r = await this.provider.chat(context.messages, { tools: selectedTools.length ? selectedTools : undefined });
      if (r.usage) context.tokens += r.usage.totalTokens;
      else context.tokens += estimateTokens(JSON.stringify(context.messages) + (r.content || ''));

      let calls = r.toolCalls;
      if (!calls?.length && r.content) {
        const p = this.parseJSON(r.content);
        if (p?.tool) calls = [{ id: `call_${Date.now()}`, type: 'function', function: { name: p.tool as string, arguments: JSON.stringify(p.params || {}) } }];
      }

      if (!calls?.length) {
        if (r.content) context.messages.push({ role: 'assistant', content: r.content });
        return r.content ?? '';
      }

      const newCalls = calls.filter((c) => {
        const k = `${c.function.name}:${c.function.arguments}`;
        if (usedTools.has(k)) return false;
        usedTools.add(k);
        return true;
      });
      if (!newCalls.length) {
        const final = await this.provider.chat([...context.messages, { role: 'system', content: 'Provide your final answer now.' }]);
        if (final.usage && final.usage.totalTokens > 0) context.tokens += final.usage.totalTokens;
        else context.tokens += estimateTokens(JSON.stringify(context.messages) + (final.content || ''));
        if (final.content) context.messages.push({ role: 'assistant', content: final.content });
        return final.content ?? r.content ?? '';
      }

      context.messages.push({ role: 'assistant', content: r.content || (null as unknown as string), tool_calls: newCalls });
      for (const call of newCalls) {
        try {
          this.emit(events, options, { type: 'tool_call', tool: call.function.name, input: call.function.arguments });
          const res = await toolRegistry.execute(call.function.name, JSON.parse(call.function.arguments), context);
          tc++;
          const output = typeof res === 'string' ? res : JSON.stringify(res);
          context.messages.push({ role: 'tool', tool_call_id: call.id, content: output });
          this.emit(events, options, { type: 'tool_call', tool: call.function.name, output });
        } catch (e) {
          context.messages.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${e instanceof Error ? e.message : e}` });
        }
      }
    }

    const lastAssistant = context.messages.filter((m) => m.role === 'assistant' && m.content).pop();
    if (lastAssistant) return getTextContent(lastAssistant.content);
    const final = await this.provider.chat([...context.messages, { role: 'user', content: 'Provide your final response.' }]);
    if (final.usage && final.usage.totalTokens > 0) context.tokens += final.usage.totalTokens;
    else context.tokens += estimateTokens(JSON.stringify(context.messages) + (final.content || ''));
    if (final.content) context.messages.push({ role: 'assistant', content: final.content });
    return final.content ?? '';
  }

  private async autonomousExec(context: ExecutionContext, options: ExecutionOptions, query: string, events: AgentEvent[]): Promise<string> {
    const maxIter = options.maxIterations ?? 10;
    const agents = agentRegistry.getAll();
    const selectedTools = await this.selectTools(query);
    const results: string[] = [];

    const mediaResults = await this.autoProcessMedia(context, events, options);
    if (mediaResults.length) results.push(...mediaResults);

    const agentDesc = agents.length ? agents.map((a) => `- ${a.name}: ${a.prompt?.slice(0, 80) || 'General purpose agent'}`).join('\n') : 'No agents available';
    const toolDesc = selectedTools.length ? selectedTools.map((t) => this.formatToolSchema(t)).join('\n') : 'No tools available';

    context.messages.unshift({ role: 'system', content: AUTONOMOUS_PROMPT.replace('{{agents}}', agentDesc).replace('{{tools}}', toolDesc) });

    let consecutiveErrors = 0;
    const maxErrors = 2;

    for (let iter = 0; iter < maxIter; iter++) {
      if (options.signal?.aborted) break;

      if (consecutiveErrors >= maxErrors) {
        context.messages.push({ role: 'system', content: 'Multiple tool errors occurred. Stop using tools and provide your final answer based on what you know.' });
        const final = await this.provider.chat(context.messages);
        if (final.usage && final.usage.totalTokens > 0) context.tokens += final.usage.totalTokens;
        else context.tokens += estimateTokens(JSON.stringify(context.messages) + (final.content || ''));
        if (final.content) context.messages.push({ role: 'assistant', content: final.content });
        return final.content ?? '';
      }

      const r = await this.provider.chat(context.messages, { tools: selectedTools.length ? selectedTools : undefined });
      if (r.usage && r.usage.totalTokens > 0) context.tokens += r.usage.totalTokens;
      else context.tokens += estimateTokens(JSON.stringify(context.messages) + (r.content || ''));

      const parsed = this.parseJSON(r.content || '');

      if (parsed?.delegate && typeof parsed.delegate === 'string') {
        let agent = agentRegistry.get(parsed.delegate);
        if (!agent) {
          const agents = agentRegistry.getAll();
          agent = agents.find((a) => a.name.toLowerCase().includes((parsed.delegate as string).toLowerCase())) || agents[0];
        }
        if (agent) {
          this.emit(events, options, { type: 'delegation', agent: agent.name, input: query });
          const agentResult = await agentRegistry.callAgent(agent, query);

          if (agentResult.usage) {
            context.tokens += agentResult.usage.totalTokens;
          } else {
            const agentInput = (agent.prompt || '') + query;
            context.tokens += estimateTokens(agentInput + (agentResult.content || ''));
          }

          this.emit(events, options, { type: 'agent_response', agent: agent.name, output: agentResult.content ?? '' });
          context.messages.push({ role: 'assistant', content: agentResult.content || '' });
          return agentResult.content || '';
        }
      }

      if (parsed?.tool && typeof parsed.tool === 'string') {
        const params = (parsed.params as Record<string, unknown>) || {};
        const hasValidParams = Object.keys(params).length > 0 && Object.values(params).every((v) => v !== undefined && v !== null && v !== '');

        if (!hasValidParams) {
          context.messages.push({
            role: 'system',
            content: `Invalid tool params. Tool "${parsed.tool}" requires valid parameters. Check the tool schema and try again with proper values, or provide your final answer.`,
          });
          consecutiveErrors++;
          continue;
        }

        try {
          this.emit(events, options, { type: 'tool_call', tool: parsed.tool, input: JSON.stringify(params) });
          const res = await toolRegistry.execute(parsed.tool, params, context);
          const output = typeof res === 'string' ? res : JSON.stringify(res);
          this.emit(events, options, { type: 'tool_call', tool: parsed.tool, output });
          results.push(`[Tool ${parsed.tool}]: ${output}`);
          context.messages.push({ role: 'assistant', content: `Used tool: ${parsed.tool}` });
          context.messages.push({ role: 'system', content: `Tool result: ${output}` });
          consecutiveErrors = 0;
          continue;
        } catch (e) {
          context.messages.push({ role: 'system', content: `Tool error: ${e instanceof Error ? e.message : e}` });
          consecutiveErrors++;
          continue;
        }
      }

      if (r.toolCalls?.length) {
        context.messages.push({ role: 'assistant', content: r.content || (null as unknown as string), tool_calls: r.toolCalls });
        for (const call of r.toolCalls) {
          try {
            const args = JSON.parse(call.function.arguments);
            if (!Object.keys(args).length || Object.values(args).some((v) => v === undefined || v === null)) {
              context.messages.push({ role: 'tool', tool_call_id: call.id, content: 'Invalid params. Provide valid values or give final answer.' });
              consecutiveErrors++;
              continue;
            }
            this.emit(events, options, { type: 'tool_call', tool: call.function.name, input: call.function.arguments });
            const res = await toolRegistry.execute(call.function.name, args, context);
            const output = typeof res === 'string' ? res : JSON.stringify(res);
            this.emit(events, options, { type: 'tool_call', tool: call.function.name, output });
            results.push(`[Tool ${call.function.name}]: ${output}`);
            context.messages.push({ role: 'tool', tool_call_id: call.id, content: output });
            consecutiveErrors = 0;
          } catch (e) {
            context.messages.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${e instanceof Error ? e.message : e}` });
            consecutiveErrors++;
          }
        }
        continue;
      }

      if (r.content) {
        const p = this.parseJSON(r.content);
        if (p?.final_answer) {
          context.messages.push({ role: 'assistant', content: p.final_answer as string });
          return p.final_answer as string;
        }
        context.messages.push({ role: 'assistant', content: r.content });
        return r.content;
      }
    }

    if (results.length) {
      this.emit(events, options, { type: 'synthesis', input: results.join('\n') });
      const synthesis = await this.provider.chat([
        ...context.messages,
        { role: 'user', content: `Synthesize a final response from these results:\n${results.join('\n')}` },
      ]);
      if (synthesis.usage && synthesis.usage.totalTokens > 0) context.tokens += synthesis.usage.totalTokens;
      else context.tokens += estimateTokens(JSON.stringify(context.messages) + (synthesis.content || ''));

      if (synthesis.content) {
        this.emit(events, options, { type: 'synthesis', output: synthesis.content });
        context.messages.push({ role: 'assistant', content: synthesis.content });
      }
      return synthesis.content ?? results.join('\n');
    }

    const lastAssistant = context.messages.filter((m) => m.role === 'assistant' && m.content).pop();
    return lastAssistant ? getTextContent(lastAssistant.content) : '';
  }
}
