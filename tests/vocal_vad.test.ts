import { describe, it, expect } from 'vitest';
import { VocalActivityDetector } from '../src/shared/analysis/VocalActivityDetector';

describe('Phase 16 Music Understanding: VocalActivityDetector Tests', () => {
  it('P16-T001: detects vocal segments, instrumental windows, and calculates phrase boundaries', () => {
    const detector = new VocalActivityDetector();
    const sampleRate = 44100;
    const duration = 30.0; // 30 seconds
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);

    // Synthesize 5 seconds of instrumental intro (0s to 5s)
    // Low frequency sine wave (60Hz kick/bass)
    for (let i = 0; i < 5 * sampleRate; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 60 * i) / sampleRate);
    }

    // Synthesize 10 seconds of vocal singing (5s to 15s)
    // Rich harmonic spectrum in vocal band (440Hz A4, 880Hz, 1320Hz formants)
    for (let i = 5 * sampleRate; i < 15 * sampleRate; i++) {
      const t = i / sampleRate;
      samples[i] =
        0.4 * Math.sin(2 * Math.PI * 440 * t) +
        0.3 * Math.sin(2 * Math.PI * 880 * t) +
        0.2 * Math.sin(2 * Math.PI * 1320 * t);
    }

    // Synthesize 15 seconds of instrumental outro (15s to 30s)
    for (let i = 15 * sampleRate; i < 30 * sampleRate; i++) {
      samples[i] = 0.4 * Math.sin((2 * Math.PI * 80 * i) / sampleRate);
    }

    const bpm = 120; // 2.0s per bar, 8.0s per 4-bar phrase
    const result = detector.analyzeVocals(samples, sampleRate, bpm, 0.0, duration);

    expect(result.vocalSegments.length).toBeGreaterThan(0);
    // The vocal segment starts around 5s and ends around 15s
    const firstVocal = result.vocalSegments[0];
    expect(firstVocal.start).toBeGreaterThanOrEqual(4.5);
    expect(firstVocal.end).toBeLessThanOrEqual(16.0);
    expect(firstVocal.confidence).toBeGreaterThan(0.6);

    // Verify instrumental windows exist before and after vocal segment
    expect(result.instrumentalWindows.length).toBeGreaterThanOrEqual(1);

    // Verify phrase boundaries locked to 120 BPM (every 4 bars = 8.0 seconds)
    expect(result.phraseBoundaries.length).toBeGreaterThanOrEqual(3);
    expect(result.phraseBoundaries[0].timestamp).toBeCloseTo(0.0, 1);
    expect(result.phraseBoundaries[1].timestamp).toBeCloseTo(8.0, 1);
    expect(result.phraseBoundaries[2].timestamp).toBeCloseTo(16.0, 1);
  });

  it('P16-T001: evaluates vocal overlap clashing risk between two tracks', () => {
    const detector = new VocalActivityDetector();

    const trackAVocals = [
      { start: 10, end: 25, confidence: 0.9, averageEnergy: 0.8, isVocal: true }
    ];

    // Case 1: Track B has vocal at the exact same overlap timecode (Clash!)
    const trackBVocalsClash = [
      { start: 0, end: 12, confidence: 0.85, averageEnergy: 0.7, isVocal: true }
    ];

    // Overlap window: Track A 15s-23s, offsetBtoA = 15s (Track B starts at 0s when Track A is at 15s)
    const clashResult = detector.evaluateVocalOverlapRisk(
      trackAVocals,
      trackBVocalsClash,
      15, // overlapStartA
      23, // overlapEndA
      15  // offsetBtoA
    );

    expect(clashResult.riskScore).toBeLessThan(0.5);
    expect(clashResult.clashingRegions.length).toBeGreaterThan(0);

    // Case 2: Track B starts with clean instrumental intro (first 16s has no vocals) -> Safe!
    const trackBVocalsClean = [
      { start: 16, end: 30, confidence: 0.85, averageEnergy: 0.7, isVocal: true }
    ];

    const safeResult = detector.evaluateVocalOverlapRisk(
      trackAVocals,
      trackBVocalsClean,
      15,
      23,
      15
    );

    expect(safeResult.riskScore).toBe(1.0);
    expect(safeResult.clashingRegions.length).toBe(0);
  });
});
