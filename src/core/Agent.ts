import type { AgentCapability, AgentDefinition, Agent as IAgent } from '../types/agent';
import type { ModelConfig } from '../types/core';
import type { Tool } from '../types/tool';
import type { Provider } from '../types/provider';

/**
 * Agent implementation
 */
export class Agent implements IAgent {
  name: string;
  role: string;
  systemPrompt?: string;
  tools?: Tool[];
  provider?: Provider;
  model?: string;
  config?: ModelConfig;
  capabilities?: AgentCapability[];
  constraints?: {
    maxToolCalls?: number;
    maxExecutionTime?: number;
  };

  constructor(definition: AgentDefinition) {
    this.name = definition.name;
    this.role = definition.role;
    this.systemPrompt = definition.systemPrompt;
    this.tools = definition.tools;
    this.provider = definition.provider;
    this.model = definition.model;
    this.config = definition.config;
    this.capabilities = definition.capabilities;
    this.constraints = definition.constraints;
  }

  /**
   * Generate system prompt for this agent
   */
  getSystemPrompt(): string {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    // Auto-generate from role and capabilities
    let prompt = `You are a ${this.role}.`;

    if (this.capabilities && this.capabilities.length > 0) {
      prompt += `\n\nYour capabilities include: ${this.capabilities.join(', ')}.`;
    }

    if (this.tools && this.tools.length > 0) {
      prompt += `\n\nYou have access to the following tools: ${this.tools.map((t) => t.name).join(', ')}.`;
    }

    return prompt;
  }

  /**
   * Check if agent has a capability
   */
  hasCapability(capability: string): boolean {
    if (!this.capabilities) {
      return false;
    }

    return this.capabilities.some((cap) => cap.toLowerCase().includes(capability.toLowerCase()));
  }

  /**
   * Get the model for this agent
   */
  getModel(): string {
    if (this.model) {
      return this.model;
    }

    if (this.provider) {
      return this.provider.defaultModel;
    }

    throw new Error(`Agent "${this.name}" has no model or provider configured`);
  }

  /**
   * Get the provider for this agent
   */
  getProvider(): Provider | undefined {
    return this.provider;
  }

  /**
   * Check if agent can handle a specific media type
   */
  canHandleMedia(mediaType: string): boolean {
    // 1. Check explicit capabilities
    if (this.hasCapability(mediaType) || this.hasCapability(`${mediaType}-analyzer`) || this.hasCapability(`${mediaType}-processor`)) {
      return true;
    }

    // 2. Check role (e.g., "image-analyzer", "vision-expert")
    const roleLower = this.role.toLowerCase();
    if (roleLower.includes(mediaType) || (mediaType === 'image' && roleLower.includes('vision'))) {
      return true;
    }

    // 3. Check name (e.g., "Image Agent")
    const nameLower = this.name.toLowerCase();
    if (nameLower.includes(mediaType)) {
      return true;
    }

    return false;
  }
}
