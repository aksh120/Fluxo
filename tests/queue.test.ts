import { describe, it, expect, beforeEach } from 'vitest';
import { QueueManager } from '../src/renderer/state/QueueManager';
import type { TrackMetadata } from '../src/shared/types';

describe('Phase 4 QueueManager Unit Tests', () => {
  const createMockTrack = (id: string, title: string): TrackMetadata => ({
    id,
    filePath: `C:/Music/${id}.mp3`,
    fileSize: 1000000,
    mtime: 1700000000,
    title,
    artist: 'Artist',
    album: 'Album',
    duration: 180,
    sampleRate: 44100,
    channels: 2,
    format: 'mp3',
    sourceType: 'local'
  });

  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager([
      createMockTrack('t1', 'Track 1'),
      createMockTrack('t2', 'Track 2'),
      createMockTrack('t3', 'Track 3')
    ]);
  });

  it('P04-T005: initializes with tracks and points to the first track', () => {
    expect(queue.getItems().length).toBe(3);
    expect(queue.getCurrentIndex()).toBe(0);
    expect(queue.getCurrentTrack()?.title).toBe('Track 1');
  });

  it('P04-T005: adds track with playNext=true immediately after current position', () => {
    const nextTrack = createMockTrack('t-next', 'Next Up');
    queue.addTrack(nextTrack, true);

    const items = queue.getItems();
    expect(items.length).toBe(4);
    expect(items[1].track.id).toBe('t-next');
  });

  it('P04-T005: supports drag-and-drop track reordering and adjusts current index', () => {
    // Current is index 0 ('Track 1'). Move index 2 ('Track 3') to index 1
    queue.moveTrack(2, 1);
    const items = queue.getItems();
    expect(items[0].track.title).toBe('Track 1');
    expect(items[1].track.title).toBe('Track 3');
    expect(items[2].track.title).toBe('Track 2');

    // Move current track from index 0 to index 2
    queue.moveTrack(0, 2);
    expect(queue.getCurrentIndex()).toBe(2);
    expect(queue.getCurrentTrack()?.title).toBe('Track 1');
  });

  it('P04-T005: supports track pinning', () => {
    const items = queue.getItems();
    const targetId = items[1].id;

    expect(items[1].isPinned).toBeFalsy();
    queue.togglePin(targetId);

    const updated = queue.getItems();
    expect(updated[1].isPinned).toBe(true);

    queue.togglePin(targetId);
    expect(queue.getItems()[1].isPinned).toBe(false);
  });

  it('P04-T005: advances through queue and handles repeat modes', () => {
    expect(queue.getCurrentTrack()?.title).toBe('Track 1');

    // Advance 1 -> Track 2
    const next1 = queue.advance();
    expect(next1?.title).toBe('Track 2');

    // Advance 2 -> Track 3
    const next2 = queue.advance();
    expect(next2?.title).toBe('Track 3');

    // Advance past end with repeat off -> null
    const end = queue.advance();
    expect(end).toBeNull();

    // With repeat 'all' -> wraps to Track 1
    queue.setRepeatMode('all');
    const wrap = queue.advance();
    expect(wrap?.title).toBe('Track 1');

    // With repeat 'one' -> stays on Track 1
    queue.setRepeatMode('one');
    const stay = queue.advance();
    expect(stay?.title).toBe('Track 1');
  });
});
