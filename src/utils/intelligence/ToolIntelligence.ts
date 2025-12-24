import { compareTwoStrings } from 'string-similarity';
import nlp from 'compromise';
import { Tool } from '../../types/tool';
import { ToolCall } from '../../types/provider';

export class ToolIntelligence {
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

  private static calculateSemanticSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase();
    const t2 = text2.toLowerCase();

    const stringSim = compareTwoStrings(t1, t2);

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

  static detectToolIntent(response: string, task: string, availableTools: Tool[]): { tool: Tool; confidence: number } | null {
    if (availableTools.length === 0) return null;

    const context = `${task} ${response}`;
    let bestMatch: { tool: Tool; confidence: number } | null = null;

    for (const tool of availableTools) {
      const toolContext = `${tool.name} ${tool.description}`;
      const similarity = this.calculateSemanticSimilarity(context, toolContext);
      const confidence = Math.round(similarity * 100);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { tool, confidence };
      }
    }

    return bestMatch && bestMatch.confidence >= 25 ? bestMatch : null;
  }

  static inferArguments(response: string, task: string, tool: Tool): Record<string, any> {
    const args: Record<string, any> = {};
    const combined = `${task}\n${response}`;

    const hasData = combined.includes(',') || combined.includes('|') || combined.includes('{') || combined.match(/\d+\s*,\s*\w+/);

    if (hasData) {
      args.data = task;
    }

    const quoted = combined.match(/"([^"]+)"/);
    if (quoted) {
      args.query = quoted[1];
      args.input = quoted[1];
    }

    const descLower = tool.description.toLowerCase();
    if (descLower.includes('query') && !args.query) args.query = task;
    if (descLower.includes('search') && !args.query) args.query = task;
    if (descLower.includes('analys') && !args.data) args.data = task;

    if (Object.keys(args).length === 0) {
      args.data = task;
      args.input = task;
    }

    return args;
  }

  static constructToolCall(task: string, response: string, availableTools: Tool[]): ToolCall | null {
    const intent = this.detectToolIntent(response, task, availableTools);
    if (!intent) return null;

    const args = this.inferArguments(response, task, intent.tool);

    return {
      id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: intent.tool.name,
      arguments: args,
    };
  }

  static generateFillableTemplate(tools: Tool[], task: string): string {
    if (tools.length === 0) return '';
    const tool = tools[0];
    const schema = tool.toJSONSchema();
    const properties = schema.properties || {};
    const template: Record<string, any> = {};

    for (const [name, prop] of Object.entries(properties) as [string, any][]) {
      if (prop.type === 'array') {
        template[name] = [];
      } else if (prop.type === 'object') {
        template[name] = {};
      } else if (prop.enum) {
        template[name] = prop.enum[0];
      } else if (prop.type === 'number') {
        template[name] = 0;
      } else if (prop.type === 'boolean') {
        template[name] = false;
      } else {
        template[name] = '...';
      }
    }

    return `\n\n📝 TEMPLATE:\n<tool_call>\n<name>${tool.name}</name>\n<arguments>${JSON.stringify(template)}</arguments>\n</tool_call>\nCOPY THIS.`;
  }

  static extractToolCallsWithFallback(response: string, task: string, availableTools: Tool[], nativeToolCalls?: ToolCall[]): ToolCall[] {
    if (!response && (!nativeToolCalls || nativeToolCalls.length === 0)) {
      return [];
    }

    if (nativeToolCalls && nativeToolCalls.length > 0) {
      return nativeToolCalls;
    }

    if (response.includes('<tool_call>')) {
      const { ToolCallParser } = require('../../protocol/ToolCallParser');
      const xmlCalls = ToolCallParser.parseXML(response);
      if (xmlCalls.length > 0) {
        return xmlCalls;
      }
    }

    if (response.includes('{') && response.includes('"name"')) {
      const { ToolCallParser } = require('../../protocol/ToolCallParser');
      const jsonCalls = ToolCallParser.parseJSON(response);
      if (jsonCalls.length > 0) {
        return jsonCalls;
      }
    }

    const autoCall = this.constructToolCall(task, response, availableTools);
    if (autoCall) {
      return [autoCall];
    }

    return [];
  }
}
