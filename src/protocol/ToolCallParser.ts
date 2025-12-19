import type { ToolCall } from '../types/provider';

/**
 * Parse tool calls from various formats
 */
export class ToolCallParser {
  /**
   * Parse XML tool calls
   */
  static parseXML(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Match <tool_call> tags
    const regex = /<tool_call[^>]*>(.*?)<\/tool_call>/gs;
    const matches = content.matchAll(regex);

    for (const match of matches) {
      const toolContent = match[1];

      // Extract name (handle <name>, <tool_name>, or <tool>)
      const nameMatch = /<(?:name|tool_name|tool)>(.*?)<\/(?:name|tool_name|tool)>/.exec(toolContent);
      let name = nameMatch ? nameMatch[1].trim() : '';
      let args = {};

      // If no name tag found, try to parse as JSON or treat as plain text
      if (!name) {
        try {
          // Try to parse the whole content as JSON
          const cleanJson = toolContent.replace(/```json\s*|\s*```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed.name) {
            name = parsed.name;
            args = parsed.arguments || parsed.args || {};
          }
        } catch (e) {
          // Not JSON, treat as plain text if no other tags present
          if (!toolContent.includes('<')) {
            name = toolContent.trim();
          }
        }
      }

      if (!name) continue;

      // Extract arguments if not already parsed from JSON
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

  /**
   * Parse JSON tool calls
   */
  static parseJSON(content: string): ToolCall[] {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = /```json\s*([\s\S]*?)\s*```/.exec(content);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr);

      // Handle array of tool calls
      if (Array.isArray(parsed)) {
        return parsed.map((call) => ({
          id: call.id || `toolcall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: call.name,
          arguments: call.arguments || call.args || {},
        }));
      }

      // Handle single tool call
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

  /**
   * Auto-detect and parse tool calls
   */
  static parse(content: string): ToolCall[] {
    // Try XML first
    if (content.includes('<tool_call>')) {
      const xmlCalls = this.parseXML(content);
      if (xmlCalls.length > 0) {
        return xmlCalls;
      }
    }

    // Try JSON
    if (content.includes('{') && (content.includes('"name"') || content.includes('```json'))) {
      const jsonCalls = this.parseJSON(content);
      if (jsonCalls.length > 0) {
        return jsonCalls;
      }
    }

    return [];
  }

  /**
   * Check if content contains tool calls
   */
  static hasToolCalls(content: string): boolean {
    return content.includes('<tool_call>') || (content.includes('{') && content.includes('"name"'));
  }
}
