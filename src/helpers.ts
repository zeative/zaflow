import type { ContentPart, ImagePart, Message, TextPart } from './types';

export const text = (t: string): TextPart => ({ type: 'text', text: t });

export const image = (url: string, detail?: 'auto' | 'low' | 'high'): ImagePart => ({
  type: 'image_url',
  image_url: { url, detail },
});

export const imageBase64 = (base64: string, mimeType = 'image/png'): ImagePart => ({
  type: 'image_url',
  image_url: { url: `data:${mimeType};base64,${base64}` },
});

export const msg = {
  user: (content: string | ContentPart[]): Message => ({ role: 'user', content }),
  system: (content: string): Message => ({ role: 'system', content }),
  assistant: (content: string): Message => ({ role: 'assistant', content }),
};

export const getTextContent = (content: string | ContentPart[]): string => {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join(' ');
};

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
