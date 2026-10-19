import type { TrackMetadata } from '../types';

export interface AudioSourceCapabilities {
  canSearch: boolean;
  canStream: boolean;
  canAccessPcmData: boolean;
  canOfflineExport: boolean;
  requiresAuthentication: boolean;
  latencyProfile: 'instant' | 'buffered' | 'network';
}

export interface SearchResultItem {
  id: string; // Video ID or unique file hash
  sourceType: 'local' | 'youtube' | 'soundcloud';
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  url?: string;
  filePath?: string;
  bpm?: number;
  key?: string;
  isExtracted?: boolean;
}

export interface ExtractionProgress {
  videoId: string;
  phase: 'resolving' | 'downloading' | 'converting' | 'caching' | 'complete' | 'error';
  progress: number; // 0.0 - 1.0
  percentage: number; // 0 - 100
  downloadSpeed?: string;
  eta?: string;
  statusMessage: string;
  error?: string;
}

/**
 * Universal source provider contract.
 * Guarantees that any audio source (local files, extracted YouTube, streaming)
 * conforms to the exact same contract required for dual-deck DSP mixing,
 * analysis, and offline mix rendering.
 */
export interface IMusicSourceProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AudioSourceCapabilities;

  /**
   * Search tracks or query resources.
   */
  search(query: string, limit?: number): Promise<SearchResultItem[]>;

  /**
   * Resolves complete metadata for an identifier.
   */
  resolveMetadata(identifier: string): Promise<TrackMetadata>;

  /**
   * Resolves a local streamable or file path.
   */
  getStreamUrlOrPath(identifier: string): Promise<string>;

  /**
   * Returns complete audio buffer bytes for Web Audio decoding.
   */
  getAudioBuffer(identifier: string): Promise<ArrayBuffer>;
}
