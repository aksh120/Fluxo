import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { TrackMetadata } from '../../shared/types';
import type { ScannedFileInfo } from './Scanner';

export interface MetadataExtractorOptions {
  coversCacheDir?: string;
}

export class MetadataExtractor {
  private coversDir: string;

  constructor(options: MetadataExtractorOptions = {}) {
    this.coversDir =
      options.coversCacheDir ||
      path.join(process.cwd(), '.cache', 'covers');

    if (!fs.existsSync(this.coversDir)) {
      try {
        fs.mkdirSync(this.coversDir, { recursive: true });
      } catch {
        // Handled if directory exists or unwritable
      }
    }
  }

  /**
   * Generates a stable deterministic track ID from file path
   */
  public generateTrackId(filePath: string): string {
    return 'trk_' + crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
  }

  /**
   * Intelligently parses Artist and Title from filename if audio tags are missing
   */
  public parseFilenameFallback(fileName: string): { title: string; artist: string } {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '').trim();

    // Check for common formats like "Artist - Title" or "03 - Artist - Title"
    if (nameWithoutExt.includes(' - ')) {
      let parts = nameWithoutExt.split(' - ');
      // If the first part is purely a track number e.g. "01", "03", shift it
      if (parts.length >= 3 && /^\d+$/.test(parts[0].trim())) {
        parts = parts.slice(1);
      }

      if (parts.length >= 2) {
        const artist = parts[0].replace(/^\d+[\s.-]*/, '').trim();
        const title = parts.slice(1).join(' - ').trim();
        return {
          artist: artist || 'Unknown Artist',
          title: title || 'Untitled Track'
        };
      }
    }

    // Strip leading track number e.g. "01 Title" or "01. Title"
    const cleanedTitle = nameWithoutExt.replace(/^\d+[\s.-]*/, '').trim();

    return {
      artist: 'Unknown Artist',
      title: cleanedTitle || nameWithoutExt || 'Untitled Track'
    };
  }

  /**
   * Extracts metadata and embedded album art from a scanned audio file
   */
  public async extractMetadata(file: ScannedFileInfo): Promise<TrackMetadata> {
    const trackId = this.generateTrackId(file.filePath);
    const fallback = this.parseFilenameFallback(file.fileName);

    let title = fallback.title;
    let artist = fallback.artist;
    let album = 'Unknown Album';
    let genre: string | undefined;
    let year: number | undefined;
    let duration = 0;
    let sampleRate = 44100;
    let channels = 2;
    let bitrate: number | undefined;
    let coverArtPath: string | undefined;

    try {
      // Dynamically load music-metadata to ensure full ESM/CJS compatibility
      const mm = await import('music-metadata');
      const metadata = await mm.parseFile(file.filePath, { skipCovers: false });

      if (metadata.common) {
        if (metadata.common.title && metadata.common.title.trim().length > 0) {
          title = metadata.common.title.trim();
        }
        if (metadata.common.artist && metadata.common.artist.trim().length > 0) {
          artist = metadata.common.artist.trim();
        }
        if (metadata.common.album && metadata.common.album.trim().length > 0) {
          album = metadata.common.album.trim();
        }
        if (metadata.common.genre && metadata.common.genre.length > 0) {
          genre = metadata.common.genre[0];
        }
        if (metadata.common.year) {
          year = metadata.common.year;
        }

        // Extract embedded cover art
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const pic = metadata.common.picture[0];
          const coverHash = crypto.createHash('md5').update(pic.data).digest('hex');
          const ext = pic.format.includes('png') ? '.png' : '.jpg';
          const coverFilePath = path.join(this.coversDir, `${coverHash}${ext}`);

          if (!fs.existsSync(coverFilePath)) {
            await fs.promises.writeFile(coverFilePath, pic.data);
          }
          coverArtPath = coverFilePath;
        }
      }

      if (metadata.format) {
        duration = metadata.format.duration || 0;
        sampleRate = metadata.format.sampleRate || 44100;
        channels = metadata.format.numberOfChannels || 2;
        bitrate = metadata.format.bitrate || undefined;
      }
    } catch (err) {
      // Tag parsing error: fall back safely to filename heuristics
      console.warn(`Tag parsing error on ${file.fileName}, using fallback metadata:`, err);
    }

    return {
      id: trackId,
      filePath: file.filePath,
      fileSize: file.fileSize,
      mtime: file.mtime,
      title,
      artist,
      album,
      genre,
      year,
      duration,
      sampleRate,
      channels,
      bitrate,
      format: file.format,
      coverArtPath,
      sourceType: 'local'
    };
  }
}
