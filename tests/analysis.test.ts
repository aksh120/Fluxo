import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WaveformPeakGenerator } from '../src/shared/analysis/WaveformPeakGenerator';
import { OnsetBpmDetector } from '../src/shared/analysis/OnsetBpmDetector';
import { BeatGridGenerator } from '../src/shared/analysis/BeatGridGenerator';
import { KeyClassifier } from '../src/shared/analysis/KeyClassifier';
import { LoudnessAnalyzer } from '../src/shared/analysis/LoudnessAnalyzer';
import { StructureEstimator } from '../src/shared/analysis/StructureEstimator';
import { AnalysisPipeline } from '../src/main/analysis/AnalysisPipeline';
import { FluxoDatabase } from '../src/main/db/database';
import type { TrackMetadata } from '../src/shared/types';

describe('Phase 6 Audio Analysis, BPM, Beatgrid, Key & Loudness Tests', () => {
  let tempDir: string;
  let db: FluxoDatabase;
  const sampleRate = 44100;

  // Helper to synthesize a 10-second 128 BPM test audio track (kick drum on every beat)
  const create128BpmTestSignal = (durationSeconds = 10): Float32Array => {
    const totalSamples = Math.floor(sampleRate * durationSeconds);
    const signal = new Float32Array(totalSamples);
    const bpm = 128;
    const intervalSamples = Math.floor((60 / bpm) * sampleRate);

    // Add punchy kick bursts on every beat (40ms decay pulse)
    for (let beat = 0; beat * intervalSamples < totalSamples; beat++) {
      const beatStart = beat * intervalSamples;
      for (let i = 0; i < Math.floor(sampleRate * 0.04) && beatStart + i < totalSamples; i++) {
        const env = 1.0 - i / (sampleRate * 0.04);
        signal[beatStart + i] += 0.8 * env * Math.sin((2 * Math.PI * 65 * i) / sampleRate);
      }
    }

    return signal;
  };

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fluxo-analysis-test-'));
    db = new FluxoDatabase({ inMemory: true });
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Handled
    }
  });

  it('P06-T001: WaveformPeakGenerator generates 100 pts/sec min/max peaks and handles .peaks binary caching', async () => {
    const generator = new WaveformPeakGenerator();
    const testSamples = create128BpmTestSignal(5); // 5 seconds = 500 points
    const waveform = generator.generatePeaks(testSamples, sampleRate, 100);

    expect(waveform.pointsPerSecond).toBe(100);
    expect(waveform.duration).toBeCloseTo(5, 1);
    expect(waveform.length).toBe(500);
    expect(waveform.minPeaks.length).toBe(500);
    expect(waveform.maxPeaks.length).toBe(500);

    // Binary file caching
    const peaksFile = path.join(tempDir, 'test.peaks');
    await generator.saveToFile(peaksFile, waveform);

    const loaded = await generator.loadFromFile(peaksFile);
    expect(loaded).not.toBeNull();
    expect(loaded?.length).toBe(500);
    expect(loaded?.sampleRate).toBe(sampleRate);
    expect(loaded?.maxPeaks[0]).toBeCloseTo(waveform.maxPeaks[0], 4);
  });

  it('P06-T002: OnsetBpmDetector estimates BPM with high precision on periodic beat signal', () => {
    const detector = new OnsetBpmDetector();
    const testSamples = create128BpmTestSignal(8);
    const result = detector.estimateBpm(testSamples, sampleRate);

    expect(result.bpm).toBeGreaterThanOrEqual(126);
    expect(result.bpm).toBeLessThanOrEqual(130);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.onsetEnvelope.length).toBeGreaterThan(0);
  });

  it('P06-T003: BeatGridGenerator aligns first downbeat and generates regular beat timestamps', () => {
    const detector = new OnsetBpmDetector();
    const beatGridGen = new BeatGridGenerator();
    const testSamples = create128BpmTestSignal(6);
    const bpmResult = detector.estimateBpm(testSamples, sampleRate);

    const gridResult = beatGridGen.generateBeatGrid(
      bpmResult.bpm,
      bpmResult.onsetEnvelope,
      bpmResult.frameRate,
      6.0
    );

    expect(gridResult.beatGrid.bpm).toBe(bpmResult.bpm);
    expect(gridResult.beatGrid.firstDownbeat).toBeGreaterThanOrEqual(0);
    expect(gridResult.beatGrid.firstDownbeat).toBeLessThan(1.0);
    expect(gridResult.beatTimestamps.length).toBeGreaterThan(10);
    expect(gridResult.downbeatTimestamps.length).toBeGreaterThan(2);
  });

  it('P06-T004: KeyClassifier classifies musical key and Camelot Wheel harmonic compatibility', () => {
    const classifier = new KeyClassifier();
    const testSamples = create128BpmTestSignal(3);
    const result = classifier.classifyKey(testSamples, sampleRate);

    expect(result.musicalKey).toBeDefined();
    expect(result.camelotCode).toMatch(/^(1[0-2]|[1-9])[AB]$/);
    expect(result.confidence).toBeGreaterThan(0);

    // Harmonic mixing compatibility checks
    expect(KeyClassifier.isHarmonicallyCompatible('8A', '8A')).toBe(true); // Exact
    expect(KeyClassifier.isHarmonicallyCompatible('8A', '8B')).toBe(true); // Relative Major
    expect(KeyClassifier.isHarmonicallyCompatible('8A', '7A')).toBe(true); // -1 step
    expect(KeyClassifier.isHarmonicallyCompatible('8A', '9A')).toBe(true); // +1 step
    expect(KeyClassifier.isHarmonicallyCompatible('12A', '1A')).toBe(true); // Wheel wrap-around
    expect(KeyClassifier.isHarmonicallyCompatible('8A', '3A')).toBe(false); // Incompatible
  });

  it('P06-T005: LoudnessAnalyzer measures integrated LUFS and True Peak', () => {
    const analyzer = new LoudnessAnalyzer();
    const testSamples = create128BpmTestSignal(4);
    const loudness = analyzer.analyzeLoudness(testSamples, sampleRate);

    expect(loudness.integratedLufs).toBeLessThan(0); // Standard digital loudness is negative dBFS
    expect(loudness.integratedLufs).toBeGreaterThan(-60);
    expect(loudness.truePeak).toBeLessThanOrEqual(0);
    expect(loudness.energyLevel).toBeGreaterThanOrEqual(0.0);
    expect(loudness.energyLevel).toBeLessThanOrEqual(1.0);
  });

  it('P06-T006: StructureEstimator identifies Intro, Drop, and Outro sections with suggested cues', () => {
    const estimator = new StructureEstimator();
    const testSamples = create128BpmTestSignal(20);
    const structure = estimator.estimateStructure(testSamples, sampleRate, 'test-trk', 20);

    expect(structure.sections.length).toBeGreaterThanOrEqual(3);
    expect(structure.dropTime).toBeGreaterThanOrEqual(0);
    expect(structure.outroTime).toBeGreaterThan(structure.dropTime);
    expect(structure.suggestedCuePoints.length).toBe(3);
    expect(structure.suggestedCuePoints[1].type).toBe('drop');
    expect(structure.suggestedCuePoints[2].type).toBe('outro');
  });

  it('P06-T007: AnalysisPipeline coordinates complete analysis and persists to SQLite database', async () => {
    const pipeline = new AnalysisPipeline(db, {
      peaksCacheDir: path.join(tempDir, 'peaks')
    });

    const track: TrackMetadata = {
      id: 'trk-pipeline-test',
      filePath: 'C:/Music/test.mp3',
      fileSize: 4000000,
      mtime: Date.now(),
      title: 'Solar Wave',
      artist: 'Aura',
      album: 'Visions',
      duration: 10,
      sampleRate: 44100,
      channels: 2,
      format: 'mp3',
      sourceType: 'local'
    };
    db.upsertTrack(track);

    const testSamples = create128BpmTestSignal(10);
    const analysis = await pipeline.analyzeTrack(track, testSamples, sampleRate);

    expect(analysis.trackId).toBe('trk-pipeline-test');
    expect(analysis.status).toBe('deep_ready');
    expect(analysis.bpm).toBeGreaterThan(120);
    expect(analysis.camelotCode).toBeDefined();

    // Verify SQLite persistence
    const saved = db.getAnalysis('trk-pipeline-test');
    expect(saved).not.toBeNull();
    expect(saved?.bpm).toBe(analysis.bpm);
    expect(saved?.camelotCode).toBe(analysis.camelotCode);

    // Verify cue points saved
    const cues = db.getCuePoints('trk-pipeline-test');
    expect(cues.length).toBeGreaterThanOrEqual(3);
    const cueTypes = cues.map((c) => c.type);
    expect(cueTypes).toContain('drop');
    expect(cueTypes).toContain('outro');
  });
});
