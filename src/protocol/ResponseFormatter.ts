import type { Tool } from '../types/tool';

/**
 * Format tools for different providers
 */
export class ResponseFormatter {
  /**
   * Format tools as XML (compact format for models without native tool calling)
   */
  static formatToolsAsXML(tools: Tool[]): string {
    let xml = '<tools>\n';

    for (const tool of tools) {
      const schema = tool.toJSONSchema();
      const params = schema.properties || {};
      const required = schema.required || [];

      xml += `  <tool name="${tool.name}" description="${tool.description}">\n`;

      for (const [paramName, paramSchema] of Object.entries(params) as [string, any][]) {
        const isRequired = required.includes(paramName);
        const typeInfo = this.formatParamType(paramSchema);
        const desc = paramSchema.description || '';

        xml += `    <param name="${paramName}" type="${typeInfo}" required="${isRequired}" desc="${desc}"/>\n`;
      }

      xml += `  </tool>\n`;
    }

    xml += '</tools>';

    return xml;
  }

  /**
   * Helper to format parameter type information recursively
   */
  private static formatParamType(schema: any): string {
    if (!schema) return 'any';

    if (schema.enum) {
      return `enum(${schema.enum.join('|')})`;
    }

    if (schema.type === 'array') {
      const itemType = this.formatParamType(schema.items);
      return `array(${itemType})`;
    }

    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([name, s]) => `${name}:${this.formatParamType(s)}`)
        .join(', ');
      return `object({${props}})`;
    }

    return schema.type || 'any';
  }

  /**
   * Format tools as JSON (for native tool calling)
   */
  static formatToolsAsJSON(tools: Tool[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.toJSONSchema(),
      },
    }));
  }

  /**
   * Generate tool calling instructions for system prompt
   */
  static generateToolInstructions(tools: Tool[], format: 'xml' | 'json' = 'xml'): string {
    if (format === 'xml') {
      return `You have access to the following tools:

${this.formatToolsAsXML(tools)}

To use a tool, respond with:
<tool_call>
<name>tool_name</name>
<arguments>
{"param1": "value1", "param2": "value2"}
</arguments>
</tool_call>

You can make multiple tool calls by using multiple <tool_call> blocks.
After receiving tool results, synthesize them into a final response for the user.`;
    } else {
      return `You have access to the following tools. Use them when needed to help answer the user's question.`;
    }
  }
}
