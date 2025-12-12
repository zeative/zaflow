import type { AgentConfig, AgentDefinition } from '../types';

export function defineAgent(config: AgentConfig): AgentDefinition {
  return { ...config, id: `agent_${Date.now().toString(36)}_${config.name.toLowerCase().replace(/\s+/g, '_')}` };
}
