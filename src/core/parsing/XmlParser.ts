import { xml2js } from 'xml-js';
import { nanoid } from 'nanoid';
import { ToolCall } from '../../types/provider';
import { ParserResult } from './ToolParser';

export class XmlParser {
  async parse(input: string): Promise<ParserResult> {
    try {
      const toolCalls: ToolCall[] = [];
      
      // Simple regex to extract <tool_call>...</tool_call> blocks first to avoid noise
      const xmlBlockRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
      let match;
      
      while ((match = xmlBlockRegex.exec(input)) !== null) {
        const xmlContent = match[0];
        try {
            const parsed: any = xml2js(xmlContent, { compact: true, ignoreComment: true, trim: true });
            
            if (parsed.tool_call) {
                const name = parsed.tool_call.name?._text || parsed.tool_call.name;
                let params = parsed.tool_call.params?._text || parsed.tool_call.params;
                
                // If params is a string (JSON), try to parse it
                if (typeof params === 'string') {
                    try {
                        params = JSON.parse(params);
                    } catch (e) {
                        // Keep as string or handle error
                    }
                }

                if (name) {
                    toolCalls.push({
                        id: nanoid(),
                        name,
                        arguments: params || {}
                    });
                }
            }
        } catch (e) {
            // Ignore malformed XML
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
        error: error instanceof Error ? error.message : 'Unknown error in XmlParser',
      };
    }
  }
}
