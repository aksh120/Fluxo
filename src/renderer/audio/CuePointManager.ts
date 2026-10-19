import type { CuePoint } from '../../shared/types';

export const CUE_PAD_COLORS = [
  '#00F2FE', // Pad 1 - Cyan
  '#FE0979', // Pad 2 - Magenta
  '#10B981', // Pad 3 - Emerald
  '#F59E0B', // Pad 4 - Amber
  '#8B5CF6', // Pad 5 - Purple
  '#F43F5E', // Pad 6 - Rose
  '#3B82F6', // Pad 7 - Blue
  '#84CC16'  // Pad 8 - Lime
];

export interface CuePadSlot {
  padIndex: number; // 0 to 7 (Pads 1 to 8)
  cue: CuePoint | null;
  defaultColor: string;
}

export interface CueStorage {
  saveCuePoint: (cue: CuePoint) => Promise<void> | void;
  getCuePoints: (trackId: string) => Promise<CuePoint[]> | CuePoint[];
  deleteCuePoint: (cueId: string) => Promise<boolean> | boolean;
}

export class CuePointManager {
  private currentTrackId: string | null = null;
  private pads: Array<CuePoint | null> = new Array(8).fill(null);
  private storage?: CueStorage;
  private listeners: Set<(slots: CuePadSlot[]) => void> = new Set();

  constructor(storage?: CueStorage) {
    this.storage = storage;
  }

  public subscribe(listener: (slots: CuePadSlot[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSlots());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const slots = this.getSlots();
    for (const listener of this.listeners) {
      listener(slots);
    }
  }

  public getSlots(): CuePadSlot[] {
    return this.pads.map((cue, index) => ({
      padIndex: index,
      cue,
      defaultColor: CUE_PAD_COLORS[index]
    }));
  }

  public async setTrack(trackId: string): Promise<void> {
    this.currentTrackId = trackId;
    this.pads = new Array(8).fill(null);

    if (this.storage) {
      try {
        const savedCues = await this.storage.getCuePoints(trackId);
        for (const cue of savedCues) {
          // Parse pad index from name "Hot Cue X" or match index
          const match = cue.name.match(/Hot Cue (\d+)/i);
          let padIndex = -1;
          if (match) {
            padIndex = parseInt(match[1], 10) - 1;
          }
          if (padIndex >= 0 && padIndex < 8 && !this.pads[padIndex]) {
            this.pads[padIndex] = cue;
          } else {
            // Find first empty slot
            const emptyIdx = this.pads.findIndex((p) => p === null);
            if (emptyIdx !== -1) {
              this.pads[emptyIdx] = cue;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load cue points for track:', err);
      }
    }

    this.notify();
  }

  /**
   * Sets or overwrites a hot cue on the specified pad index (0 - 7)
   */
  public async setCue(
    padIndex: number,
    timestamp: number,
    name?: string,
    type: CuePoint['type'] = 'cue'
  ): Promise<CuePoint> {
    if (padIndex < 0 || padIndex >= 8) {
      throw new Error(`Invalid cue pad index: ${padIndex}`);
    }

    const trackId = this.currentTrackId || 'current-track';
    const cue: CuePoint = {
      id: `cue_${trackId}_${padIndex}_${Date.now()}`,
      trackId,
      name: name || `Hot Cue ${padIndex + 1}`,
      timestamp: Math.max(0, Math.round(timestamp * 1000) / 1000),
      type,
      color: CUE_PAD_COLORS[padIndex]
    };

    this.pads[padIndex] = cue;
    this.notify();

    if (this.storage) {
      try {
        await this.storage.saveCuePoint(cue);
      } catch (err) {
        console.warn('Failed to persist cue point:', err);
      }
    }

    return cue;
  }

  /**
   * Returns timestamp for instant jump (< 10ms seek latency)
   */
  public jumpToCue(padIndex: number): number | null {
    if (padIndex >= 0 && padIndex < 8 && this.pads[padIndex]) {
      return this.pads[padIndex]!.timestamp;
    }
    return null;
  }

  /**
   * Deletes a cue point from the given pad index
   */
  public async deleteCue(padIndex: number): Promise<boolean> {
    if (padIndex < 0 || padIndex >= 8) return false;

    const existing = this.pads[padIndex];
    if (!existing) return false;

    this.pads[padIndex] = null;
    this.notify();

    if (this.storage) {
      try {
        await this.storage.deleteCuePoint(existing.id);
      } catch (err) {
        console.warn('Failed to delete cue point from storage:', err);
      }
    }

    return true;
  }

  public clearAll(): void {
    this.pads = new Array(8).fill(null);
    this.notify();
  }
}
