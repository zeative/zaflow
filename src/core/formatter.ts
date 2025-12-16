export type OutputFormat = 'auto' | 'json' | 'whatsapp';

const toWhatsApp = (text: string): string => {
  let result = text

    .replace(/\*\*\*/g, '*')
    .replace(/\*\*/g, '*')
    .replace(/\-\-\-\n\n/g, '')
    .replace(/\#\#\#/g, '#')
    .replace(/\#\#/g, '> ')
    .replace(/→/g, '⇒')
    .replace(/!\[[^\]]*?\]\(.*?\)/gs, '')
    .trim();

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
  return formatters[format](text)?.trim();
};
