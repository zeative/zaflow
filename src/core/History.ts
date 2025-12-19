import type { HistoryConfig, Message } from '../types/core';

/**
 * 🧠 HistoryManager
 * Manages conversation history with intelligent truncation and strategies.
 */
export class HistoryManager {
  private history: Message[] = [];
  private config: HistoryConfig;

  constructor(config: HistoryConfig = {}) {
    this.config = {
      maxMessages: 20,
      strategy: 'sliding',
      keepSystemMessage: true,
      ...config,
    };
  }

  /**
   * Add a message to history
   */
  addMessage(message: Message): void {
    this.history.push(message);
    this.applyStrategy();
  }

  /**
   * Get all messages in history
   */
  getHistory(): Message[] {
    return [...this.history];
  }

  /**
   * Load history from an array
   */
  loadHistory(history: Message[]): void {
    this.history = [...history];
    this.applyStrategy();
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Apply history management strategy (e.g., sliding window)
   */
  private applyStrategy(): void {
    if (this.config.strategy === 'sliding' && this.config.maxMessages) {
      if (this.history.length > this.config.maxMessages) {
        // Find system message if we need to keep it
        let systemMessage: Message | undefined;
        if (this.config.keepSystemMessage) {
          systemMessage = this.history.find(m => m.role === 'system');
        }

        // Truncate
        const excess = this.history.length - this.config.maxMessages;
        this.history = this.history.slice(excess);

        // Re-insert system message if it was lost and we need to keep it
        if (this.config.keepSystemMessage && systemMessage && !this.history.includes(systemMessage)) {
          // Remove the first message to make room for system message if we are at limit
          if (this.history.length >= this.config.maxMessages) {
            this.history.shift();
          }
          this.history.unshift(systemMessage);
        }
      }
    }
    // TODO: Implement 'summarize' and 'hybrid' strategies in the future
  }
}
