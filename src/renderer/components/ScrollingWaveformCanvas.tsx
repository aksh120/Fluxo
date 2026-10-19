import React, { useRef, useEffect } from 'react';
import type { DeckState, BeatGrid } from '../../shared/types';
import type { WaveformData } from '../../shared/analysis/WaveformPeakGenerator';

export interface ScrollingWaveformCanvasProps {
  deckA: DeckState;
  deckB: DeckState;
  waveformA?: WaveformData | null;
  waveformB?: WaveformData | null;
  beatGridA?: BeatGrid | null;
  beatGridB?: BeatGrid | null;
  transitionMarker?: { startSec: number; endSec: number } | null;
  height?: number;
  pixelsPerSecond?: number; // Zoom level, default 60px/sec
  onSeekDeckA?: (seconds: number) => void;
  onSeekDeckB?: (seconds: number) => void;
}

export const ScrollingWaveformCanvas: React.FC<ScrollingWaveformCanvasProps> = ({
  deckA,
  deckB,
  waveformA,
  waveformB,
  beatGridA,
  beatGridB,
  transitionMarker,
  height = 160,
  pixelsPerSecond = 70,
  onSeekDeckA,
  onSeekDeckB
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      const halfH = h / 2;
      const playheadX = width / 2;

      // Clear Canvas Background
      ctx.fillStyle = '#0a0b10';
      ctx.fillRect(0, 0, width, h);

      // Center Divider line between Deck A & Deck B
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(width, halfH);
      ctx.stroke();

      // ==========================================
      // 1. Render Deck A Waveform (Top Half)
      // ==========================================
      renderDeckWaveform(
        ctx,
        deckA,
        waveformA,
        beatGridA,
        0,
        halfH,
        playheadX,
        pixelsPerSecond,
        '#00f2fe',
        'rgba(0, 242, 254, 0.35)',
        'rgba(0, 242, 254, 0.12)'
      );

      // ==========================================
      // 2. Render Deck B Waveform (Bottom Half)
      // ==========================================
      renderDeckWaveform(
        ctx,
        deckB,
        waveformB,
        beatGridB,
        halfH,
        halfH,
        playheadX,
        pixelsPerSecond,
        '#ff0080',
        'rgba(255, 0, 128, 0.35)',
        'rgba(255, 0, 128, 0.12)'
      );

      // ==========================================
      // 3. Render Transition Marker Zone if present
      // ==========================================
      if (transitionMarker && deckA.isPlaying) {
        const transStartX = playheadX + (transitionMarker.startSec - deckA.currentTime) * pixelsPerSecond;
        const transEndX = playheadX + (transitionMarker.endSec - deckA.currentTime) * pixelsPerSecond;
        if (transEndX > 0 && transStartX < width) {
          ctx.fillStyle = 'rgba(121, 40, 202, 0.18)';
          ctx.fillRect(Math.max(0, transStartX), 0, transEndX - transStartX, h);

          ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(Math.max(0, transStartX), 0, transEndX - transStartX, h);
        }
      }

      // ==========================================
      // 4. Center Playhead (Vertical Glowing Line)
      // ==========================================
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [deckA, deckB, waveformA, waveformB, beatGridA, beatGridB, transitionMarker, pixelsPerSecond]);

  const renderDeckWaveform = (
    ctx: CanvasRenderingContext2D,
    deck: DeckState,
    waveform: WaveformData | null | undefined,
    beatGrid: BeatGrid | null | undefined,
    topY: number,
    deckHeight: number,
    playheadX: number,
    pps: number,
    primaryColor: string,
    beatTickColor: string,
    downbeatColor: string
  ) => {
    const centerY = topY + deckHeight / 2;
    const maxAmplitude = deckHeight * 0.42;
    const currentTime = deck.currentTime;

    // A. Render Beat Grid Lines
    if (beatGrid && beatGrid.bpm > 0) {
      const beatInterval = 60 / beatGrid.bpm;
      const barInterval = beatInterval * 4;
      const firstDownbeat = beatGrid.firstDownbeat;

      // Find first visible beat on screen
      const screenStartTime = currentTime - playheadX / pps;
      const screenEndTime = currentTime + (ctx.canvas.width - playheadX) / pps;

      // Calculate starting beat index
      const startBeatIdx = Math.floor((screenStartTime - firstDownbeat) / beatInterval);
      const endBeatIdx = Math.ceil((screenEndTime - firstDownbeat) / beatInterval);

      for (let b = startBeatIdx; b <= endBeatIdx; b++) {
        const beatTime = firstDownbeat + b * beatInterval;
        const x = playheadX + (beatTime - currentTime) * pps;
        const isDownbeat = b % 4 === 0;

        ctx.strokeStyle = isDownbeat ? primaryColor : beatTickColor;
        ctx.lineWidth = isDownbeat ? 1.5 : 1.0;
        ctx.globalAlpha = isDownbeat ? 0.75 : 0.35;

        ctx.beginPath();
        ctx.moveTo(x, isDownbeat ? topY : topY + deckHeight * 0.25);
        ctx.lineTo(x, isDownbeat ? topY + deckHeight : topY + deckHeight * 0.75);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    // B. Render Peaks / Waveform Bars
    if (waveform && waveform.minPeaks.length > 0) {
      const ptsPerSec = waveform.pointsPerSecond;
      const currentPeakIdx = Math.floor(currentTime * ptsPerSec);
      const visiblePoints = Math.ceil((ctx.canvas.width / pps) * ptsPerSec);
      const startPeakIdx = Math.max(0, currentPeakIdx - Math.floor(visiblePoints / 2));
      const endPeakIdx = Math.min(waveform.length, startPeakIdx + visiblePoints);

      ctx.fillStyle = primaryColor;
      for (let i = startPeakIdx; i < endPeakIdx; i++) {
        const timeAtPoint = i / ptsPerSec;
        const x = playheadX + (timeAtPoint - currentTime) * pps;
        const minPeak = waveform.minPeaks[i] ?? 0;
        const maxPeak = waveform.maxPeaks[i] ?? 0;

        const yTop = centerY - Math.abs(maxPeak) * maxAmplitude;
        const yBottom = centerY + Math.abs(minPeak) * maxAmplitude;
        const barHeight = Math.max(2, yBottom - yTop);

        ctx.fillRect(x, yTop, 1.5, barHeight);
      }
    } else {
      // Synthetic fallback wave if deep peak buffer is still computing
      ctx.fillStyle = primaryColor;
      const barCount = 120;
      for (let i = 0; i < barCount; i++) {
        const x = (ctx.canvas.width / barCount) * i;
        const distFromPlayhead = (x - playheadX) / pps;
        const waveTime = currentTime + distFromPlayhead;
        const amp = deck.isPlaying
          ? 0.3 + 0.5 * Math.abs(Math.sin(waveTime * 5) * Math.cos(waveTime * 1.5))
          : 0.15;
        const barH = amp * maxAmplitude * 2;
        ctx.fillRect(x, centerY - barH / 2, 2.5, barH);
      }
    }

    // C. Deck Badge Overlay
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = primaryColor;
    ctx.fillText(deck.deckId === 'A' ? 'DECK A' : 'DECK B', 14, topY + 18);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const playheadX = canvas.width / 2;

    const deltaSec = (clickX - playheadX) / pixelsPerSecond;
    const isTopHalf = clickY < canvas.height / 2;

    if (isTopHalf && onSeekDeckA && deckA.duration > 0) {
      onSeekDeckA(Math.max(0, Math.min(deckA.duration, deckA.currentTime + deltaSec)));
    } else if (!isTopHalf && onSeekDeckB && deckB.duration > 0) {
      onSeekDeckB(Math.max(0, Math.min(deckB.duration, deckB.currentTime + deltaSec)));
    }
  };

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        backgroundColor: '#0a0b10',
        boxShadow: 'var(--shadow-md)',
        position: 'relative'
      }}
    >
      <canvas
        ref={canvasRef}
        width={960}
        height={height}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'block',
          cursor: 'pointer'
        }}
      />
    </div>
  );
};
