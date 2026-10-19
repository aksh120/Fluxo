/**
 * AutopilotAuditStore.ts
 * Local transition quality audit logging and user preference feedback store.
 * Records executed transitions, fallback frequencies, duration drift, and user ratings.
 */

import type { TransitionAuditEntry, TransitionUserFeedback } from './AutopilotTypes';

const STORAGE_KEY = 'fluxo_autopilot_audit_v1';
const MAX_STORED_ENTRIES = 200;

export interface AuditAggregateMetrics {
  totalTransitions: number;
  fallbackCount: number;
  fallbackPercentage: number;
  stemCount: number;
  stemPercentage: number;
  averageConfidence: number;
  feedbackStats: {
    good: number;
    bad: number;
    too_fast: number;
    vocals_clashed: number;
    wrong_energy: number;
  };
}

export class AutopilotAuditStore {
  private entries: TransitionAuditEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load Autopilot audit logs from storage:', err);
    }
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.entries.slice(0, MAX_STORED_ENTRIES))
      );
    } catch (err) {
      console.warn('Failed to persist Autopilot audit logs to storage:', err);
    }
  }

  /**
   * Records a newly executed transition.
   */
  public recordTransition(
    entry: Omit<TransitionAuditEntry, 'id' | 'timestamp'>
  ): TransitionAuditEntry {
    const fullEntry: TransitionAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };

    this.entries.unshift(fullEntry);
    if (this.entries.length > MAX_STORED_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_STORED_ENTRIES);
    }
    this.persistToStorage();
    return fullEntry;
  }

  /**
   * Applies user feedback (Good, Bad, Too Fast, Vocals Clashed, Wrong Energy) to a transition.
   */
  public submitFeedback(transitionId: string, feedback: TransitionUserFeedback): boolean {
    const found = this.entries.find((e) => e.id === transitionId);
    if (found) {
      found.userFeedback = feedback;
      this.persistToStorage();
      return true;
    }
    // Also support submitting feedback to the most recent transition if ID not matched
    if (this.entries.length > 0 && !transitionId) {
      this.entries[0].userFeedback = feedback;
      this.persistToStorage();
      return true;
    }
    return false;
  }

  /**
   * Retrieves all recorded audit entries up to limit.
   */
  public getAuditHistory(limit: number = 50): TransitionAuditEntry[] {
    return this.entries.slice(0, limit);
  }

  /**
   * Computes aggregate metrics across recorded transitions.
   */
  public getMetrics(): AuditAggregateMetrics {
    const total = this.entries.length;
    if (total === 0) {
      return {
        totalTransitions: 0,
        fallbackCount: 0,
        fallbackPercentage: 0,
        stemCount: 0,
        stemPercentage: 0,
        averageConfidence: 0,
        feedbackStats: { good: 0, bad: 0, too_fast: 0, vocals_clashed: 0, wrong_energy: 0 }
      };
    }

    let fallbacks = 0;
    let stems = 0;
    let totalConfidence = 0;
    const feedbackStats = { good: 0, bad: 0, too_fast: 0, vocals_clashed: 0, wrong_energy: 0 };

    for (const e of this.entries) {
      if (e.fallbackUsed) fallbacks++;
      if (e.stemUsed) stems++;
      totalConfidence += e.confidence || 0;
      if (e.userFeedback && e.userFeedback in feedbackStats) {
        feedbackStats[e.userFeedback]++;
      }
    }

    return {
      totalTransitions: total,
      fallbackCount: fallbacks,
      fallbackPercentage: Number(((fallbacks / total) * 100).toFixed(1)),
      stemCount: stems,
      stemPercentage: Number(((stems / total) * 100).toFixed(1)),
      averageConfidence: Number((totalConfidence / total).toFixed(1)),
      feedbackStats
    };
  }

  /**
   * Clears audit history.
   */
  public clearAuditLog(): void {
    this.entries = [];
    this.persistToStorage();
  }
}
