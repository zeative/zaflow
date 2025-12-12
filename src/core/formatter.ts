export type OutputFormat = 'auto' | 'json' | 'whatsapp';

const toWhatsApp = (text: string): string => {
  let result = text;

  result = result.replace(/```[\s\S]*?```/g, (m) => `\x00${m}\x00`);
  result = result.replace(/`([^`]+)`/g, (_, c) => `\x01${c}\x01`);

  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
  result = result.replace(/~~(.+?)~~/g, '~$1~');

  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  result = result.replace(/^\s*[-*+]\s+/gm, '• ');
  result = result.replace(/^\s*\d+\.\s+/gm, '• ');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  result = result.replace(/\x01([^\x01]+)\x01/g, '```$1```');
  result = result.replace(/\x00/g, '');

  return result;
};

const toJSON = (text: string): string => {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed);
  } catch {
    return JSON.stringify({ content: text });
  }
};

const formatters: Record<OutputFormat, (text: string) => string> = {
  auto: (t) => t,
  json: toJSON,
  whatsapp: toWhatsApp,
};

export const formatOutput = (text: string, format: OutputFormat = 'auto'): string => {
  if (!text) return text;
  return formatters[format](text);
};
