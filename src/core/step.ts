import type { ConditionalBranch, ExecutionContext, LoopOptions, StepDefinition, StepHandler, StepOptions } from '../types';

export type FlowNode =
  | { type: 'step'; step: StepDefinition }
  | { type: 'conditional'; branch: ConditionalBranch }
  | { type: 'loop'; options: LoopOptions }
  | { type: 'parallel'; steps: StepDefinition[] };

export class StepBuilder {
  private nodes: FlowNode[] = [];
  private pendingCond: ((ctx: ExecutionContext) => boolean) | null = null;
  private pendingThen: StepDefinition[] = [];

  step(id: string, handler: StepHandler, options?: StepOptions): this {
    this.nodes.push({ type: 'step', step: { id, handler, options } });
    return this;
  }

  if(condition: (ctx: ExecutionContext) => boolean): this {
    this.pendingCond = condition;
    return this;
  }

  then(steps: StepDefinition[]): this {
    this.pendingThen = steps;
    return this;
  }

  else(steps: StepDefinition[]): this {
    if (this.pendingCond) {
      this.nodes.push({ type: 'conditional', branch: { condition: this.pendingCond, then: this.pendingThen, else: steps } });
      this.pendingCond = null;
      this.pendingThen = [];
    }
    return this;
  }

  endif(): this {
    if (this.pendingCond) {
      this.nodes.push({ type: 'conditional', branch: { condition: this.pendingCond, then: this.pendingThen } });
      this.pendingCond = null;
      this.pendingThen = [];
    }
    return this;
  }

  loop(options: LoopOptions): this {
    this.nodes.push({ type: 'loop', options });
    return this;
  }

  parallel(steps: StepDefinition[]): this {
    this.nodes.push({ type: 'parallel', steps });
    return this;
  }

  getNodes(): FlowNode[] {
    return this.nodes;
  }

  static createStep(id: string, handler: StepHandler, options?: StepOptions): StepDefinition {
    return { id, handler, options };
  }
}
