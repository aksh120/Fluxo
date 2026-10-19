import type { FluxoProject, TimelineTrack, TimelineTransition } from '../../shared/types';
import { LufsMeter, type LoudnessMeasurement } from './LufsMeter';

export interface RenderResult {
  channelData: Float32Array[];
  sampleRate: number;
  durationSeconds: number;
  totalSamples: number;
  loudness: LoudnessMeasurement;
  renderTimeMs: number;
}

export class OfflineMixRenderer {
  /**
   * Renders a FluxoProject into a multi-channel Float32Array PCM buffer
   * using high-speed, non-realtime sample-accurate mixing and DSP automation.
   */
  public static async renderProject(
    project: FluxoProject,
    trackBuffers: Map<string, AudioBuffer>,
    onProgress?: (progress: number, phase: string) => void
  ): Promise<RenderResult> {
    const startTime = performance.now();
    const sampleRate = project.exportSettings.sampleRate || 44100;

    if (onProgress) onProgress(0.05, 'Preparing timeline tracks...');

    if (project.tracks.length === 0) {
      const empty = [new Float32Array(0), new Float32Array(0)];
      return {
        channelData: empty,
        sampleRate,
        durationSeconds: 0,
        totalSamples: 0,
        loudness: LufsMeter.measure(empty, sampleRate),
        renderTimeMs: performance.now() - startTime
      };
    }

    // 1. Calculate total mix duration and allocate output channels
    let maxEndTime = 0;
    for (const trk of project.tracks) {
      const end = trk.offsetSeconds + trk.duration;
      if (end > maxEndTime) maxEndTime = end;
    }

    const totalSamples = Math.ceil(maxEndTime * sampleRate);
    const numChannels = 2; // Stereo master
    const outputChannels = [
      new Float32Array(totalSamples),
      new Float32Array(totalSamples)
    ];

    if (onProgress) onProgress(0.15, 'Rendering track layers & transitions...');

    // 2. Mix each track into the master output buffer with automated transition envelopes
    for (let i = 0; i < project.tracks.length; i++) {
      const track = project.tracks[i];
      const buf = trackBuffers.get(track.id) || trackBuffers.get(track.trackId);

      if (!buf) {
        console.warn(`Buffer not found for timeline track ${track.title} (${track.id}), skipping.`);
        continue;
      }

      // Incoming transition (if i > 0)
      const incomingTransition = i > 0
        ? project.transitions.find(
            (t) => t.fromTrackId === project.tracks[i - 1].id && t.toTrackId === track.id
          )
        : null;

      // Outgoing transition (if i < tracks.length - 1)
      const outgoingTransition = i < project.tracks.length - 1
        ? project.transitions.find(
            (t) => t.fromTrackId === track.id && t.toTrackId === project.tracks[i + 1].id
          )
        : null;

      const trackStartSample = Math.round(track.offsetSeconds * sampleRate);
      const trackDurationSamples = Math.min(
        Math.round(track.duration * sampleRate),
        buf.length
      );

      const bufLeft = buf.getChannelData(0);
      const bufRight = buf.numberOfChannels > 1 ? buf.getChannelData(1) : bufLeft;

      // Calculate sample boundaries for incoming transition
      const incomingOverlapSamples = incomingTransition
        ? Math.round(incomingTransition.overlapSeconds * sampleRate)
        : 0;

      // Calculate sample boundaries for outgoing transition
      const outgoingOverlapSamples = outgoingTransition
        ? Math.round(outgoingTransition.overlapSeconds * sampleRate)
        : 0;
      const outgoingFadeStartSample = trackDurationSamples - outgoingOverlapSamples;

      // Filter state for bass swap or filter sweep
      let filterStateL = 0;
      let filterStateR = 0;

      for (let s = 0; s < trackDurationSamples; s++) {
        const outIdx = trackStartSample + s;
        if (outIdx >= totalSamples) break;

        // Base volume and track EQ gain
        let gain = track.volume ?? 1.0;

        // Apply incoming transition envelope
        if (incomingTransition && s < incomingOverlapSamples) {
          const p = s / incomingOverlapSamples; // 0.0 -> 1.0
          if (incomingTransition.style === 'smooth') {
            // Equal-power sine fade in
            gain *= Math.sin(p * Math.PI * 0.5);
          } else if (incomingTransition.style === 'bass_swap') {
            gain *= p; // Linear mids/highs ramp
          } else if (incomingTransition.style === 'filter_sweep') {
            gain *= Math.sin(p * Math.PI * 0.5);
          } else {
            // Drop cut at midpoint
            gain *= p >= 0.5 ? 1.0 : 0.0;
          }
        }

        // Apply outgoing transition envelope
        if (outgoingTransition && s >= outgoingFadeStartSample) {
          const p = (s - outgoingFadeStartSample) / outgoingOverlapSamples; // 0.0 -> 1.0
          if (outgoingTransition.style === 'smooth') {
            // Equal-power cosine fade out
            gain *= Math.cos(p * Math.PI * 0.5);
          } else if (outgoingTransition.style === 'bass_swap') {
            gain *= 1.0 - p;
          } else if (outgoingTransition.style === 'filter_sweep') {
            gain *= Math.cos(p * Math.PI * 0.5);
          } else {
            // Drop cut at midpoint
            gain *= p < 0.5 ? 1.0 : 0.0;
          }
        }

        // Bass swap low-band kill
        let sLeft = bufLeft[s] * gain;
        let sRight = bufRight[s] * gain;

        if (outgoingTransition && s >= outgoingFadeStartSample && outgoingTransition.style === 'bass_swap') {
          const p = (s - outgoingFadeStartSample) / outgoingOverlapSamples;
          if (p >= 0.5) {
            // High-pass filter outgoing track to remove bass
            const alpha = 0.85;
            filterStateL = alpha * (filterStateL + sLeft - bufLeft[Math.max(0, s - 1)] * gain);
            filterStateR = alpha * (filterStateR + sRight - bufRight[Math.max(0, s - 1)] * gain);
            sLeft = filterStateL;
            sRight = filterStateR;
          }
        }

        outputChannels[0][outIdx] += sLeft;
        outputChannels[1][outIdx] += sRight;
      }

      if (onProgress) {
        const prog = 0.15 + 0.65 * ((i + 1) / project.tracks.length);
        onProgress(prog, `Rendered track ${i + 1} of ${project.tracks.length}: ${track.title}`);
      }
    }

    if (onProgress) onProgress(0.85, 'Analyzing loudness and normalizing...');

    // 3. Loudness Measurement & Normalization (ITU-R BS.1770 / EBU R128)
    let loudnessMeasurement: LoudnessMeasurement;
    if (project.exportSettings.normalize) {
      loudnessMeasurement = LufsMeter.normalize(
        outputChannels,
        sampleRate,
        project.exportSettings.targetLufs || -14.0
      );
    } else {
      loudnessMeasurement = LufsMeter.measure(
        outputChannels,
        sampleRate,
        project.exportSettings.targetLufs || -14.0
      );
    }

    if (onProgress) onProgress(1.0, 'Rendering complete!');

    const renderTimeMs = performance.now() - startTime;
    return {
      channelData: outputChannels,
      sampleRate,
      durationSeconds: Math.round(maxEndTime * 100) / 100,
      totalSamples,
      loudness: loudnessMeasurement,
      renderTimeMs: Math.round(renderTimeMs)
    };
  }
}
