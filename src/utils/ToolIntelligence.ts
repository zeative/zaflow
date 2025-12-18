import type { Tool } from '../types/tool';
import type { ToolCall } from '../types/provider';
import { compareTwoStrings } from 'string-similarity';
import nlp from 'compromise';

/**
 * 🧠 GENIUS TOOL INTELLIGENCE ENGINE
 *
 * Makes the library work with even the DUMBEST models using
 * DYNAMIC NLP and SEMANTIC SIMILARITY - NO STATIC KEYWORDS!
 */
export class ToolIntelligence {
  /**
   * Extract semantic features using NLP
   */
  private static extractSemanticFeatures(text: string): {
    verbs: string[];
    nouns: string[];
    topics: string[];
  } {
    const doc = nlp(text);
    return {
      verbs: doc.verbs().out('array'),
      nouns: doc.nouns().out('array'),
      topics: doc.topics().out('array'),
    };
  }

  /**
   * 🎯 Calculate semantic similarity (0-1 score)
   * 100% DYNAMIC - no hardcoded keywords!
   */
  private static calculateSemanticSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase();
    const t2 = text2.toLowerCase();

    // String similarity
    const stringSim = compareTwoStrings(t1, t2);

    // Semantic feature overlap
    const f1 = this.extractSemanticFeatures(t1);
    const f2 = this.extractSemanticFeatures(t2);

    const verbOverlap = f1.verbs.filter((v) => f2.verbs.includes(v)).length;
    const nounOverlap = f1.nouns.filter((n) => f2.nouns.includes(n)).length;
    const topicOverlap = f1.topics.filter((t) => f2.topics.includes(t)).length;

    const totalF1 = f1.verbs.length + f1.nouns.length + f1.topics.length;
    const totalF2 = f2.verbs.length + f2.nouns.length + f2.topics.length;
    const totalOverlap = verbOverlap + nounOverlap + topicOverlap;

    const featureSim = totalF1 > 0 ? totalOverlap / Math.max(totalF1, totalF2) : 0;

    return stringSim * 0.6 + featureSim * 0.4;
  }

  /**
   * 🎯 DYNAMIC INTENT DETECTION via semantic similarity
   */
  static detectToolIntent(response: string, task: string, availableTools: Tool[]): { tool: Tool; confidence: number } | null {
    if (availableTools.length === 0) return null;

    const context = `${task} ${response}`;
    let bestMatch: { tool: Tool; confidence: number } | null = null;

    for (const tool of availableTools) {
      const toolContext = `${tool.name} ${tool.description}`;
      const similarity = this.calculateSemanticSimilarity(context, toolContext);
      const confidence = Math.round(similarity * 100);

      console.log(`[TOOL INTELLIGENCE] 📊 "${tool.name}" similarity: ${confidence}%`);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { tool, confidence };
      }
    }

    return bestMatch && bestMatch.confidence >= 25 ? bestMatch : null;
  }

  /**
   * 🧠 SMART ARGUMENT INFERENCE using NLP
   */
  static inferArguments(response: string, task: string, tool: Tool): Record<string, any> {
    const args: Record<string, any> = {};
    const combined = `${task}\n${response}`;

    // Check for structured data
    const hasData = combined.includes(',') || combined.includes('|') || combined.includes('{') || combined.match(/\d+\s*,\s*\w+/);

    if (hasData) {
      args.data = task;
    }

    // Extract quoted text
    const quoted = combined.match(/"([^"]+)"/);
    if (quoted) {
      args.query = quoted[1];
      args.input = quoted[1];
    }

    // Infer from tool description
    const descLower = tool.description.toLowerCase();
    if (descLower.includes('query') && !args.query) args.query = task;
    if (descLower.includes('search') && !args.query) args.query = task;
    if (descLower.includes('analys') && !args.data) args.data = task;

    // Fallback
    if (Object.keys(args).length === 0) {
      args.data = task;
      args.input = task;
    }

    return args;
  }

  /**
   * 🎯 AUTO CONSTRUCTOR
   */
  static constructToolCall(task: string, response: string, availableTools: Tool[]): ToolCall | null {
    const intent = this.detectToolIntent(response, task, availableTools);
    if (!intent) return null;

    console.log(`[TOOL INTELLIGENCE] 🎯 Intent: "${intent.tool.name}" (${intent.confidence}%)`);

    const args = this.inferArguments(response, task, intent.tool);
    console.log('[TOOL INTELLIGENCE] 🧠 Inferred args:', args);

    return {
      id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: intent.tool.name,
      arguments: args,
    };
  }

  /**
   * Template generator
   */
  static generateFillableTemplate(tools: Tool[], task: string): string {
    if (tools.length === 0) return '';
    const tool = tools[0];
    return `\n\n📝 TEMPLATE:\n<tool_call>\n<name>${tool.name}</name>\n<arguments>{"data": "${task.substring(0, 50)}..."}</arguments>\n</tool_call>\nCOPY THIS.`;
  }

  /**
   * 🌟 MULTI-LAYER CASCADE
   */
  static extractToolCallsWithFallback(response: string, task: string, availableTools: Tool[], nativeToolCalls?: ToolCall[]): ToolCall[] {
    // Layer 1: Native
    if (nativeToolCalls && nativeToolCalls.length > 0) {
      console.log('[TOOL INTELLIGENCE] ✅ Layer 1: Native');
      return nativeToolCalls;
    }

    // Layer 2: XML
    if (response.includes('<tool_call>')) {
      const { ToolCallParser } = require('../protocol/ToolCallParser');
      const xmlCalls = ToolCallParser.parseXML(response);
      if (xmlCalls.length > 0) {
        console.log('[TOOL INTELLIGENCE] ✅ Layer 2: XML');
        return xmlCalls;
      }
    }

    // Layer 3: JSON
    if (response.includes('{') && response.includes('"name"')) {
      const { ToolCallParser } = require('../protocol/ToolCallParser');
      const jsonCalls = ToolCallParser.parseJSON(response);
      if (jsonCalls.length > 0) {
        console.log('[TOOL INTELLIGENCE] ✅ Layer 3: JSON');
        return jsonCalls;
      }
    }

    // Layer 4: 🧠 DYNAMIC SEMANTIC
    console.log('[TOOL INTELLIGENCE] 🧠 Layer 4: Semantic analysis...');
    const autoCall = this.constructToolCall(task, response, availableTools);
    if (autoCall) {
      console.log('[TOOL INTELLIGENCE] ✅ Layer 4: Semantic match!');
      return [autoCall];
    }

    return [];
  }
}
