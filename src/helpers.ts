import type { ContentPart, ImagePart, Message, TextPart } from './types';
import { createMediaRef, isMediaRef, resolveMediaRef } from './core/media';

export const text = (t: string): TextPart => ({ type: 'text', text: t });

export const image = (url: string, detail?: 'auto' | 'low' | 'high'): ImagePart => {
  const isBase64 = url.startsWith('data:');
  const ref = isBase64 ? createMediaRef(url, 'image') : url;
  return { type: 'image_url', image_url: { url: ref, detail } };
};

export const imageBase64 = (base64: string, mimeType = 'image/png'): ImagePart => {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const ref = createMediaRef(dataUrl, 'image', mimeType);
  return { type: 'image_url', image_url: { url: ref } };
};

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

export const resolveImageUrl = (urlOrRef: string): string => {
  if (!isMediaRef(urlOrRef)) return urlOrRef;
  const entry = resolveMediaRef(urlOrRef);
  return entry?.data ?? urlOrRef;
};

export const stripMediaFromMessages = (messages: Message[]): Message[] => {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const filtered = m.content.filter((p) => {
      if (p.type === 'image_url') return false;
      if (p.type === 'audio') return false;
      if (p.type === 'file') return false;
      return true;
    });
    if (!filtered.length) return { ...m, content: '[Media content]' };
    return { ...m, content: filtered };
  });
};

export const resolveMediaInMessages = (messages: Message[]): Message[] => {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const resolved = m.content.map((p) => {
      if (p.type === 'image_url' && isMediaRef(p.image_url.url)) {
        const data = resolveImageUrl(p.image_url.url);
        return { ...p, image_url: { ...p.image_url, url: data } };
      }
      return p;
    });
    return { ...m, content: resolved };
  });
};
