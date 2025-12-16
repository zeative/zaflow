import type { Hooks } from '../types/hooks';

/**
 * Context manager (Zustand-like state management)
 */
export class ContextManager<TContext = any> {
  private context: TContext = {} as TContext;
  private hooks?: Hooks;

  constructor(hooks?: Hooks) {
    this.hooks = hooks;
  }

  /**
   * Add context data
   */
  addContext(context: Partial<TContext>): void {
    this.context = { ...this.context, ...context };
    this.hooks?.onContextUpdate?.(this.context);
  }

  /**
   * Get current context
   */
  getContext(): TContext {
    return { ...this.context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {} as TContext;
    this.hooks?.onContextClear?.();
  }

  /**
   * Check if context has data
   */
  hasContext(): boolean {
    return Object.keys(this.context).length > 0;
  }
}
