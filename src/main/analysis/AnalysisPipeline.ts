import path from 'node:path';
import fs from 'node:fs';
import { WaveformPeakGenerator } from '../../shared/analysis/WaveformPeakGenerator';
import { OnsetBpmDetector } from '../../shared/analysis/OnsetBpmDetector';
import { BeatGridGenerator } from '../../shared/analysis/BeatGridGenerator';
import { KeyClassifier } from '../../shared/analysis/KeyClassifier';
import { LoudnessAnalyzer } from '../../shared/analysis/LoudnessAnalyzer';
import { StructureEstimator } from '../../shared/analysis/StructureEstimator';
import type { FluxoDatabase } from '../db/database';
import type { TrackMetadata, TrackAnalysis } from '../../shared/types';

export interface AnalysisPipelineOptions {
  peaksCacheDir?: string;
}

export class AnalysisPipeline {
  private db: FluxoDatabase;
  private peaksDir: string;
  private peakGen: WaveformPeakGenerator;
  private bpmDetector: OnsetBpmDetector;
  private beatGridGen: BeatGridGenerator;
  private keyClassifier: KeyClassifier;
  private loudnessAnalyzer: LoudnessAnalyzer;
  private structureEstimator: StructureEstimator;

  constructor(db: FluxoDatabase, options: AnalysisPipelineOptions = {}) {
    this.db = db;
    this.peaksDir = options.peaksCacheDir || path.join(process.cwd(), '.cache', 'peaks');

    if (!fs.existsSync(this.peaksDir)) {
      try {
        fs.mkdirSync(this.peaksDir, { recursive: true });
      } catch {
        // Handled
      }
    }

    this.peakGen = new WaveformPeakGenerator();
    this.bpmDetector = new OnsetBpmDetector();
    this.beatGridGen = new BeatGridGenerator();
    this.keyClassifier = new KeyClassifier();
    this.loudnessAnalyzer = new LoudnessAnalyzer();
    this.structureEstimator = new StructureEstimator();
  }

  /**
   * Analyzes a track from raw PCM samples, caches waveform peaks, and persists analysis & cue points to SQLite.
   */
  public async analyzeTrack(
    track: TrackMetadata,
    channelData: Float32Array,
    sampleRate: number
  ): Promise<TrackAnalysis> {
    const duration = track.duration > 0 ? track.duration : channelData.length / sampleRate;

    // 1. Fast Tier: Waveform Peaks & Binary File Caching
    const waveform = this.peakGen.generatePeaks(channelData, sampleRate, 100);
    const peaksFile = path.join(this.peaksDir, `${track.id}.peaks`);
    await this.peakGen.saveToFile(peaksFile, waveform);

    // 2. Deep Tier: BPM & Onset Detection
    const bpmResult = this.bpmDetector.estimateBpm(channelData, sampleRate);

    // 3. Deep Tier: Beat Grid & Downbeat Alignment
    const beatGridResult = this.beatGridGen.generateBeatGrid(
      bpmResult.bpm,
      bpmResult.onsetEnvelope,
      bpmResult.frameRate,
      duration
    );

    // 4. Musical Key & Camelot Wheel Classification
    const keyResult = this.keyClassifier.classifyKey(channelData, sampleRate);

    // 5. Loudness & True Peak Analysis
    const loudnessResult = this.loudnessAnalyzer.analyzeLoudness(channelData, sampleRate);

    // 6. Structural Song Landmarks (Intro, Drop, Outro)
    const structureResult = this.structureEstimator.estimateStructure(
      channelData,
      sampleRate,
      track.id,
      duration
    );

    // Save suggested cue points to SQLite
    for (const cue of structureResult.suggestedCuePoints) {
      this.db.saveCuePoint(cue);
    }

    // Assemble complete TrackAnalysis
    const analysis: TrackAnalysis = {
      trackId: track.id,
      status: 'deep_ready',
      bpm: bpmResult.bpm,
      bpmConfidence: bpmResult.confidence,
      musicalKey: keyResult.musicalKey,
      camelotCode: keyResult.camelotCode,
      keyConfidence: keyResult.confidence,
      integratedLufs: loudnessResult.integratedLufs,
      truePeak: loudnessResult.truePeak,
      energyLevel: loudnessResult.energyLevel,
      beatGrid: beatGridResult.beatGrid,
      waveformOverviewPath: peaksFile
    };

    // 7. Persist to SQLite
    this.db.upsertAnalysis(analysis);

    return analysis;
  }
}
