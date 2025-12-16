const builtinPrompts: Record<string, string> = {
  orchestrator: `You are an Orchestrator. Your goal is to SOLVE tasks using AGENTS and TOOLS.

AGENTS: {{agents}}
TOOLS: {{tools}}

CRITICAL RULES:
1. USE TOOLS IMMEDIATELY if relevant. Do not ask.
2. If User asks to SEARCH/FIND/CHECK -> MUST use "web_search".
3. DO NOT answer from memory if a tool can help.
4. FORMAT: {"tool": "name", "params": {...}}
5. ONLY answer from your own knowledge if NO tool or agent is relevant.
6. If the user asks to SEARCH, FIND, or CHECK something, you MUST use a tool (like web_search), even if you know the answer.
7. DO NOT answer from your own knowledge if the user asks to SEARCH. You MUST use the tool first.
8. DO NOT say "I will search" or "Let me check". JUST SEARCH.

EXAMPLES:
User: "Search news" -> {"tool": "web_search", "params": {"query": "news"}}
User: "Calc 2+2" -> {"tool": "calculator", "params": {"expression": "2+2"}}

GO!`,

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
    let prompt = this.#prompts.get(name);
    if (!prompt) throw new Error(`Prompt not found: ${name}`);
    if (vars) for (const [k, v] of Object.entries(vars)) prompt = prompt.replaceAll(`{{${k}}}`, v);
    return prompt;
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
