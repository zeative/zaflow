/**
 * Multimodal content part types
 * Based on OpenAI's content format for maximum compatibility
 */

export type TextPart = {
  type: 'text';
  text: string;
};

export type ImagePart = {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
};

export type AudioPart = {
  type: 'audio';
  audio: {
    data: string; // base64 encoded
    format?: 'mp3' | 'wav' | 'ogg';
  };
};

export type FilePart = {
  type: 'file';
  file: {
    data: string; // base64 encoded
    mimeType: string;
    filename?: string;
  };
};

/**
 * Union of all content part types
 */
export type ContentPart = TextPart | ImagePart | AudioPart | FilePart;

/**
 * Media types that tools can handle
 */
export type MediaType = 'image' | 'audio' | 'file' | 'video';

/**
 * Extract text content from message content
 */
export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;

  return content
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join(' ');
}

/**
 * Extract media parts from message content
 */
export function extractMediaParts(content: string | ContentPart[]): ContentPart[] {
  if (typeof content === 'string') return [];

  return content.filter((part) => part.type !== 'text');
}

/**
 * Check if content contains media
 */
export function hasMedia(content: string | ContentPart[]): boolean {
  if (typeof content === 'string') return false;
  return content.some((part) => part.type !== 'text');
}
