import type { FluxoProject, TimelineTrack, TimelineTransition, ExportSettings, TransitionStyle } from '../../shared/types';

export class MixProjectSerializer {
  public static readonly CURRENT_VERSION = '1.0.0';

  /**
   * Create an empty default project.
   */
  public static createDefaultProject(name = 'Untitled Crossover Set'): FluxoProject {
    return {
      version: this.CURRENT_VERSION,
      id: `project-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: [],
      transitions: [],
      targetLufs: -14.0,
      exportSettings: {
        format: 'mp3',
        bitrateKbps: 320,
        sampleRate: 44100,
        normalize: true,
        targetLufs: -14.0
      }
    };
  }

  /**
   * Recalculates timeline offsets for all tracks sequentially based on transition overlaps.
   */
  public static recalculateOffsets(
    tracks: TimelineTrack[],
    transitions: TimelineTransition[]
  ): TimelineTrack[] {
    if (tracks.length === 0) return [];

    const updatedTracks: TimelineTrack[] = [];
    let currentOffset = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (i === 0) {
        currentOffset = 0;
      } else {
        const prevTrack = updatedTracks[i - 1];
        const transition = transitions.find(
          (t) => t.fromTrackId === prevTrack.id && t.toTrackId === track.id
        );
        const overlap = transition ? Math.max(0, transition.overlapSeconds) : 0;
        currentOffset = Math.max(0, prevTrack.offsetSeconds + prevTrack.duration - overlap);
      }

      updatedTracks.push({
        ...track,
        offsetSeconds: Math.round(currentOffset * 100) / 100
      });
    }

    return updatedTracks;
  }

  /**
   * Computes the total mix duration in seconds.
   */
  public static calculateTotalDuration(tracks: TimelineTrack[]): number {
    if (tracks.length === 0) return 0;
    let maxEnd = 0;
    for (const t of tracks) {
      const end = t.offsetSeconds + t.duration;
      if (end > maxEnd) maxEnd = end;
    }
    return Math.round(maxEnd * 100) / 100;
  }

  /**
   * Re-syncs transitions array when tracks are added, removed, or reordered.
   * Ensures every adjacent pair (i, i+1) has an associated transition.
   */
  public static syncTransitions(
    tracks: TimelineTrack[],
    existingTransitions: TimelineTransition[],
    defaultOverlapSeconds = 16,
    defaultStyle: TransitionStyle = 'smooth'
  ): TimelineTransition[] {
    const transitions: TimelineTransition[] = [];

    for (let i = 0; i < tracks.length - 1; i++) {
      const fromTrack = tracks[i];
      const toTrack = tracks[i + 1];

      // Check if existing transition already exists for this pair
      const existing = existingTransitions.find(
        (t) => t.fromTrackId === fromTrack.id && t.toTrackId === toTrack.id
      );

      // Max overlap cannot exceed duration of either track
      const maxPossibleOverlap = Math.min(fromTrack.duration, toTrack.duration) * 0.8;
      const initialOverlap = existing
        ? Math.min(existing.overlapSeconds, maxPossibleOverlap)
        : Math.min(defaultOverlapSeconds, maxPossibleOverlap);

      transitions.push({
        id: existing?.id || `trans-${fromTrack.id}-${toTrack.id}`,
        fromTrackId: fromTrack.id,
        toTrackId: toTrack.id,
        overlapSeconds: Math.max(2, Math.round(initialOverlap)),
        style: existing?.style || defaultStyle,
        curve: existing?.curve || 'equal_power'
      });
    }

    return transitions;
  }

  /**
   * Serializes a FluxoProject into a formatted JSON string.
   */
  public static serialize(project: FluxoProject): string {
    const cleanProject: FluxoProject = {
      ...project,
      updatedAt: Date.now()
    };
    return JSON.stringify(cleanProject, null, 2);
  }

  /**
   * Parses and validates a JSON string into a verified FluxoProject.
   * Throws Error with descriptive message if schema is violated.
   */
  public static deserialize(jsonString: string): FluxoProject {
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch (err) {
      throw new Error(`Invalid JSON syntax in .fluxo project file: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Project file root must be a valid JSON object');
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'string') {
      throw new Error("Missing or invalid project 'version'");
    }

    if (typeof obj.id !== 'string' || !obj.id.trim()) {
      throw new Error("Missing or invalid project 'id'");
    }

    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      throw new Error("Missing or invalid project 'name'");
    }

    if (!Array.isArray(obj.tracks)) {
      throw new Error("Project 'tracks' property must be an array");
    }

    // Validate each track
    const tracks: TimelineTrack[] = obj.tracks.map((t, idx) => {
      if (!t || typeof t !== 'object') {
        throw new Error(`Invalid track object at index ${idx}`);
      }
      const trk = t as Record<string, unknown>;
      if (typeof trk.id !== 'string') throw new Error(`Track at index ${idx} missing 'id'`);
      if (typeof trk.filePath !== 'string') throw new Error(`Track at index ${idx} missing 'filePath'`);
      if (typeof trk.title !== 'string') throw new Error(`Track at index ${idx} missing 'title'`);
      if (typeof trk.duration !== 'number' || trk.duration <= 0) {
        throw new Error(`Track at index ${idx} invalid 'duration': ${trk.duration}`);
      }

      return {
        id: trk.id,
        trackId: (trk.trackId as string) || trk.id,
        filePath: trk.filePath,
        title: trk.title,
        artist: typeof trk.artist === 'string' ? trk.artist : 'Unknown Artist',
        album: typeof trk.album === 'string' ? trk.album : undefined,
        duration: trk.duration,
        bpm: typeof trk.bpm === 'number' ? trk.bpm : undefined,
        key: typeof trk.key === 'string' ? trk.key : undefined,
        offsetSeconds: typeof trk.offsetSeconds === 'number' && trk.offsetSeconds >= 0 ? trk.offsetSeconds : 0,
        volume: typeof trk.volume === 'number' ? Math.max(0, Math.min(1.0, trk.volume)) : 1.0,
        lowGain: typeof trk.lowGain === 'number' ? Math.max(0, Math.min(1.0, trk.lowGain)) : 1.0,
        midGain: typeof trk.midGain === 'number' ? Math.max(0, Math.min(1.0, trk.midGain)) : 1.0,
        highGain: typeof trk.highGain === 'number' ? Math.max(0, Math.min(1.0, trk.highGain)) : 1.0,
        color: typeof trk.color === 'string' ? trk.color : undefined
      };
    });

    // Validate transitions
    const transitions: TimelineTransition[] = Array.isArray(obj.transitions)
      ? obj.transitions.map((trans, idx) => {
          const tr = trans as Record<string, unknown>;
          return {
            id: typeof tr.id === 'string' ? tr.id : `trans-${idx}`,
            fromTrackId: typeof tr.fromTrackId === 'string' ? tr.fromTrackId : '',
            toTrackId: typeof tr.toTrackId === 'string' ? tr.toTrackId : '',
            overlapSeconds: typeof tr.overlapSeconds === 'number' ? Math.max(0, tr.overlapSeconds) : 16,
            style: (tr.style as TransitionStyle) || 'smooth',
            curve: (tr.curve as 'equal_power' | 'linear' | 'exponential') || 'equal_power'
          };
        })
      : [];

    const exportSettingsObj = (obj.exportSettings as Record<string, unknown>) || {};
    const exportSettings: ExportSettings = {
      format: (exportSettingsObj.format as 'mp3' | 'wav' | 'flac') || 'mp3',
      bitrateKbps: typeof exportSettingsObj.bitrateKbps === 'number' ? exportSettingsObj.bitrateKbps : 320,
      sampleRate: typeof exportSettingsObj.sampleRate === 'number' ? exportSettingsObj.sampleRate : 44100,
      normalize: typeof exportSettingsObj.normalize === 'boolean' ? exportSettingsObj.normalize : true,
      targetLufs: typeof exportSettingsObj.targetLufs === 'number' ? exportSettingsObj.targetLufs : -14.0
    };

    return {
      version: obj.version as '1.0.0',
      id: obj.id,
      name: obj.name,
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
      tracks,
      transitions,
      targetLufs: typeof obj.targetLufs === 'number' ? obj.targetLufs : -14.0,
      exportSettings
    };
  }
}
