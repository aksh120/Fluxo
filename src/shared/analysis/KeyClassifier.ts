export interface KeyAnalysisResult {
  musicalKey: string; // e.g. "Am", "C", "F#m"
  camelotCode: string; // e.g. "8A", "8B", "11A"
  confidence: number;
}

// 12 Semitone note names
export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Krumhansl-Kessler Key Profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Camelot Wheel Table mapping key to Camelot code
export const CAMELOT_MAP: Record<string, string> = {
  // Major Keys (B)
  'C': '8B',
  'C#': '3B',
  'Db': '3B',
  'D': '10B',
  'D#': '5B',
  'Eb': '5B',
  'E': '12B',
  'F': '7B',
  'F#': '2B',
  'Gb': '2B',
  'G': '9B',
  'G#': '4B',
  'Ab': '4B',
  'A': '11B',
  'A#': '6B',
  'Bb': '6B',
  'B': '1B',

  // Minor Keys (A)
  'Am': '8A',
  'A#m': '3A',
  'Bbm': '3A',
  'Bm': '10A',
  'Cm': '5A',
  'C#m': '12A',
  'Dbm': '12A',
  'Dm': '7A',
  'D#m': '2A',
  'Ebm': '2A',
  'Em': '9A',
  'Fm': '4A',
  'F#m': '11A',
  'Gbm': '11A',
  'Gm': '6A',
  'G#m': '1A',
  'Abm': '1A'
};

export class KeyClassifier {
  /**
   * Computes 12-dimensional Pitch Class Profile (chroma vector) from PCM samples
   */
  public computeChromaVector(samples: Float32Array, sampleRate: number): Float32Array {
    const chroma = new Float32Array(12);
    const windowSize = 2048;
    const hopSize = 1024;
    const numFrames = Math.max(1, Math.floor((samples.length - windowSize) / hopSize));

    // A4 = 440 Hz standard pitch
    const a4 = 440.0;

    for (let f = 0; f < numFrames; f += 2) {
      // Sample alternate frames for fast DSP
      const start = f * hopSize;

      // Scan frequency bins via Goertzel or simplified band energy
      for (let pitch = 0; pitch < 12; pitch++) {
        // Find fundamental frequencies for this pitch class across octaves (octaves 2 to 5)
        let pitchEnergy = 0.0;
        for (let oct = 2; oct <= 5; oct++) {
          const semitonesFromA4 = pitch - 9 + (oct - 4) * 12;
          const freq = a4 * Math.pow(2, semitonesFromA4 / 12);
          const period = Math.round(sampleRate / freq);

          if (period > 0 && period < windowSize) {
            // Autocorrelation at period corresponds to energy at fundamental freq
            for (let i = 0; i < windowSize - period; i += 4) {
              const s1 = samples[start + i];
              const s2 = samples[start + i + period];
              pitchEnergy += Math.abs(s1 * s2);
            }
          }
        }
        chroma[pitch] += pitchEnergy;
      }
    }

    // Normalize chroma vector to unit sum
    let sum = 0.0;
    for (let i = 0; i < 12; i++) sum += chroma[i];
    if (sum > 0) {
      for (let i = 0; i < 12; i++) chroma[i] /= sum;
    }

    return chroma;
  }

  /**
   * Correlates chroma vector against 24 major and minor key profiles
   */
  public classifyKey(samples: Float32Array, sampleRate: number): KeyAnalysisResult {
    const chroma = this.computeChromaVector(samples, sampleRate);

    let bestKey = 'C';
    let bestCorr = -Infinity;
    let runnerUpCorr = -Infinity;

    // Test 12 Major Keys
    for (let root = 0; root < 12; root++) {
      const corr = this.correlateProfile(chroma, MAJOR_PROFILE, root);
      if (corr > bestCorr) {
        runnerUpCorr = bestCorr;
        bestCorr = corr;
        bestKey = PITCH_CLASSES[root];
      } else if (corr > runnerUpCorr) {
        runnerUpCorr = corr;
      }
    }

    // Test 12 Minor Keys
    for (let root = 0; root < 12; root++) {
      const corr = this.correlateProfile(chroma, MINOR_PROFILE, root);
      if (corr > bestCorr) {
        runnerUpCorr = bestCorr;
        bestCorr = corr;
        bestKey = `${PITCH_CLASSES[root]}m`;
      } else if (corr > runnerUpCorr) {
        runnerUpCorr = corr;
      }
    }

    const camelotCode = CAMELOT_MAP[bestKey] || '8A';
    const confidence = Math.min(
      1.0,
      Math.max(0.2, (bestCorr - (runnerUpCorr === -Infinity ? 0 : runnerUpCorr)) * 5)
    );

    return {
      musicalKey: bestKey,
      camelotCode,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  private correlateProfile(chroma: Float32Array, template: number[], shift: number): number {
    let num = 0;
    let denomChroma = 0;
    let denomTemplate = 0;

    for (let i = 0; i < 12; i++) {
      const x = chroma[(i + shift) % 12];
      const y = template[i];
      num += x * y;
      denomChroma += x * x;
      denomTemplate += y * y;
    }

    const denom = Math.sqrt(denomChroma * denomTemplate);
    return denom > 0 ? num / denom : 0;
  }

  /**
   * Helper to check harmonic mixing compatibility between two Camelot codes:
   * Compatible if:
   * 1) Exact match (e.g. 8A and 8A)
   * 2) Adjacent wheel number with same letter (e.g. 8A with 7A or 9A)
   * 3) Relative Major/Minor toggle with same number (e.g. 8A with 8B)
   */
  public static isHarmonicallyCompatible(code1: string, code2: string): boolean {
    if (code1 === code2) return true;

    const num1 = parseInt(code1.slice(0, -1), 10);
    const letter1 = code1.slice(-1);
    const num2 = parseInt(code2.slice(0, -1), 10);
    const letter2 = code2.slice(-1);

    // Relative Major/Minor
    if (num1 === num2) return true;

    // Adjacent on the 12-hour wheel (wrap around 12 -> 1)
    if (letter1 === letter2) {
      const diff = Math.abs(num1 - num2);
      return diff === 1 || diff === 11;
    }

    return false;
  }
}
