import type { ContentPart, ImagePart, AudioPart, FilePart, MediaType } from '../types/content';
import type { Tool } from '../types/tool';
import type { Message } from '../types/core';
import type { ToolContext } from '../types/tool';

/**
 * Media processing result
 */
interface MediaProcessingResult {
  mediaType: MediaType;
  tool: string;
  result: any;
  score: number;
}

/**
 * 🧠 GENIUS MEDIA PROCESSOR
 *
 * Intelligent media detection and processing pipeline with:
 * - Smart tool matching via scoring algorithm
 * - Parallel processing for multiple media
 * - Automatic context injection
 * - Zero user configuration
 */
export class MediaProcessor {
  constructor(private tools: Tool[]) {}

  /**
   * Main processing pipeline
   */
  async process(
    mediaParts: ContentPart[],
    context: ToolContext,
  ): Promise<{
    results: MediaProcessingResult[];
    summary: string;
  }> {
    const results: MediaProcessingResult[] = [];

    // Process all media in parallel for maximum performance
    const promises = mediaParts.map((part) => this.processSingleMedia(part, context));
    const settled = await Promise.allSettled(promises);

    // Collect successful results
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn('[MediaProcessor] Failed to process media:', result.reason);
      }
    }

    // Generate summary for context injection
    const summary = this.generateSummary(results);

    return { results, summary };
  }

  /**
   * Process a single media part
   */
  private async processSingleMedia(part: ContentPart, context: ToolContext): Promise<MediaProcessingResult | null> {
    const mediaType = this.getMediaType(part);
    if (!mediaType) return null;

    // 🎯 Smart tool selection with scoring
    const tool = this.selectBestTool(mediaType);
    if (!tool) {
      console.log(`[MediaProcessor] No tool found for ${mediaType}`);
      return null;
    }

    console.log(`[MediaProcessor] 🚀 Auto-processing ${mediaType} with tool: ${tool.name}`);

    try {
      // Extract media data based on type
      const args = this.extractMediaData(part);

      // Execute tool
      const result = await tool.run(args, context);

      return {
        mediaType,
        tool: tool.name,
        result,
        score: this.scoreToolForMedia(tool, mediaType),
      };
    } catch (error) {
      console.error(`[MediaProcessor] Tool execution failed for ${tool.name}:`, error);
      return null;
    }
  }

  /**
   * 🧠 GENIUS SCORING ALGORITHM
   *
   * Intelligently scores tools based on multiple factors:
   * - Exact media type match (highest priority)
   * - Name contains media type
   * - Description mentions media type
   * - User-defined priority boost
   */
  private scoreToolForMedia(tool: Tool, mediaType: MediaType): number {
    let score = 0;

    // 🎯 Direct `handles` match = PERFECT (100 points)
    if (tool.handles?.includes(mediaType)) {
      score += 100;
    }

    // 📝 Tool name contains media type (50 points)
    if (tool.name.toLowerCase().includes(mediaType)) {
      score += 50;
    }

    // 📋 Description mentions media type (25 points)
    if (tool.description.toLowerCase().includes(mediaType)) {
      score += 25;
    }

    // ⭐ User-defined priority boost
    if (tool.priority !== undefined) {
      score += tool.priority;
    }

    return score;
  }

  /**
   * Select best tool for media type
   */
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

    if (bestTool) {
      console.log(`[MediaProcessor] 🎯 Selected "${bestTool.name}" (score: ${bestScore}) for ${mediaType}`);
    }

    return bestTool;
  }

  /**
   * Extract media type from content part
   */
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

  /**
   * Extract media data for tool execution
   */
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

  /**
   * Generate summary for context injection
   */
  private generateSummary(results: MediaProcessingResult[]): string {
    if (results.length === 0) return '';

    const lines = results.map((r) => {
      const resultStr = typeof r.result === 'string' ? r.result : JSON.stringify(r.result);
      return `[${r.mediaType.toUpperCase()} Analysis by ${r.tool}]: ${resultStr}`;
    });

    return `🤖 Auto-processed ${results.length} media item(s):\n\n${lines.join('\n')}`;
  }
}
