/**
 * AutopilotMetricsService.ts
 * Computes genuine library intelligence and coverage metrics from actual
 * loaded tracks, database records, and stem separation cache state.
 */

import type { TrackMetadata, TrackAnalysis } from '../../shared/types';
import type { LibraryIntelligenceMetrics } from './AutopilotTypes';

export class AutopilotMetricsService {
  /**
   * Calculates genuine library statistics without placeholder numbers.
   */
  public static calculateMetrics(
    tracks: TrackMetadata[],
    analyses: Map<string, TrackAnalysis> | Record<string, TrackAnalysis>,
    isScanning: boolean = false
  ): LibraryIntelligenceMetrics {
    const totalDiscovered = tracks.length;
    if (totalDiscovered === 0) {
      return {
        totalDiscovered: 0,
        tracksIndexed: 0,
        tracksAnalysed: 0,
        tracksWithStems: 0,
        tracksAwaitingDeepAnalysis: 0,
        tracksUnavailable: 0,
        libraryCoveragePercent: 0,
        currentAnalysisQueue: isScanning ? 1 : 0
      };
    }

    let tracksIndexed = 0;
    let tracksAnalysed = 0;
    let tracksWithStems = 0;
    let tracksUnavailable = 0;

    const getAnalysis = (id: string): TrackAnalysis | undefined => {
      if (analyses instanceof Map) {
        return analyses.get(id);
      }
      return analyses[id];
    };

    for (const track of tracks) {
      if (!track.filePath || track.duration <= 0) {
        tracksUnavailable++;
        continue;
      }

      tracksIndexed++;

      const analysis = getAnalysis(track.id);
      if (analysis && analysis.bpm && analysis.bpm > 0) {
        tracksAnalysed++;
        if (analysis.stemsPath && analysis.stemsPath.length > 0) {
          tracksWithStems++;
        }
      }
    }

    const tracksAwaitingDeepAnalysis = Math.max(0, tracksIndexed - tracksAnalysed);
    const libraryCoveragePercent =
      tracksIndexed > 0 ? Math.round((tracksAnalysed / tracksIndexed) * 100) : 0;
    const currentAnalysisQueue = isScanning ? tracksAwaitingDeepAnalysis + 1 : tracksAwaitingDeepAnalysis;

    return {
      totalDiscovered,
      tracksIndexed,
      tracksAnalysed,
      tracksWithStems,
      tracksAwaitingDeepAnalysis,
      tracksUnavailable,
      libraryCoveragePercent,
      currentAnalysisQueue
    };
  }
}
