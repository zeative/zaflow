import type { HistoryConfig, Message } from '../../types/core';

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

  addMessage(message: Message): void {
    this.history.push(message);
    this.applyStrategy();
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  loadHistory(history: Message[]): void {
    this.history = [...history];
    this.applyStrategy();
  }

  clear(): void {
    this.history = [];
  }

  private applyStrategy(): void {
    if (this.config.strategy === 'sliding' && this.config.maxMessages) {
      if (this.history.length > this.config.maxMessages) {
        let systemMessage: Message | undefined;
        if (this.config.keepSystemMessage) {
          systemMessage = this.history.find(m => m.role === 'system');
        }

        const excess = this.history.length - this.config.maxMessages;
        this.history = this.history.slice(excess);

        if (this.config.keepSystemMessage && systemMessage && !this.history.includes(systemMessage)) {
          if (this.history.length >= this.config.maxMessages) {
            this.history.shift();
          }
          this.history.unshift(systemMessage);
        }
      }
    }
  }
}
