import type { ContentPart, ImagePart, AudioPart, FilePart, MediaType } from '../../types/content';
import type { Tool } from '../../types/tool';
import type { ToolContext } from '../../types/tool';

interface MediaProcessingResult {
  mediaType: MediaType;
  tool: string;
  result: any;
  score: number;
}

export class MediaProcessor {
  constructor(private tools: Tool[]) {}

  async process(
    mediaParts: ContentPart[],
    context: ToolContext,
  ): Promise<{
    results: MediaProcessingResult[];
    summary: string;
  }> {
    const results: MediaProcessingResult[] = [];

    const promises = mediaParts.map((part) => this.processSingleMedia(part, context));
    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn('[MediaProcessor] Failed to process media:', result.reason);
      }
    }

    const summary = this.generateSummary(results);

    return { results, summary };
  }

  private async processSingleMedia(part: ContentPart, context: ToolContext): Promise<MediaProcessingResult | null> {
    const mediaType = this.getMediaType(part);
    if (!mediaType) return null;

    const tool = this.selectBestTool(mediaType);
    if (!tool) {
      return null;
    }

    try {
      const args = this.extractMediaData(part);
      const result = await tool.run(args, context);

      return {
        mediaType,
        tool: tool.name,
        result,
        score: this.scoreToolForMedia(tool, mediaType),
      };
    } catch (error) {
      return null;
    }
  }

  private scoreToolForMedia(tool: Tool, mediaType: MediaType): number {
    let score = 0;

    if (tool.handles?.includes(mediaType)) {
      score += 100;
    }

    if (tool.name.toLowerCase().includes(mediaType)) {
      score += 50;
    }

    if (tool.description.toLowerCase().includes(mediaType)) {
      score += 25;
    }

    if (tool.priority !== undefined) {
      score += tool.priority;
    }

    return score;
  }

  private selectBestTool(mediaType: MediaType): Tool | null {
    let bestTool: Tool | null = null;
    let bestScore = 0;

    for (const tool of this.tools) {
      const score = this.scoreToolForMedia(tool, mediaType);

      if (score > bestScore) {
        bestScore = score;
        bestTool = tool;
      }
    }

    return bestTool;
  }

  private getMediaType(part: ContentPart): MediaType | null {
    switch (part.type) {
      case 'image_url':
        return 'image';
      case 'audio':
        return 'audio';
      case 'file':
        return 'file';
      default:
        return null;
    }
  }

  private extractMediaData(part: ContentPart): any {
    switch (part.type) {
      case 'image_url':
        return { url: (part as ImagePart).image_url.url };
      case 'audio':
        return { data: (part as AudioPart).audio.data, format: (part as AudioPart).audio.format };
      case 'file':
        const filePart = part as FilePart;
        return { data: filePart.file.data, mimeType: filePart.file.mimeType, filename: filePart.file.filename };
      default:
        return {};
    }
  }

  private generateSummary(results: MediaProcessingResult[]): string {
    if (results.length === 0) return '';

    const lines = results.map((r) => {
      const resultStr = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
      return `[${r.mediaType.toUpperCase()} Analysis by ${r.tool}]: ${resultStr}`;
    });

    return `🤖 Auto-processed ${results.length} media item(s):\n\n${lines.join('\n')}`;
  }
}
