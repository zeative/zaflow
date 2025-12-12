const builtinPrompts: Record<string, string> = {
  orchestrator: `You are an AI orchestrator that plans and executes complex tasks.

Available agents:
{{agents}}

Available tools:
{{tools}}

Your job is to:
1. Analyze the user's request
2. Determine which agents and tools are needed
3. Execute them in the optimal order
4. Combine results into a coherent response`,

  summarizer: `Summarize the following conversation/context into a concise format.
Focus on: Key decisions, Important data/results, Current state, Next steps.
Keep under 200 words.

Context:
{{context}}`,

  error_handler: `An error occurred. Analyze and decide the best recovery strategy.

Error: {{error}}
Context: {{context}}
Options: RETRY, SKIP, FALLBACK, ABORT

Respond with JSON: {"action": "...", "reason": "..."}`,
};

export class PromptManager {
  #prompts = new Map<string, string>(Object.entries(builtinPrompts));

  get(name: string, vars?: Record<string, string>): string {
    let p = this.#prompts.get(name);
    if (!p) throw new Error(`Prompt not found: ${name}`);
    if (vars) for (const [k, v] of Object.entries(vars)) p = p.replaceAll(`{{${k}}}`, v);
    return p;
  }

  set(name: string, template: string): void {
    this.#prompts.set(name, template);
  }
  has(name: string): boolean {
    return this.#prompts.has(name);
  }
  list(): string[] {
    return [...this.#prompts.keys()];
  }
}

export const prompts = new PromptManager();
