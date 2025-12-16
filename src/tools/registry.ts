import type { ExecutionContext, ToolDefinition } from '../types';

type CacheEntry = { value: unknown; expiry: number };

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private cache = new Map<string, CacheEntry>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: ToolDefinition[]): void {
    tools.forEach((t) => this.register(t));
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, params: unknown, context: ExecutionContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const cacheKey = tool.config?.cacheable ? `${name}:${tool.config.cacheKey?.(params) ?? JSON.stringify(params)}` : null;
    if (cacheKey) {
      const c = this.cache.get(cacheKey);
      if (c && c.expiry > Date.now()) return c.value;
    }

    const maxRetries = tool.config?.retryable ? tool.config.maxRetries ?? 3 : 1;

    let result: unknown;
    let lastErr: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const validated = tool.schema.parse(params);

        result = await Promise.race([
          Promise.resolve(tool.handler(validated, context)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), tool.config?.timeout ?? 30000)),
        ]);

        lastErr = null;
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 1000 << i));
      }
    }

    if (lastErr) throw lastErr;
    if (cacheKey && tool.config?.cacheable) this.cache.set(cacheKey, { value: result, expiry: Date.now() + (tool.config.cacheTTL ?? 300000) });
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const toolRegistry = new ToolRegistry();
