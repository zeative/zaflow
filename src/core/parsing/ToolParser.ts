import { nanoid } from 'nanoid';
import { ToolCall } from '../../types/provider';
import { StructuredParser } from './StructuredParser';
import { XmlParser } from './XmlParser';
import { RegexParser } from './RegexParser';

export interface ParserResult {
  toolCalls: ToolCall[];
  success: boolean;
  error?: string;
}

export class ToolParser {
  private structuredParser: StructuredParser;
  private xmlParser: XmlParser;
  private regexParser: RegexParser;

  constructor() {
    this.structuredParser = new StructuredParser();
    this.xmlParser = new XmlParser();
    this.regexParser = new RegexParser();
  }

  async parse(input: string): Promise<ParserResult> {
    // 1. Try Structured JSON Parser
    const structuredResult = await this.structuredParser.parse(input);
    if (structuredResult.success && structuredResult.toolCalls.length > 0) {
      return structuredResult;
    }

    // 2. Try XML Parser
    const xmlResult = await this.xmlParser.parse(input);
    if (xmlResult.success && xmlResult.toolCalls.length > 0) {
      return xmlResult;
    }

    // 3. Try Regex Parser (Fallback)
    const regexResult = await this.regexParser.parse(input);
    if (regexResult.success && regexResult.toolCalls.length > 0) {
      return regexResult;
    }

    return {
      toolCalls: [],
      success: false,
      error: 'Failed to parse tool calls using all available parsers.',
    };
  }
}
