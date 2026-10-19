import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataExtractor } from '../src/main/library/MetadataExtractor';
import type { ScannedFileInfo } from '../src/main/library/Scanner';

describe('Phase 4 MetadataExtractor Tests', () => {
  let tempDir: string;
  let extractor: MetadataExtractor;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fluxo-meta-test-'));
    extractor = new MetadataExtractor({
      coversCacheDir: path.join(tempDir, 'covers')
    });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('P04-T003: correctly generates deterministic track IDs from filePath', () => {
    const id1 = extractor.generateTrackId('C:/Music/test.mp3');
    const id2 = extractor.generateTrackId('C:/Music/test.mp3');
    const id3 = extractor.generateTrackId('C:/Music/other.mp3');

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.startsWith('trk_')).toBe(true);
  });

  it('P04-T003: parses artist and title from filename conventions in fallback mode', () => {
    const res1 = extractor.parseFilenameFallback('Daft Punk - One More Time.mp3');
    expect(res1.artist).toBe('Daft Punk');
    expect(res1.title).toBe('One More Time');

    const res2 = extractor.parseFilenameFallback('03 - Deadmau5 - Strobe (Club Edit).flac');
    expect(res2.artist).toBe('Deadmau5');
    expect(res2.title).toBe('Strobe (Club Edit)');

    const res3 = extractor.parseFilenameFallback('01. Midnight City.wav');
    expect(res3.artist).toBe('Unknown Artist');
    expect(res3.title).toBe('Midnight City');
  });

  it('P04-T003: extracts metadata from audio file fixture with graceful fallback', async () => {
    const testFile = path.join(tempDir, 'Solaris - Horizon Glow.mp3');
    await fs.promises.writeFile(testFile, 'dummy audio data');

    const scanned: ScannedFileInfo = {
      filePath: testFile,
      fileName: 'Solaris - Horizon Glow.mp3',
      fileSize: 1024,
      mtime: 1700000000,
      format: 'mp3'
    };

    const metadata = await extractor.extractMetadata(scanned);

    expect(metadata.id).toBeDefined();
    expect(metadata.artist).toBe('Solaris');
    expect(metadata.title).toBe('Horizon Glow');
    expect(metadata.format).toBe('mp3');
    expect(metadata.fileSize).toBe(1024);
    expect(metadata.sourceType).toBe('local');
  });
});
