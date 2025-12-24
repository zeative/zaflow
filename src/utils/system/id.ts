import { nanoid } from 'nanoid';

export function generateId(prefix?: string): string {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateToolCallId(): string {
  return generateId('tool');
}

export function generateExecutionId(): string {
  return generateId('exec');
}
