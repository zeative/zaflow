import { z } from 'zod';

export function zodToJsonSchema(schema: z.ZodSchema) {
  const schemas = z.toJSONSchema(schema);
  delete schemas.$schema;
  return schemas;
}

export function jsonSchemaToXML(name: string, description: string, schema: any): string {
  const params = schema.properties || {};
  const required = schema.required || [];

  let xml = `<tool name="${name}" desc="${description}">\n`;

  for (const [paramName, paramSchema] of Object.entries(params) as [string, any][]) {
    const isRequired = required.includes(paramName);
    const type = paramSchema.type || 'string';
    const desc = paramSchema.description || '';

    xml += `  <param name="${paramName}" type="${type}" required="${isRequired}" desc="${desc}"/>\n`;
  }

  xml += '</tool>';

  return xml;
}
