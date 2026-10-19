import fs from 'node:fs';
import path from 'node:path';

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.aiff',
  '.aif',
  '.wma'
]);

export interface ScannedFileInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  mtime: number;
  format: string;
}

export interface ScannerProgress {
  directoriesScanned: number;
  audioFilesFound: number;
  currentPath: string;
}

export class DirectoryScanner {
  private isCancelled = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Recursively scans a root directory for all supported audio files.
   * Invokes an optional progress callback during discovery.
   */
  public async scanDirectory(
    dirPath: string,
    onProgress?: (progress: ScannerProgress) => void
  ): Promise<ScannedFileInfo[]> {
    this.isCancelled = false;
    const results: ScannedFileInfo[] = [];
    let dirsCount = 0;

    const traverse = async (currentDir: string): Promise<void> => {
      if (this.isCancelled) return;

      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        dirsCount++;

        if (onProgress) {
          onProgress({
            directoriesScanned: dirsCount,
            audioFilesFound: results.length,
            currentPath: currentDir
          });
        }

        for (const entry of entries) {
          if (this.isCancelled) return;

          // Skip hidden directories and system folders
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') {
            continue;
          }

          const fullPath = path.join(currentDir, entry.name);

          try {
            if (entry.isDirectory()) {
              await traverse(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                const stat = await fs.promises.stat(fullPath);
                results.push({
                  filePath: fullPath,
                  fileName: entry.name,
                  fileSize: stat.size,
                  mtime: Math.floor(stat.mtimeMs),
                  format: ext.replace('.', '')
                });
              }
            }
          } catch {
            // Ignore permission/access errors on individual files
          }
        }
      } catch {
        // Ignore unreadable directory
      }
    };

    await traverse(dirPath);
    return results;
  }

  /**
   * Scans a specific list of individual audio file paths.
   */
  public async scanFileList(filePaths: string[]): Promise<ScannedFileInfo[]> {
    const results: ScannedFileInfo[] = [];

    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        if (SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
          const stat = await fs.promises.stat(filePath);
          results.push({
            filePath,
            fileName: path.basename(filePath),
            fileSize: stat.size,
            mtime: Math.floor(stat.mtimeMs),
            format: ext.replace('.', '')
          });
        }
      } catch {
        // Ignore missing or inaccessible file
      }
    }

    return results;
  }

  /**
   * Filters scanned files by comparing with existing database records:
   * returns only newly added or modified files (mtime or fileSize difference).
   */
  public filterModifiedFiles(
    scanned: ScannedFileInfo[],
    existingMap: Map<string, { mtime: number; fileSize: number }>
  ): {
    toProcess: ScannedFileInfo[];
    unchanged: ScannedFileInfo[];
  } {
    const toProcess: ScannedFileInfo[] = [];
    const unchanged: ScannedFileInfo[] = [];

    for (const file of scanned) {
      const existing = existingMap.get(file.filePath);
      if (!existing || existing.mtime !== file.mtime || existing.fileSize !== file.fileSize) {
        toProcess.push(file);
      } else {
        unchanged.push(file);
      }
    }

    return { toProcess, unchanged };
  }
}
