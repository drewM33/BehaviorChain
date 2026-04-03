import type { AgentSignals } from './types.js';

/**
 * In-memory ring buffer that tracks the last N signal snapshots per agent.
 * Used to compute drift signals by comparing current signals against history.
 */
export class AgentHistoryTracker {
  private history = new Map<string, AgentSignals[]>();
  private maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  getLatest(agentId: string): AgentSignals | undefined {
    const entries = this.history.get(agentId);
    return entries?.[entries.length - 1];
  }

  getHistory(agentId: string): AgentSignals[] {
    return this.history.get(agentId) ?? [];
  }

  push(agentId: string, signals: AgentSignals): void {
    let entries = this.history.get(agentId);
    if (!entries) {
      entries = [];
      this.history.set(agentId, entries);
    }
    entries.push(signals);
    if (entries.length > this.maxEntries) {
      entries.shift();
    }
  }

  /**
   * Returns the number of entries in the recent window that have scores
   * at or below the given threshold.
   */
  countRecentLowScores(
    agentId: string,
    threshold: number,
    windowSize: number,
  ): number {
    const entries = this.history.get(agentId);
    if (!entries) return 0;
    const window = entries.slice(-windowSize);
    return window.filter((s) => s.score <= threshold).length;
  }

  has(agentId: string): boolean {
    const entries = this.history.get(agentId);
    return entries !== undefined && entries.length > 0;
  }

  clear(): void {
    this.history.clear();
  }
}
