type MediaType = 'image' | 'audio' | 'file';

type MediaEntry = {
  data: string;
  type: MediaType;
  mime?: string;
  size: number;
  createdAt: number;
};

const PREFIX = 'media_';

class MediaRegistry {
  private store = new Map<string, MediaEntry>();
  private counter = 0;

  register(data: string, type: MediaType, mime?: string): string {
    const id = `${PREFIX}${(++this.counter).toString(36)}_${Date.now().toString(36)}`;
    this.store.set(id, { data, type, mime, size: data.length, createdAt: Date.now() });
    return id;
  }

  get(id: string): MediaEntry | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  remove(id: string): boolean {
    return this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
    this.counter = 0;
  }

  getStats(): { count: number; totalSize: number } {
    let totalSize = 0;
    for (const entry of this.store.values()) totalSize += entry.size;
    return { count: this.store.size, totalSize };
  }

  isRef(value: string): boolean {
    return value.startsWith(PREFIX);
  }

  resolveUrl(idOrUrl: string): string | undefined {
    if (!this.isRef(idOrUrl)) return idOrUrl;
    const entry = this.store.get(idOrUrl);
    return entry?.data;
  }
}

export const mediaRegistry = new MediaRegistry();

export const createMediaRef = (data: string, type: MediaType, mime?: string): string => {
  return mediaRegistry.register(data, type, mime);
};

export const resolveMediaRef = (ref: string): MediaEntry | undefined => {
  return mediaRegistry.get(ref);
};

export const isMediaRef = (value: string): boolean => {
  return mediaRegistry.isRef(value);
};
