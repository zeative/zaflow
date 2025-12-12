import type { AgentDefinition, Message, ProviderOptions, ProviderResponse } from '../types';

class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();
  private summaries = new Map<string, string>();

  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
    this.agents.set(agent.name, agent);
  }

  registerMany(agents: AgentDefinition[]): void {
    agents.forEach((a) => this.register(a));
  }
  get(idOrName: string): AgentDefinition | undefined {
    return this.agents.get(idOrName);
  }

  getAll(): AgentDefinition[] {
    const seen = new Set<string>();
    return [...this.agents.values()].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }

  updateSummary(agent: AgentDefinition, summary: string): void {
    this.summaries.set(agent.id, summary);
  }
  getSummary(agent: AgentDefinition): string {
    return this.summaries.get(agent.id) ?? '';
  }

  async callAgent(agent: AgentDefinition, input: string, callerSummary?: string): Promise<ProviderResponse> {
    console.log('🔍 ~ callAgent ~ src/agents/registry.ts:31 ~ input:', input);
    const msgs: Message[] = [];
    if (agent.prompt) msgs.push({ role: 'system', content: agent.prompt });
    if (callerSummary) msgs.push({ role: 'system', content: `Context:\n${callerSummary}` });
    msgs.push({ role: 'user', content: input });
    const opts: ProviderOptions = { model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens, tools: agent.tools };
    return agent.provider.chat(msgs, opts);
  }

  buildAgentDescriptions(): string {
    const all = this.getAll();
    if (!all.length) return '';
    return all.map((a) => `- ${a.name}: ${a.prompt?.slice(0, 100) || 'General agent'}... (tools: ${a.tools?.map((t) => t.name).join(', ') || 'none'})`).join('\n');
  }
}

export const agentRegistry = new AgentRegistry();
