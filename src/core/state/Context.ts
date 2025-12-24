import type { Hooks } from '../../types/hooks';

export class ContextManager<TContext = any> {
  private context: TContext = {} as TContext;
  private hooks?: Hooks;

  constructor(hooks?: Hooks) {
    this.hooks = hooks;
  }

  addContext(context: Partial<TContext>): void {
    this.context = { ...this.context, ...context };
    this.hooks?.onContextUpdate?.(this.context);
  }

  getContext(): TContext {
    return { ...this.context };
  }

  clearContext(): void {
    this.context = {} as TContext;
    this.hooks?.onContextClear?.();
  }

  hasContext(): boolean {
    return Object.keys(this.context).length > 0;
  }
}
