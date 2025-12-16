import { nanoid } from 'nanoid';

/**
 * Generate a unique ID
 */
export function generateId(prefix?: string): string {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a tool call ID
 */
export function generateToolCallId(): string {
  return generateId('tool');
}

/**
 * Generate an execution ID
 */
export function generateExecutionId(): string {
  return generateId('exec');
}
