import { nanoid } from 'nanoid';
import { ToolCall } from '../../types/provider';
import { ParserResult } from './ToolParser';

export class RegexParser {
  async parse(input: string): Promise<ParserResult> {
    const toolCalls: ToolCall[] = [];
    
    // Pattern: Tool: [name] Params: [json]
    const pattern1 = /Tool:\s*([a-zA-Z0-9_]+)\s*Params:\s*(\{.*?\})/g;
    
    let match;
    while ((match = pattern1.exec(input)) !== null) {
        try {
            const name = match[1];
            const paramsStr = match[2];
            const params = JSON.parse(paramsStr);
            toolCalls.push({ 
                id: nanoid(),
                name, 
                arguments: params 
            });
        } catch (e) {
            // Ignore
        }
    }

    // Pattern 2: Token-based format (e.g. <|start|>assistant<|channel|>commentary to=tool_name <|constrain|>json<|message|>{"key":"value"}<|call|>)
    // Regex: to=([a-zA-Z0-9_#-]+).*?<\|message\|>(\{.*?\})<\|call\|>
    const pattern2 = /to=([a-zA-Z0-9_#-]+).*?<\|message\|>(\{.*?\})<\|call\|>/g;

    while ((match = pattern2.exec(input)) !== null) {
        try {
            const name = match[1];
            const paramsStr = match[2];
            const params = JSON.parse(paramsStr);
            toolCalls.push({ 
                id: nanoid(),
                name, 
                arguments: params 
            });
        } catch (e) {
            // Ignore
        }
    }

    return {
      toolCalls,
      success: toolCalls.length > 0,
    };
  }
}
