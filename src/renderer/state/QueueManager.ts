import type { TrackMetadata } from '../../shared/types';
import { EnergyFlowOrchestrator } from '../../shared/dj/EnergyFlowOrchestrator';
import { PreferenceLearner } from '../../shared/dj/PreferenceLearner';

export interface QueueItem {
  id: string;
  track: TrackMetadata;
  isPinned?: boolean;
  addedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export class QueueManager {
  private items: QueueItem[] = [];
  private currentIndex: number = -1;
  private repeatMode: RepeatMode = 'off';
  private isShuffled: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor(initialTracks: TrackMetadata[] = []) {
    if (initialTracks.length > 0) {
      this.items = initialTracks.map((t, idx) => ({
        id: `q_${Date.now()}_${idx}_${t.id}`,
        track: t,
        addedAt: Date.now() + idx
      }));
      this.currentIndex = 0;
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getItems(): QueueItem[] {
    return [...this.items];
  }

  public getQueue(): QueueItem[] {
    return this.getUpcomingItems();
  }

  public getUpcomingItems(): QueueItem[] {
    if (this.currentIndex < 0) return [...this.items];
    return this.items.slice(this.currentIndex + 1);
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentTrack(): TrackMetadata | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex].track;
    }
    return null;
  }

  public getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
    this.notify();
  }

  public isShuffleEnabled(): boolean {
    return this.isShuffled;
  }

  public setShuffle(enabled: boolean): void {
    this.isShuffled = enabled;
    if (enabled && this.items.length > 2) {
      // Keep current track at currentIndex, shuffle remaining unplayed items
      const current = this.items[this.currentIndex];
      const unplayed = this.items.filter((_, idx) => idx > this.currentIndex && !_.isPinned);
      const pinned = this.items.filter((_, idx) => idx > this.currentIndex && _.isPinned);

      // Fisher-Yates shuffle on unpinned unplayed
      for (let i = unplayed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unplayed[i], unplayed[j]] = [unplayed[j], unplayed[i]];
      }

      const played = this.items.slice(0, this.currentIndex);
      this.items = [...played, current, ...pinned, ...unplayed];
    }
    this.notify();
  }

  public resequenceUpcoming(
    orchestrator: EnergyFlowOrchestrator,
    _preferenceLearner?: PreferenceLearner
  ): void {
    if (this.items.length <= 1) return;

    const currentTrack = this.getCurrentTrack();
    const startIndex = Math.max(0, this.currentIndex);
    const unplayedItems = this.items.slice(startIndex + 1);
    if (unplayedItems.length <= 1) return;

    const pinnedIds = new Set<string>(
      unplayedItems.filter((it) => it.isPinned).map((it) => it.track.id)
    );

    // Sequence candidate tracks starting from current track
    const candidateTracks = unplayedItems.map((it) => it.track);
    const tracksToSequence = currentTrack ? [currentTrack, ...candidateTracks] : candidateTracks;

    const sequenced = orchestrator.sequenceTracks(tracksToSequence, {
      preserveFirstTrack: Boolean(currentTrack),
      pinnedTrackIds: pinnedIds,
      penalizeSameArtist: true
    });

    // Map back to original QueueItems
    const itemMap = new Map<string, QueueItem>();
    unplayedItems.forEach((it) => itemMap.set(it.track.id, it));

    const reorderedItems: QueueItem[] = [];
    const sequencedTracks = currentTrack ? sequenced.slice(1) : sequenced;

    for (const seq of sequencedTracks) {
      const originalItem = itemMap.get(seq.track.id);
      if (originalItem) {
        reorderedItems.push(originalItem);
      }
    }

    const played = this.items.slice(0, startIndex + 1);
    this.items = [...played, ...reorderedItems];
    this.notify();
  }

  public addTrack(track: TrackMetadata, playNext = false): QueueItem {
    const item: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${track.id}`,
      track,
      addedAt: Date.now()
    };

    if (playNext && this.currentIndex >= 0) {
      this.items.splice(this.currentIndex + 1, 0, item);
    } else {
      this.items.push(item);
    }

    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }

    this.notify();
    return item;
  }

  public addTracks(tracks: TrackMetadata[]): void {
    const now = Date.now();
    const newItems: QueueItem[] = tracks.map((track, i) => ({
      id: `q_${now}_${i}_${track.id}`,
      track,
      addedAt: now + i
    }));

    this.items.push(...newItems);
    if (this.currentIndex === -1 && this.items.length > 0) {
      this.currentIndex = 0;
    }
    this.notify();
  }

  public removeTrack(itemId: string): void {
    const idx = this.items.findIndex((it) => it.id === itemId);
    if (idx === -1) return;

    this.items.splice(idx, 1);
    if (idx < this.currentIndex) {
      this.currentIndex--;
    } else if (idx === this.currentIndex && this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1;
    }
    this.notify();
  }

  public moveTrack(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.items.length ||
      toIndex < 0 ||
      toIndex >= this.items.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [moved] = this.items.splice(fromIndex, 1);
    this.items.splice(toIndex, 0, moved);

    // Adjust current index to follow active track if it was moved
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.notify();
  }

  public togglePin(itemId: string): void {
    const item = this.items.find((it) => it.id === itemId);
    if (item) {
      item.isPinned = !item.isPinned;
      this.notify();
    }
  }

  public advance(): TrackMetadata | null {
    if (this.items.length === 0) return null;

    if (this.repeatMode === 'one') {
      return this.getCurrentTrack();
    }

    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.notify();
      return this.getCurrentTrack();
    }

    if (this.repeatMode === 'all') {
      this.currentIndex = 0;
      this.notify();
      return this.getCurrentTrack();
    }

    // End of queue reached
    this.notify();
    return null;
  }

  public previous(): TrackMetadata | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.notify();
      return this.getCurrentTrack();
    }
    return this.getCurrentTrack();
  }

  public jumpTo(index: number): TrackMetadata | null {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
      this.notify();
      return this.getCurrentTrack();
    }
    return null;
  }

  public clear(): void {
    this.items = [];
    this.currentIndex = -1;
    this.notify();
  }
}
