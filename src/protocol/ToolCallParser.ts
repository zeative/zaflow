import type { ToolCall } from '../types/provider';

export class ToolCallParser {
  static parseXML(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    const regex = /<tool_call[^>]*>(.*?)<\/tool_call>/gs;
    const matches = content.matchAll(regex);

    for (const match of matches) {
      const toolContent = match[1];

      const nameMatch = /<(?:name|tool_name|tool)>(.*?)<\/(?:name|tool_name|tool)>/.exec(toolContent);
      let name = nameMatch ? nameMatch[1].trim() : '';
      let args = {};

      if (!name) {
        try {
          const cleanJson = toolContent.replace(/```json\s*|\s*```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.name) {
            name = parsed.name;
            args = parsed.arguments || parsed.args || {};
          }
        } catch (e) {
          if (!toolContent.includes('<')) {
            name = toolContent.trim();
          }
        }
      }

      if (!name) continue;

      if (Object.keys(args).length === 0) {
        const argsMatch = /<(?:arguments|args)>(.*?)<\/(?:arguments|args)>/s.exec(toolContent);
        const argsStr = argsMatch ? argsMatch[1].trim() : '{}';

        try {
          if (argsStr && argsStr !== '{}') {
            const cleanJson = argsStr.replace(/```json\s*|\s*```/g, '').trim();
            args = JSON.parse(cleanJson);
          }
        } catch (error) {
          console.warn('[ToolCallParser] Failed to parse tool arguments, using empty object:', argsStr);
        }
      }
        
        toolCalls.push({
          id: `toolcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          arguments: args,
        });
    }

    return toolCalls;
  }

  static parseJSON(content: string): ToolCall[] {
    try {
      const jsonMatch = /```json\s*([\s\S]*?)\s*```/.exec(content);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        return parsed.map((call) => ({
          id: call.id || `toolcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: call.name,
          arguments: call.arguments || call.args || {},
        }));
      }

      if (parsed.name) {
        return [
          {
            id: parsed.id || `toolcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: parsed.name,
            arguments: parsed.arguments || parsed.args || {},
          },
        ];
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  static parseRawFormat(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    // Format: <|start|>assistant<|channel|>commentary to=functions.TOOL_NAME <|constrain|>json<|message|>ARGUMENTS<|call|>
    const regex = /to=functions\.([^\s]+)\s+<\|constrain\|>json<\|message\|>(.*?)<\|call\|>/g;
    const matches = content.matchAll(regex);

    for (const match of matches) {
      const name = match[1];
      const argsStr = match[2];

      try {
        const args = JSON.parse(argsStr);
        toolCalls.push({
          id: `toolcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          arguments: args,
        });
      } catch (e) {
        console.warn('[ToolCallParser] Failed to parse raw tool arguments:', argsStr);
      }
    }

    return toolCalls;
  }

  static parse(content: string): ToolCall[] {
    if (!content) return [];

    if (content.includes('<tool_call>')) {
      const xmlCalls = this.parseXML(content);
      if (xmlCalls.length > 0) {
        return xmlCalls;
      }
    }

    if (content.includes('{') && (content.includes('"name"') || content.includes('```json'))) {
      const jsonCalls = this.parseJSON(content);
      if (jsonCalls.length > 0) {
        return jsonCalls;
      }
    }

    // Check for raw format
    if (content.includes('to=functions.')) {
      const rawCalls = this.parseRawFormat(content);
      if (rawCalls.length > 0) {
        return rawCalls;
      }
    }

    return [];
  }

  static hasToolCalls(content: string): boolean {
    if (!content) return false;
    return content.includes('<tool_call>') || (content.includes('{') && content.includes('"name"'));
  }
}
