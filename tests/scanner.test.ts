import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DirectoryScanner } from '../src/main/library/Scanner';

describe('Phase 4 DirectoryScanner Tests', () => {
  let tempDir: string;
  let scanner: DirectoryScanner;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fluxo-scan-test-'));
    scanner = new DirectoryScanner();

    // Create nested directory structure with dummy files
    const subDirA = path.join(tempDir, 'Artist A', 'Album 1');
    const subDirB = path.join(tempDir, 'Artist B');
    const hiddenDir = path.join(tempDir, '.hidden');

    await fs.promises.mkdir(subDirA, { recursive: true });
    await fs.promises.mkdir(subDirB, { recursive: true });
    await fs.promises.mkdir(hiddenDir, { recursive: true });

    // Valid audio files
    await fs.promises.writeFile(path.join(subDirA, '01 - Track One.mp3'), 'dummy mp3 data');
    await fs.promises.writeFile(path.join(subDirA, '02 - Track Two.flac'), 'dummy flac data');
    await fs.promises.writeFile(path.join(subDirB, 'Song.wav'), 'dummy wav data');

    // Non-audio and hidden files to be ignored
    await fs.promises.writeFile(path.join(tempDir, 'notes.txt'), 'text file');
    await fs.promises.writeFile(path.join(subDirA, 'cover.jpg'), 'image data');
    await fs.promises.writeFile(path.join(hiddenDir, 'hidden.mp3'), 'hidden data');
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('P04-T002: recursively discovers audio files while ignoring non-audio and hidden directories', async () => {
    const results = await scanner.scanDirectory(tempDir);

    expect(results.length).toBe(3);
    const names = results.map((r) => r.fileName);
    expect(names).toContain('01 - Track One.mp3');
    expect(names).toContain('02 - Track Two.flac');
    expect(names).toContain('Song.wav');
    expect(names).not.toContain('notes.txt');
    expect(names).not.toContain('cover.jpg');
    expect(names).not.toContain('hidden.mp3');
  });

  it('P04-T002: accurately identifies unchanged vs modified files using mtime and size', async () => {
    const scanned = await scanner.scanDirectory(tempDir);
    expect(scanned.length).toBe(3);

    const first = scanned[0];
    const existingMap = new Map<string, { mtime: number; fileSize: number }>();

    // Mock that first file exists with identical mtime and size
    existingMap.set(first.filePath, { mtime: first.mtime, fileSize: first.fileSize });

    // Mock that second file has different mtime (modified)
    const second = scanned[1];
    existingMap.set(second.filePath, { mtime: second.mtime - 5000, fileSize: second.fileSize });

    // Third file is not in map (new)
    const { toProcess, unchanged } = scanner.filterModifiedFiles(scanned, existingMap);

    expect(unchanged.length).toBe(1);
    expect(unchanged[0].filePath).toBe(first.filePath);

    expect(toProcess.length).toBe(2);
    const toProcessPaths = toProcess.map((f) => f.filePath);
    expect(toProcessPaths).toContain(second.filePath);
    expect(toProcessPaths).toContain(scanned[2].filePath);
  });
});
