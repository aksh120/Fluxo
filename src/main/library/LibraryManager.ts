import { FluxoDatabase } from '../db/database';
import { DirectoryScanner, type ScannedFileInfo, type ScannerProgress } from './Scanner';
import { MetadataExtractor } from './MetadataExtractor';
import type { TrackMetadata, TrackAnalysis } from '../../shared/types';

export interface LibraryProgressEvent {
  phase: 'scanning' | 'extracting' | 'complete';
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
}

export class LibraryManager {
  private db: FluxoDatabase;
  private scanner: DirectoryScanner;
  private extractor: MetadataExtractor;
  private isScanning = false;

  constructor(db: FluxoDatabase, coversCacheDir?: string) {
    this.db = db;
    this.scanner = new DirectoryScanner();
    this.extractor = new MetadataExtractor({ coversCacheDir });
  }

  public getDatabase(): FluxoDatabase {
    return this.db;
  }

  public cancelScan(): void {
    this.scanner.cancel();
    this.isScanning = false;
  }

  /**
   * Scans a directory recursively, extracts tags incrementally, and persists to SQLite.
   */
  public async scanDirectory(
    dirPath: string,
    onProgress?: (progress: LibraryProgressEvent) => void
  ): Promise<TrackMetadata[]> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }
    this.isScanning = true;

    try {
      // 1. Recursive Discovery
      onProgress?.({
        phase: 'scanning',
        totalFiles: 0,
        processedFiles: 0,
        currentFile: dirPath
      });

      const discoveredFiles = await this.scanner.scanDirectory(dirPath, (p: ScannerProgress) => {
        onProgress?.({
          phase: 'scanning',
          totalFiles: p.audioFilesFound,
          processedFiles: p.directoriesScanned,
          currentFile: p.currentPath
        });
      });

      // 2. Incremental Change Detection via SQLite
      const existingTracks = this.db.getAllTracks();
      const existingMap = new Map<string, { mtime: number; fileSize: number }>();
      for (const t of existingTracks) {
        existingMap.set(t.filePath, { mtime: t.mtime, fileSize: t.fileSize });
      }

      const { toProcess, unchanged } = this.scanner.filterModifiedFiles(discoveredFiles, existingMap);

      // 3. Extract Metadata for new/modified files
      const totalToProcess = toProcess.length;
      let processedCount = 0;

      for (const file of toProcess) {
        onProgress?.({
          phase: 'extracting',
          totalFiles: totalToProcess,
          processedFiles: processedCount,
          currentFile: file.fileName
        });

        const metadata = await this.extractor.extractMetadata(file);
        this.db.upsertTrack(metadata);
        processedCount++;
      }

      onProgress?.({
        phase: 'complete',
        totalFiles: discoveredFiles.length,
        processedFiles: discoveredFiles.length
      });

      return this.db.getAllTracks();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Imports a specific set of individual files
   */
  public async importFiles(
    filePaths: string[],
    onProgress?: (progress: LibraryProgressEvent) => void
  ): Promise<TrackMetadata[]> {
    const scanned = await this.scanner.scanFileList(filePaths);
    let processed = 0;

    for (const file of scanned) {
      onProgress?.({
        phase: 'extracting',
        totalFiles: scanned.length,
        processedFiles: processed,
        currentFile: file.fileName
      });

      const metadata = await this.extractor.extractMetadata(file);
      this.db.upsertTrack(metadata);
      processed++;
    }

    onProgress?.({
      phase: 'complete',
      totalFiles: scanned.length,
      processedFiles: scanned.length
    });

    return this.db.getAllTracks();
  }

  public getAllTracksWithAnalysis(): { track: TrackMetadata; analysis: TrackAnalysis | null }[] {
    const tracks = this.db.getAllTracks();
    return tracks.map((track) => ({
      track,
      analysis: this.db.getAnalysis(track.id)
    }));
  }

  public searchTracks(query: string): TrackMetadata[] {
    return this.db.searchTracks(query);
  }

  public deleteTrack(id: string): boolean {
    return this.db.deleteTrack(id);
  }
}
