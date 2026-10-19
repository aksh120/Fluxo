import fs from 'node:fs';
import path from 'node:path';
import type {
  IMusicSourceProvider,
  AudioSourceCapabilities,
  SearchResultItem
} from '../../shared/sources/IMusicSourceProvider';
import type { TrackMetadata } from '../../shared/types';
import { MetadataExtractor } from '../library/MetadataExtractor';
import { FluxoDatabase } from '../db/database';

export class LocalFileProvider implements IMusicSourceProvider {
  public readonly id = 'local';
  public readonly name = 'Local File Provider';

  public readonly capabilities: AudioSourceCapabilities = {
    canSearch: true,
    canStream: true,
    canAccessPcmData: true,
    canOfflineExport: true,
    requiresAuthentication: false,
    latencyProfile: 'instant'
  };

  private database?: FluxoDatabase;
  private metadataExtractor: MetadataExtractor;

  constructor(database?: FluxoDatabase) {
    this.database = database;
    this.metadataExtractor = new MetadataExtractor();
  }

  public async search(query: string, limit = 20): Promise<SearchResultItem[]> {
    if (this.database) {
      const dbTracks = this.database.searchTracks(query);
      return dbTracks.slice(0, limit).map((t) => ({
        id: t.id,
        sourceType: 'local',
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        filePath: t.filePath,
        bpm: t.bpm,
        key: t.camelotCode || t.musicalKey,
        isExtracted: true
      }));
    }
    return [];
  }

  public async resolveMetadata(filePath: string): Promise<TrackMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return this.metadataExtractor.extractMetadata(filePath);
  }

  public async getStreamUrlOrPath(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return filePath;
  }

  public async getAudioBuffer(filePath: string): Promise<ArrayBuffer> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const buf = await fs.promises.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
}
