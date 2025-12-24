import type { z } from 'zod';

export function validate<T extends z.ZodSchema>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

export function safeValidate<T extends z.ZodSchema>(schema: T, data: unknown): z.infer<T> | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

export function validateWithErrors<T extends z.ZodSchema>(schema: T, data: unknown): { success: true; data: z.infer<T> } | { success: false; errors: any[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues,
  };
}
