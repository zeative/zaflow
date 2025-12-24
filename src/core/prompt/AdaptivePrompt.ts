export interface ProviderCapabilities {
  supportsNativeTools: boolean;
  supportsJsonMode: boolean;
  contextWindow: number;
  weakModel: boolean;
}

export class AdaptivePrompt {
  private capabilities: Map<string, ProviderCapabilities>;

  constructor() {
    this.capabilities = new Map();
    // Initialize with some defaults
    this.capabilities.set('openai', {
      supportsNativeTools: true,
      supportsJsonMode: true,
      contextWindow: 128000,
      weakModel: false,
    });
    this.capabilities.set('ollama', {
      supportsNativeTools: false, // Often requires prompting
      supportsJsonMode: true,
      contextWindow: 4096,
      weakModel: true,
    });
  }

  getSystemPrompt(provider: string, basePrompt: string): string {
    const caps = this.capabilities.get(provider) || {
      supportsNativeTools: false,
      supportsJsonMode: false,
      contextWindow: 4096,
      weakModel: true,
    };

    let prompt = basePrompt;

    if (!caps.supportsNativeTools) {
      prompt += `\n\nYou must use tools by outputting JSON blocks like this:\n\`\`\`json\n{"name": "tool_name", "params": {...}}\n\`\`\``;
    }

    if (caps.weakModel) {
      prompt += `\n\nThink step-by-step before calling a tool.`;
    }

    return prompt;
  }
}
