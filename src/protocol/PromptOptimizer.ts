import type { Tool } from '../types/tool';
import type { Agent } from '../types/agent';
import { estimateTokens } from '../utils/tokenizer';

/**
 * 📝 PROMPT OPTIMIZER
 *
 * Optimize prompts for minimal token usage while maintaining effectiveness
 */

export interface PromptOptimizationOptions {
  /** Enable compression */
  compress?: boolean;
  /** Target max tokens */
  maxTokens?: number;
  /** Use concise format */
  concise?: boolean;
}

export class PromptOptimizer {
  /**
   * Optimize tool instructions for minimal tokens
   */
  static optimizeToolInstructions(tools: Tool[], format: 'xml' | 'json' = 'xml'): string {
    if (tools.length === 0) return '';

    if (format === 'xml') {
      // Concise XML format
      let prompt = 'Tools available:\n';

      for (const tool of tools) {
        const schema = tool.toJSONSchema();
        const params = Object.keys(schema.properties || {});
        const required = schema.required || [];

        // Ultra-compact format
        prompt += `• ${tool.name}: ${tool.description}`;

        if (params.length > 0) {
          const paramStr = params.map((p) => (required.includes(p) ? `${p}*` : p)).join(', ');
          prompt += ` [${paramStr}]`;
        }

        prompt += '\n';
      }

      prompt += '\nFormat: <tool_call><name>NAME</name><arguments>{JSON}</arguments></tool_call>';

      return prompt;
    } else {
      return 'Use available tools when needed.';
    }
  }

  /**
   * Optimize agent delegation instructions
   */
  static optimizeAgentInstructions(agents: Agent[], tools?: Tool[]): string {
    let prompt = '🤖 Agents:\n';

    for (const agent of agents) {
      const caps = agent.capabilities?.slice(0, 2).join(', ') || agent.role;
      prompt += `• ${agent.name} - ${caps}\n`;
    }

    prompt += '\nDelegate: <agent_call><name>NAME</name><task>TASK</task></agent_call>\n';

    if (tools && tools.length > 0) {
      prompt += `\nDirect tools (${tools.length}): Use <tool_call> if no agent fits.\n`;
    }

    prompt += '\nRule: Delegate when agent capabilities match task.';

    return prompt;
  }

  /**
   * Compress XML tool format (ultra-compact)
   */
  static compactToolXML(tools: Tool[]): string {
    let xml = '<tools>';

    for (const tool of tools) {
      const schema = tool.toJSONSchema();
      const props = schema.properties || {};
      const req = schema.required || [];

      xml += `<tool n="${tool.name}" d="${tool.description}">`;

      for (const [key, val] of Object.entries(props) as [string, any][]) {
        const r = req.includes(key) ? '1' : '0';
        const t = val.type || 'string';
        xml += `<p n="${key}" t="${t}" r="${r}"/>`;
      }

      xml += '</tool>';
    }

    xml += '</tools>';
    return xml;
  }

  /**
   * Compact agent XML format
   */
  static compactAgentXML(agents: Agent[]): string {
    let xml = '<agents>';

    for (const agent of agents) {
      const caps = agent.capabilities?.slice(0, 2).join('|') || agent.role;
      xml += `<a n="${agent.name}" c="${caps}"/>`;
    }

    xml += '</agents>';
    return xml;
  }

  /**
   * Build minimal system prompt based on mode
   */
  static buildMinimalSystemPrompt(options: {
    mode: 'single' | 'agentic' | 'autonomous';
    tools?: Tool[];
    agents?: Agent[];
    customPrompt?: string;
    compactFormat?: boolean;
  }): string {
    const { mode, tools, agents, customPrompt, compactFormat = true } = options;

    let prompt = customPrompt || '';

    // Add mode-specific instructions
    if (mode === 'agentic' && tools && tools.length > 0) {
      if (compactFormat) {
        prompt += '\n\n' + this.optimizeToolInstructions(tools, 'xml');
      } else {
        // Fall back to regular format if needed
        prompt += '\n\nYou have tools available. Use the <tool_call> format when needed.';
      }
    }

    if (mode === 'autonomous' && agents && agents.length > 0) {
      if (compactFormat) {
        prompt += '\n\n' + this.optimizeAgentInstructions(agents, tools);
      } else {
        prompt += '\n\nYou can delegate to specialized agents using <agent_call> format.';
      }
    }

    return prompt.trim();
  }

  /**
   * Calculate token savings from optimization
   */
  static calculateSavings(
    original: string,
    optimized: string,
  ): {
    original: number;
    optimized: number;
    saved: number;
    percentage: number;
  } {
    const originalTokens = estimateTokens(original);
    const optimizedTokens = estimateTokens(optimized);
    const saved = originalTokens - optimizedTokens;
    const percentage = originalTokens > 0 ? (saved / originalTokens) * 100 : 0;

    return {
      original: originalTokens,
      optimized: optimizedTokens,
      saved,
      percentage,
    };
  }

  /**
   * Optimize prompt by removing redundancy
   */
  static removeRedundancy(text: string): string {
    // Remove excessive newlines
    let optimized = text.replace(/\n{3,}/g, '\n\n');

    // Remove redundant spaces
    optimized = optimized.replace(/ {2,}/g, ' ');

    // Remove common redundant phrases
    const redundantPhrases = [
      /\b(please note that|it is important to note that|keep in mind that)\b/gi,
      /\b(basically|essentially|fundamentally)\b/gi,
      /\b(in order to)\b/gi, // Replace with "to"
    ];

    for (const pattern of redundantPhrases) {
      optimized = optimized.replace(pattern, '');
    }

    // Replace "in order to" with "to"
    optimized = optimized.replace(/\bin order to\b/gi, 'to');

    return optimized.trim();
  }

  /**
   * Use abbreviations for common terms
   */
  static abbreviateCommonTerms(text: string, mode: 'aggressive' | 'conservative' = 'conservative'): string {
    const abbreviations: Record<string, string> = {
      function: 'fn',
      parameter: 'param',
      argument: 'arg',
      required: 'req',
      optional: 'opt',
      description: 'desc',
      available: 'avail',
    };

    if (mode === 'aggressive') {
      Object.assign(abbreviations, {
        example: 'ex',
        response: 'resp',
        request: 'req',
        configuration: 'config',
      });
    }

    let result = text;

    for (const [full, abbr] of Object.entries(abbreviations)) {
      const pattern = new RegExp(`\\b${full}\\b`, 'gi');
      result = result.replace(pattern, abbr);
    }

    return result;
  }
}
