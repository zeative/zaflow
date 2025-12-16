import type { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema
 * Simplified converter for basic types
 */
export function zodToJsonSchema(schema: z.ZodSchema): any {
  const zodType = (schema as any)._def.typeName;

  // Handle different Zod types
  switch (zodType) {
    case 'ZodString':
      return { type: 'string', description: (schema as any)._def.description };

    case 'ZodNumber':
      return { type: 'number', description: (schema as any)._def.description };

    case 'ZodBoolean':
      return { type: 'boolean', description: (schema as any)._def.description };

    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema((schema as any)._def.type),
        description: (schema as any)._def.description,
      };

    case 'ZodObject':
      const shape = (schema as any)._def.shape();
      const properties: any = {};
      const required: string[] = [];

      for (const key in shape) {
        properties[key] = zodToJsonSchema(shape[key]);

        // Check if field is optional
        if (shape[key]._def.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        description: (schema as any)._def.description,
      };

    case 'ZodEnum':
      return {
        type: 'string',
        enum: (schema as any)._def.values,
        description: (schema as any)._def.description,
      };

    case 'ZodOptional':
      return zodToJsonSchema((schema as any)._def.innerType);

    case 'ZodDefault':
      const innerSchema = zodToJsonSchema((schema as any)._def.innerType);
      return {
        ...innerSchema,
        default: (schema as any)._def.defaultValue(),
      };

    case 'ZodUnion':
      return {
        oneOf: (schema as any)._def.options.map((opt: any) => zodToJsonSchema(opt)),
        description: (schema as any)._def.description,
      };

    default:
      return { type: 'string', description: 'Unknown type' };
  }
}

/**
 * Convert JSON Schema to XML tool format (for compact representation)
 */
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
