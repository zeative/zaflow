import { agentRegistry } from './agents';
import { Orchestrator, StepBuilder } from './core';
import { prompts } from './prompts';
import type {
  AgentDefinition,
  ExecutionOptions,
  ExecutionResult,
  LoopOptions,
  Message,
  StepDefinition,
  StepHandler,
  StepOptions,
  ToolDefinition,
  ZaFlowConfig,
} from './types';

import type { ProviderInterface } from './types';

export class ZaFlow {
  private orchestrator: Orchestrator;

  constructor(config: ZaFlowConfig) {
    this.orchestrator = new Orchestrator(config.provider);
  }

  registerTools(tools: ToolDefinition[]): this {
    this.orchestrator.setTools(tools);
    return this;
  }
  registerAgents(agents: AgentDefinition[]): this {
    agentRegistry.registerMany(agents);
    return this;
  }
  step(id: string, handler: StepHandler, options?: StepOptions): this {
    this.orchestrator.getStepBuilder().step(id, handler, options);
    return this;
  }
  if(condition: (ctx: import('./types').ExecutionContext) => boolean): this {
    this.orchestrator.getStepBuilder().if(condition);
    return this;
  }
  then(steps: StepDefinition[]): this {
    this.orchestrator.getStepBuilder().then(steps);
    return this;
  }
  else(steps: StepDefinition[]): this {
    this.orchestrator.getStepBuilder().else(steps);
    return this;
  }
  endif(): this {
    this.orchestrator.getStepBuilder().endif();
    return this;
  }
  loop(options: LoopOptions): this {
    this.orchestrator.getStepBuilder().loop(options);
    return this;
  }
  parallel(steps: StepDefinition[]): this {
    this.orchestrator.getStepBuilder().parallel(steps);
    return this;
  }
  async run(input: string | Message[], options: ExecutionOptions = {}): Promise<ExecutionResult> {
    return this.orchestrator.execute(input, options);
  }
  get prompts() {
    return prompts;
  }
  static step(id: string, handler: StepHandler, options?: StepOptions): StepDefinition {
    return StepBuilder.createStep(id, handler, options);
  }
}

export { agentRegistry, defineAgent } from './agents';
export { ExecutionContext, formatOutput, mediaRegistry } from './core';
export { image, imageBase64, msg, text, resolveImageUrl, stripMediaFromMessages, resolveMediaInMessages } from './helpers';
export { prompts } from './prompts';
export { createProvider } from './providers';
export { groq, ollama, openai } from './providers/factory';
export { defineTool, toolRegistry } from './tools';
export type * from './types';
