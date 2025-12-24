import { ToolCall } from '../types/provider';
import { ToolParser } from '../core/parsing/ToolParser';
import { nanoid } from 'nanoid';

export class ToolCallParser {
  static parse(content: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // 1. XML Parsing (Simplified Sync)
    const xmlRegex = /<tool_call[^>]*>(.*?)<\/tool_call>/gs;
    const xmlMatches = content.matchAll(xmlRegex);
    for (const match of xmlMatches) {
        // ... (existing XML logic adapted)
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
            } catch (e) {}
        }

        if (name) {
             if (Object.keys(args).length === 0) {
                const argsMatch = /<(?:arguments|args)>(.*?)<\/(?:arguments|args)>/s.exec(toolContent);
                const argsStr = argsMatch ? argsMatch[1].trim() : '{}';
                try {
                    if (argsStr && argsStr !== '{}') {
                        const cleanJson = argsStr.replace(/```json\s*|\s*```/g, '').trim();
                        args = JSON.parse(cleanJson);
                    }
                } catch (e) {}
             }
             toolCalls.push({ id: nanoid(), name, arguments: args });
        }
    }

    // 2. JSON Parsing
    if (toolCalls.length === 0) {
        try {
            const jsonMatch = /```json\s*([\s\S]*?)\s*```/.exec(content);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                if (Array.isArray(parsed)) {
                    parsed.forEach(p => toolCalls.push({ id: nanoid(), name: p.name, arguments: p.arguments || p.args || {} }));
                } else if (parsed.name) {
                    toolCalls.push({ id: nanoid(), name: parsed.name, arguments: parsed.arguments || parsed.args || {} });
                }
            }
        } catch (e) {}
    }

    // 3. Regex / Token Parsing (New)
    if (toolCalls.length === 0) {
         // Pattern 1: Tool: [name] Params: [json]
        const pattern1 = /Tool:\s*([a-zA-Z0-9_]+)\s*Params:\s*(\{.*?\})/g;
        let match;
        while ((match = pattern1.exec(content)) !== null) {
            try {
                console.log('[ToolCallParser] Matched Pattern 1:', match[1]);
                toolCalls.push({ id: nanoid(), name: match[1], arguments: JSON.parse(match[2]) });
            } catch (e) {}
        }

        // Pattern 2: Token-based
        const pattern2 = /to=([a-zA-Z0-9_#-]+).*?<\|message\|>(\{.*?\})<\|call\|>/g;
        while ((match = pattern2.exec(content)) !== null) {
            try {
                console.log('[ToolCallParser] Matched Pattern 2:', match[1]);
                toolCalls.push({ id: nanoid(), name: match[1], arguments: JSON.parse(match[2]) });
            } catch (e) {
                console.error('[ToolCallParser] Failed to parse Pattern 2 arguments:', e);
            }
        }
    }

    return toolCalls;
  }

  static hasToolCalls(content: string): boolean {
    if (!content) return false;
    return content.includes('<tool_call>') || 
           (content.includes('{') && content.includes('"name"')) ||
           content.includes('to=') || 
           content.includes('<|start|>');
  }
}
