/**
 * AutopilotTypes.ts
 * Type definitions, state unions, and interfaces for Fluxo Autopilot (Autonomous AI DJ).
 */

import type { TrackMetadata, TrackAnalysis } from '../../shared/types';
import type { TransitionFamily, PlannedTransition } from './TransitionPlanner';

export type AutopilotState =
  | 'idle'
  | 'discovering'
  | 'analyzing'
  | 'planning'
  | 'preparing_next'
  | 'ready'
  | 'playing'
  | 'transitioning'
  | 'recovering'
  | 'paused'
  | 'stopped'
  | 'error';

export type AutopilotEnergyProfile =
  | 'warmup'
  | 'building'
  | 'steady'
  | 'peak'
  | 'continuous'
  | 'winddown';

export type ProcessingQuality = 'low_resource' | 'balanced' | 'quality';

export type TransitionComplexity = 'smooth' | 'balanced' | 'creative';

export interface AutopilotConfig {
  energyProfile: AutopilotEnergyProfile;
  continuous: boolean;
  durationMinutes?: number;
  familiarityRatio: number; // 0.0 (full discovery) to 1.0 (familiar favorites)
  vocalPreferenceRatio: number; // 0.0 (instrumental focus) to 1.0 (vocal crossover focus)
  transitionComplexity: TransitionComplexity;
  processingQuality: ProcessingQuality;
  excludedTrackIds: string[];
  excludedFolders: string[];
  repetitionToleranceTracks: number; // Avoid repeating track within N plays (default: 8)
}

export interface LibraryIntelligenceMetrics {
  totalDiscovered: number;
  tracksIndexed: number;
  tracksAnalysed: number;
  tracksWithStems: number;
  tracksAwaitingDeepAnalysis: number;
  tracksUnavailable: number;
  libraryCoveragePercent: number;
  currentAnalysisQueue: number;
}

export interface PlannedSetItem {
  id: string;
  track: TrackMetadata;
  analysis?: TrackAnalysis | null;
  isLocked: boolean;
  plannedTransition?: PlannedTransition | null;
  readinessStatus: 'ready' | 'analyzing' | 'fallback_ready' | 'pending';
  targetEnergyLevel: number; // 0.0 to 1.0
}

export type TransitionUserFeedback =
  | 'good'
  | 'bad'
  | 'too_fast'
  | 'vocals_clashed'
  | 'wrong_energy';

export interface TransitionAuditEntry {
  id: string;
  fromTrackId: string;
  fromTrackTitle: string;
  toTrackId: string;
  toTrackTitle: string;
  transitionType: TransitionFamily;
  plannedDuration: number;
  actualDuration: number;
  timestamp: number;
  confidence: number;
  fallbackUsed: boolean;
  stemUsed: boolean;
  userFeedback?: TransitionUserFeedback;
}

export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = {
  energyProfile: 'building',
  continuous: true,
  durationMinutes: 60,
  familiarityRatio: 0.5,
  vocalPreferenceRatio: 0.7,
  transitionComplexity: 'balanced',
  processingQuality: 'balanced',
  excludedTrackIds: [],
  excludedFolders: [],
  repetitionToleranceTracks: 8
};
