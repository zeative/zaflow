import { jsonrepair } from 'jsonrepair';
import { nanoid } from 'nanoid';
import { ToolCall } from '../../types/provider';
import { ParserResult } from './ToolParser';

export class StructuredParser {
  async parse(input: string): Promise<ParserResult> {
    try {
      // Extract JSON blocks
      const jsonBlocks = this.extractJsonBlocks(input);
      const toolCalls: ToolCall[] = [];

      for (const block of jsonBlocks) {
        try {
          const repaired = jsonrepair(block);
          const parsed = JSON.parse(repaired);

          if (this.isValidToolCall(parsed)) {
            toolCalls.push(this.normalizeToolCall(parsed));
          } else if (Array.isArray(parsed)) {
             parsed.forEach(item => {
                 if(this.isValidToolCall(item)) {
                     toolCalls.push(this.normalizeToolCall(item));
                 }
             })
          }
        } catch (e) {
          // Ignore invalid JSON blocks
        }
      }

      return {
        toolCalls,
        success: toolCalls.length > 0,
      };
    } catch (error) {
       return {
        toolCalls: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in StructuredParser',
      };
    }
  }

  private extractJsonBlocks(input: string): string[] {
    const regex = /```json\s*([\s\S]*?)\s*```/g;
    const matches = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
      matches.push(match[1]);
    }
    
    // Also try to find raw JSON objects if no markdown blocks
    if (matches.length === 0) {
        const rawJsonRegex = /\{[\s\S]*?\}/g;
        let rawMatch;
         while ((rawMatch = rawJsonRegex.exec(input)) !== null) {
            matches.push(rawMatch[0]);
        }
    }

    return matches;
  }

  private isValidToolCall(obj: any): boolean {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      (typeof obj.name === 'string' || typeof obj.tool === 'string') &&
      (typeof obj.params === 'object' || typeof obj.arguments === 'object')
    );
  }

  private normalizeToolCall(obj: any): ToolCall {
      return {
          id: obj.id || nanoid(),
          name: obj.name || obj.tool,
          arguments: obj.params || obj.arguments || {}
      };
  }
}
