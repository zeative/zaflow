export class PromptManager {
  private prompts: Array<{ prompt: string; context?: any }> = [];
  private systemPrompt?: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt;
  }

  addPrompt(prompt: string, context?: any): void {
    this.prompts.push({ prompt, context });
  }

  getCompiledPrompts(): string {
    if (this.prompts.length === 0) {
      return '';
    }

    return this.prompts
      .map(({ prompt, context }) => {
        if (!context) {
          return prompt;
        }

        return prompt.replace(/\{([^}]+)\}/g, (match, key) => {
          const value = context[key];
          return value !== undefined ? String(value) : match;
        });
      })
      .join('\n\n');
  }

  getSystemPrompt(override?: string): string {
    const base = override || this.systemPrompt || '';
    const compiled = this.getCompiledPrompts();
    return compiled ? `${base}\n\n${compiled}` : base;
  }

  clear(): void {
    this.prompts = [];
  }
}
