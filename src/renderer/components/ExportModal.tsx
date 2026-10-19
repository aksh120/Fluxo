import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Folder,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Radio,
  Sliders,
  Sparkles
} from 'lucide-react';
import { Button } from './Button';
import type { FluxoProject, ExportProgress, ExportSettings } from '../../shared/types';
import { formatTime } from '../utils/formatters';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FluxoProject;
  totalDuration: number;
  onStartExport: (settings: ExportSettings, outputPath: string) => Promise<void>;
  onCancelExport: () => void;
  progress: ExportProgress | null;
  isExporting: boolean;
  exportedResult: {
    outputPath: string;
    fileSize: number;
    duration: number;
    measuredLufs?: number;
  } | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  totalDuration,
  onStartExport,
  onCancelExport,
  progress,
  isExporting,
  exportedResult
}) => {
  const [format, setFormat] = useState<'mp3' | 'wav' | 'flac'>(project.exportSettings.format || 'mp3');
  const [bitrateKbps, setBitrateKbps] = useState<number>(project.exportSettings.bitrateKbps || 320);
  const [sampleRate, setSampleRate] = useState<number>(project.exportSettings.sampleRate || 44100);
  const [normalize, setNormalize] = useState<boolean>(project.exportSettings.normalize ?? true);
  const [targetLufs, setTargetLufs] = useState<number>(project.exportSettings.targetLufs || -14.0);
  const [outputPath, setOutputPath] = useState<string>('');

  useEffect(() => {
    if (isOpen && !outputPath) {
      const sanitizedName = (project.name || 'Fluxo_Mix').replace(/[^a-zA-Z0-9_-]/g, '_');
      setOutputPath(`C:\\Music\\${sanitizedName}.${format}`);
    }
  }, [isOpen, project.name, format]);

  if (!isOpen) return null;

  const handleBrowsePath = async () => {
    if (window.fluxoAPI) {
      const path = await window.fluxoAPI.selectExportAudioPath(project.name, format);
      if (path) setOutputPath(path);
    }
  };

  const handleStart = () => {
    onStartExport(
      {
        format,
        bitrateKbps,
        sampleRate,
        normalize,
        targetLufs
      },
      outputPath
    );
  };

  const handleOpenFolder = () => {
    if (exportedResult?.outputPath && window.fluxoAPI) {
      window.fluxoAPI.showItemInFolder(exportedResult.outputPath);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      data-testid="export-modal"
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#0F172A',
          border: '1px solid var(--border-glass-hover)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(79, 172, 254, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-cyan) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <Download size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Export Master Mix Audio
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                Faster-than-realtime offline mixdown with sample-accurate crossover curves
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px'
              }}
              title="Close modal"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Project</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {project.name || 'Untitled Set'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Tracks</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                {project.tracks.length} tracks
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Length</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-indigo)' }}>
                {formatTime(totalDuration)}
              </span>
            </div>
          </div>

          {/* Export In-Progress View */}
          {isExporting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {progress?.statusMessage || 'Rendering audio...'}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-cyan)'
                  }}
                >
                  {progress?.percentage || 0}%
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress?.percentage || 0}%`,
                    background: 'linear-gradient(90deg, var(--accent-indigo) 0%, var(--accent-cyan) 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease',
                    boxShadow: '0 0 12px rgba(79, 172, 254, 0.5)'
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}
              >
                <span>Phase: {progress?.phase || 'processing'}</span>
                <span>Elapsed: {progress?.elapsedSeconds || 0}s</span>
              </div>
            </div>
          ) : exportedResult ? (
            /* Export Complete View */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '16px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={22} color="#22C55E" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#22C55E' }}>
                  Export Finished Successfully!
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  fontSize: '12px'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>File Size</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatFileSize(exportedResult.fileSize)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Duration</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatTime(exportedResult.duration)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Measured Loudness</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    {exportedResult.measuredLufs !== undefined ? `${exportedResult.measuredLufs} LUFS` : 'Normalized'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-all',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px 10px',
                  borderRadius: '6px'
                }}
              >
                {exportedResult.outputPath}
              </div>
            </div>
          ) : (
            /* Configure Settings View */
            <>
              {/* Format selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  Audio Format & Quality
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <button
                    onClick={() => setFormat('mp3')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${format === 'mp3' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: format === 'mp3' ? 'rgba(79, 172, 254, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      color: format === 'mp3' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>MP3</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>320 kbps CBR High Quality</div>
                  </button>

                  <button
                    onClick={() => setFormat('flac')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${format === 'flac' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: format === 'flac' ? 'rgba(79, 172, 254, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      color: format === 'flac' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>FLAC</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Lossless Compressed Studio</div>
                  </button>

                  <button
                    onClick={() => setFormat('wav')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: `1px solid ${format === 'wav' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: format === 'wav' ? 'rgba(79, 172, 254, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      color: format === 'wav' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>WAV</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>16-bit PCM Uncompressed</div>
                  </button>
                </div>
              </div>

              {/* Sample rate and normalization */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Sample Rate
                  </label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value={44100}>44.1 kHz (Standard Audio CD)</option>
                    <option value={48000}>48.0 kHz (Pro Audio / Broadcast)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Target Loudness (EBU R128)
                  </label>
                  <select
                    value={normalize ? targetLufs : 'none'}
                    onChange={(e) => {
                      if (e.target.value === 'none') {
                        setNormalize(false);
                      } else {
                        setNormalize(true);
                        setTargetLufs(Number(e.target.value));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value={-14.0}>-14 LUFS (Streaming / Spotify)</option>
                    <option value={-9.0}>-9 LUFS (Club / High Energy DJ)</option>
                    <option value={-18.0}>-18 LUFS (Broadcast Standards)</option>
                    <option value="none">Disabled (Raw Un-normalized)</option>
                  </select>
                </div>
              </div>

              {/* Output Path Input */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Destination File Path
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={handleBrowsePath} leftIcon={<Folder size={14} />}>
                    Browse
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          {isExporting ? (
            <Button variant="danger" size="md" onClick={onCancelExport}>
              Cancel Export
            </Button>
          ) : exportedResult ? (
            <>
              <Button variant="secondary" size="md" onClick={handleOpenFolder} leftIcon={<Folder size={14} />}>
                Show in Folder
              </Button>
              <Button variant="primary" size="md" onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStart}
                leftIcon={<Download size={15} />}
                disabled={project.tracks.length === 0}
              >
                Render & Export Mix
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
