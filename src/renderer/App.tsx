import React, { useEffect, useState, useRef } from 'react';
import { AppHeader } from './components/AppHeader';
import { Sidebar, AppView } from './components/Sidebar';
import { NowPlayingBar } from './components/NowPlayingBar';
import { LibraryView } from './views/LibraryView';
import { PartyModeView } from './views/PartyModeView';
import { StudioView } from './views/StudioView';
import { BeginnerView } from './views/BeginnerView';
import { MixCreatorView } from './views/MixCreatorView';
import { YouTubeView } from './views/YouTubeView';
import { SettingsView } from './views/SettingsView';
import { AudioEngine } from './audio/AudioEngine';
import { QueueManager, QueueItem } from './state/QueueManager';
import { EnergyFlowOrchestrator, EnergyProfileType } from '../shared/dj/EnergyFlowOrchestrator';
import { PreferenceLearner } from '../shared/dj/PreferenceLearner';
import { KeyboardShortcutManager } from './utils/KeyboardShortcutManager';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { TrackMetadata, DeckState } from '../shared/types';

export default function App() {
  const [platformInfo, setPlatformInfo] = useState<{
    platform: string;
    version: string;
    ffmpegAvailable: boolean;
    pythonAvailable: boolean;
  } | null>(null);

  const [activeView, setActiveView] = useState<AppView>('library');
  const [tracks, setTracks] = useState<TrackMetadata[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<'A' | 'B'>('A');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimerRef = useRef<any>(null);

  const showErrorToast = (message: string) => {
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    setErrorToast(message);
    errorToastTimerRef.current = setTimeout(() => {
      setErrorToast(null);
    }, 4500);
  };

  const shortcutManagerRef = useRef<KeyboardShortcutManager | null>(null);
  const [crossfaderPos, setCrossfaderPos] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    phase: string;
    totalFiles: number;
    processedFiles: number;
    currentFile?: string;
  } | null>(null);

  // Audio Engine, Queue Manager, Party Orchestrator & Preference Learner
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const queueManagerRef = useRef<QueueManager>(new QueueManager());
  const energyOrchestratorRef = useRef<EnergyFlowOrchestrator>(new EnergyFlowOrchestrator('building'));
  const preferenceLearnerRef = useRef<PreferenceLearner>(
    new PreferenceLearner(
      typeof window !== 'undefined' && window.fluxoAPI
        ? {
            recordPlayEvent: (entry) => window.fluxoAPI.recordPlayEvent(entry),
            getTrackFeedbackStats: (trackId) => window.fluxoAPI.getTrackFeedbackStats(trackId),
            getArtistAffinity: (artist) => window.fluxoAPI.getArtistAffinity(artist)
          }
        : undefined
    )
  );
  const [activeProfile, setActiveProfile] = useState<EnergyProfileType>('building');
  const [, setQueueVersion] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  // Deck States for UI rendering
  const [deckAState, setDeckAState] = useState<DeckState>({
    deckId: 'A',
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    volume: 0.8,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 20000,
    filterResonance: 1.0
  });

  const [deckBState, setDeckBState] = useState<DeckState>({
    deckId: 'B',
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    volume: 0.8,
    isMuted: false,
    lowGain: 1.0,
    midGain: 1.0,
    highGain: 1.0,
    filterFreq: 20000,
    filterResonance: 1.0
  });

  // Initialize AudioEngine on mount
  useEffect(() => {
    try {
      const engine = AudioEngine.getInstance();
      audioEngineRef.current = engine;
    } catch (err) {
      console.warn('AudioEngine initialization deferred until user interaction:', err);
    }

    if (window.fluxoAPI) {
      window.fluxoAPI.getPlatformInfo().then(setPlatformInfo).catch(console.error);

      // Load persisted tracks from SQLite database
      window.fluxoAPI
        .getLibraryTracks()
        .then((persisted) => {
          if (persisted && persisted.length > 0) {
            setTracks(persisted);
            queueManagerRef.current.addTracks(persisted);
          }
        })
        .catch(console.error);

      // Listen for newly added or downloaded tracks
      if (window.fluxoAPI.onTrackAdded) {
        window.fluxoAPI.onTrackAdded((newTrack) => {
          setTracks((prev) => {
            if (prev.some((t) => t.id === newTrack.id)) return prev;
            return [newTrack, ...prev];
          });
          queueManagerRef.current.addTracks([newTrack]);
        });
      }

      // Listen for background directory scanner progress
      window.fluxoAPI.onScanProgress((prog) => {
        setScanProgress(prog);
        if (prog.phase === 'complete') {
          setIsScanning(false);
          window.fluxoAPI.getLibraryTracks().then(setTracks).catch(console.error);
        }
      });
    }
  }, []);

  const syncDeckStates = () => {
    const engine = audioEngineRef.current;
    if (engine) {
      setDeckAState(engine.deckA.getState());
      setDeckBState(engine.deckB.getState());
    }
  };

  // 60 FPS Real-Time Audio Timecode Synchronization Loop (active when playing)
  useEffect(() => {
    let animId: number;
    const updateTimecode = () => {
      const engine = audioEngineRef.current;
      if (engine && (engine.deckA.isPlaying || engine.deckB.isPlaying || isTransitioning)) {
        setDeckAState(engine.deckA.getState());
        setDeckBState(engine.deckB.getState());

        // Anticipatory next-track preloading into standby memory (30s before track finish)
        const activeDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
        if (activeDeck.isPlaying) {
          const items = queueManagerRef.current.getItems();
          const currIdx = queueManagerRef.current.getCurrentIndex();
          const nextItem = currIdx >= 0 && currIdx < items.length - 1 ? items[currIdx + 1] : null;
          if (nextItem) {
            engine.preloader.checkAndPreload(
              activeDeck.currentTime,
              activeDeck.duration,
              nextItem.track,
              window.fluxoAPI ? window.fluxoAPI.readAudioFile : undefined
            );
          }
        }
      }
      animId = requestAnimationFrame(updateTimecode);
    };

    animId = requestAnimationFrame(updateTimecode);
    animFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isTransitioning]);

  const handlePlayPause = () => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    engine.contextManager.resume();

    const activeDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
    if (activeDeck.isPlaying) {
      activeDeck.pause();
    } else {
      activeDeck.play();
    }
    syncDeckStates();
  };

  const handleSeek = (time: number) => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    const activeDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
    activeDeck.seek(time);
    syncDeckStates();
  };

  const handleVolumeChange = (vol: number) => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    const activeDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
    activeDeck.setVolume(vol);
    syncDeckStates();
  };

  const handleCrossfaderChange = (pos: number) => {
    setCrossfaderPos(pos);
    const engine = audioEngineRef.current;
    if (engine) {
      engine.setCrossfader(pos);
      syncDeckStates();
    }
  };

  const handleTriggerTransition = (style?: any) => {
    const engine = audioEngineRef.current;
    if (!engine || isTransitioning) return;

    setIsTransitioning(true);

    const fromDeckId = activeDeckId;
    const toDeckId = activeDeckId === 'A' ? 'B' : 'A';
    const targetDeck = toDeckId === 'A' ? engine.deckA : engine.deckB;

    const outgoingDeck = fromDeckId === 'A' ? engine.deckA : engine.deckB;
    const outgoingTrack = outgoingDeck.currentTrack;

    if (!targetDeck.isPlaying) {
      targetDeck.play(0);
    }

    engine.triggerTransition(
      {
        fromDeck: fromDeckId,
        toDeck: toDeckId,
        preferredStyle: style || 'bass_swap',
        durationBars: 8,
        onComplete: () => {
          setActiveDeckId(toDeckId);
          setIsTransitioning(false);
          syncDeckStates();
          if (outgoingTrack) {
            preferenceLearnerRef.current.recordCompletion(outgoingTrack, outgoingDeck.duration);
          }
        }
      },
      null
    );
  };

  const handlePlayNext = async () => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    const activeDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
    const current = activeDeck.currentTrack;
    if (current) {
      preferenceLearnerRef.current.recordSkip(current, activeDeck.currentTime);
    }

    const next = queueManagerRef.current.advance();
    if (next) {
      await handlePlayTrack(next);
    }
  };

  // Attach and bind Global Keyboard Shortcuts
  useEffect(() => {
    const manager = new KeyboardShortcutManager();
    shortcutManagerRef.current = manager;
    manager.attach();

    return () => {
      manager.detach();
    };
  }, []);

  useEffect(() => {
    const manager = shortcutManagerRef.current;
    if (!manager) return;

    manager.setActions({
      onPlayPause: () => {
        handlePlayPause();
      },
      onTriggerTransition: () => {
        handleTriggerTransition();
      },
      onNudgeDeck: (dir) => {
        const engine = audioEngineRef.current;
        if (engine) {
          const deck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
          engine.beatSync.nudge(deck, dir === 'up' ? 1 : -1);
          syncDeckStates();
        }
      },
      onJumpCue: (cueIdx) => {
        const engine = audioEngineRef.current;
        if (engine) {
          const deck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
          deck.jumpToCue(cueIdx);
          syncDeckStates();
        }
      },
      onToggleLoop: () => {
        const engine = audioEngineRef.current;
        if (engine) {
          const deck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
          deck.loopController.getState().isActive ? deck.exitLoop() : deck.activateLoop();
          syncDeckStates();
        }
      },
      onToggleMute: () => {
        const engine = audioEngineRef.current;
        if (engine) {
          const deck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
          const isMuted = deck.getState().isMuted;
          deck.setMute(!isMuted);
          syncDeckStates();
        }
      },
      onSwitchActiveDeck: () => {
        setActiveDeckId((prev) => (prev === 'A' ? 'B' : 'A'));
      },
      onToggleHelp: () => {
        setIsShortcutsModalOpen((prev) => !prev);
      }
    });
  }, [activeDeckId, isTransitioning]);

  const handleSelectVibe = (profile: EnergyProfileType) => {
    setActiveProfile(profile);
    energyOrchestratorRef.current.setActiveProfile(profile);
    queueManagerRef.current.resequenceUpcoming(
      energyOrchestratorRef.current,
      preferenceLearnerRef.current
    );
    setQueueVersion((v) => v + 1);
  };

  const handlePinTrack = (itemId: string) => {
    queueManagerRef.current.togglePin(itemId);
    setQueueVersion((v) => v + 1);
  };

  // Subscribe to queue changes
  useEffect(() => {
    const unsub = queueManagerRef.current.subscribe(() => {
      setQueueVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  const handleImportFolder = async () => {
    if (window.fluxoAPI) {
      const folder = await window.fluxoAPI.selectMusicDirectory();
      if (folder) {
        setIsScanning(true);
        const imported = await window.fluxoAPI.scanMusicDirectory(folder);
        if (imported && imported.length > 0) {
          setTracks((prev) => {
            const map = new Map<string, TrackMetadata>();
            for (const t of prev) map.set(t.id, t);
            for (const t of imported) map.set(t.id, t);
            return Array.from(map.values());
          });
        }
        setIsScanning(false);
      }
    }
  };

  const handleImportFiles = async () => {
    if (window.fluxoAPI) {
      const files = await window.fluxoAPI.openAudioFiles();
      if (files.length > 0) {
        setIsScanning(true);
        const imported = await window.fluxoAPI.importAudioFiles(files);
        if (imported && imported.length > 0) {
          setTracks((prev) => {
            const map = new Map<string, TrackMetadata>();
            for (const t of prev) map.set(t.id, t);
            for (const t of imported) map.set(t.id, t);
            return Array.from(map.values());
          });
        }
        setIsScanning(false);
      }
    }
  };

  const handleLoadDeck = async (deckId: 'A' | 'B', track: TrackMetadata) => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    engine.contextManager.resume();

    // Check if track is already decoded in standby memory (< 10ms instant start)
    let buffer: AudioBuffer | null = engine.preloader.getPreloadedBuffer(track.id);

    if (!buffer) {
      if (window.fluxoAPI && track.filePath && !track.filePath.startsWith('internal://')) {
        try {
          const arrayBuf = await window.fluxoAPI.readAudioFile(track.filePath);
          buffer = await engine.decoder.decodeAudio(arrayBuf);
        } catch (err: any) {
          showErrorToast(`Unable to load "${track.title || 'Track'}": ${err?.message || 'File corrupted or truncated'}`);
          return;
        }
      } else if (!window.fluxoAPI) {
        // Unit test runner fallback
        buffer = engine.decoder.createTestBuffer(track.duration || 180, 0, 44100);
      } else {
        showErrorToast(`Cannot load track: audio file not found on disk.`);
        return;
      }
    }

    const targetDeck = deckId === 'A' ? engine.deckA : engine.deckB;
    targetDeck.loadTrack(buffer, track);
    syncDeckStates();
  };

  const handleAddToQueue = (track: TrackMetadata, playNext = false) => {
    queueManagerRef.current.addTrack(track, playNext);
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (window.fluxoAPI) {
      await window.fluxoAPI.deleteLibraryTrack(trackId);
    }
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handlePlayTrack = async (track: TrackMetadata) => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    engine.contextManager.resume();

    // Instant warm start from standby cache if available
    let buffer: AudioBuffer | null = engine.preloader.getPreloadedBuffer(track.id);

    if (!buffer) {
      if (window.fluxoAPI && track.filePath && !track.filePath.startsWith('internal://')) {
        try {
          const arrayBuf = await window.fluxoAPI.readAudioFile(track.filePath);
          buffer = await engine.decoder.decodeAudio(arrayBuf);
        } catch (err: any) {
          showErrorToast(`Unable to play "${track.title || 'Track'}": ${err?.message || 'File corrupted or truncated'}`);
          // Gracefully advance queue to next track
          const next = queueManagerRef.current.advance();
          if (next) {
            handlePlayTrack(next);
          }
          return;
        }
      } else if (!window.fluxoAPI) {
        // Unit test runner fallback
        buffer = engine.decoder.createTestBuffer(track.duration || 180, 0, 44100);
      } else {
        showErrorToast(`Cannot play track: audio file not found on disk.`);
        return;
      }
    }

    const targetDeck = activeDeckId === 'A' ? engine.deckA : engine.deckB;
    targetDeck.loadTrack(buffer, track);
    targetDeck.play(0);
    syncDeckStates();
  };

  const currentTrack = activeDeckId === 'A' ? deckAState.currentTrack : deckBState.currentTrack;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Frameless Custom Window Titlebar */}
      <AppHeader platformInfo={platformInfo} />

      {/* Main App Frame: Sidebar + Dynamic Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Scrollable View Container */}
        <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
          <div style={{ height: '100%', maxWidth: '1440px', margin: '0 auto' }}>
            <ErrorBoundary fallbackView={() => setActiveView('library')}>
            {activeView === 'library' && (
              <LibraryView
                tracks={tracks}
                onImportFolder={handleImportFolder}
                onImportFiles={handleImportFiles}
                onPlayTrack={handlePlayTrack}
                onLoadDeck={handleLoadDeck}
                onAddToQueue={handleAddToQueue}
                onDeleteTrack={handleDeleteTrack}
                isScanning={isScanning}
                scanProgress={scanProgress}
              />
            )}
            {activeView === 'party' && (
              <PartyModeView
                currentTrack={currentTrack}
                nextTrack={queueManagerRef.current.getUpcomingItems()[0]?.track}
                upcomingTracks={queueManagerRef.current.getUpcomingItems()}
                isPlaying={activeDeckId === 'A' ? deckAState.isPlaying : deckBState.isPlaying}
                currentTime={activeDeckId === 'A' ? deckAState.currentTime : deckBState.currentTime}
                duration={activeDeckId === 'A' ? deckAState.duration : deckBState.duration}
                isTransitioning={isTransitioning}
                onTriggerTransition={handleTriggerTransition}
                onSkipNext={handlePlayNext}
                onTogglePlay={handlePlayPause}
                onPinTrack={handlePinTrack}
                onSelectVibe={handleSelectVibe}
                activeProfile={activeProfile}
              />
            )}
            {activeView === 'studio' && (
              <StudioView
                deckA={deckAState}
                deckB={deckBState}
                onUpdateDeckA={(up) => {
                  const engine = audioEngineRef.current;
                  if (engine) {
                    if (up.isPlaying !== undefined) {
                      up.isPlaying ? engine.deckA.play() : engine.deckA.pause();
                    }
                    if (up.currentTime !== undefined) engine.deckA.seek(up.currentTime);
                    if (up.volume !== undefined) engine.deckA.setVolume(up.volume);
                    if (up.playbackRate !== undefined) engine.deckA.setPlaybackRate(up.playbackRate);
                    if (up.lowGain !== undefined) engine.deckA.setLowGain(up.lowGain);
                    if (up.midGain !== undefined) engine.deckA.setMidGain(up.midGain);
                    if (up.highGain !== undefined) engine.deckA.setHighGain(up.highGain);
                    if (up.filterFreq !== undefined) engine.deckA.setFilter('lowpass', up.filterFreq);
                  }
                }}
                onUpdateDeckB={(up) => {
                  const engine = audioEngineRef.current;
                  if (engine) {
                    if (up.isPlaying !== undefined) {
                      up.isPlaying ? engine.deckB.play() : engine.deckB.pause();
                    }
                    if (up.currentTime !== undefined) engine.deckB.seek(up.currentTime);
                    if (up.volume !== undefined) engine.deckB.setVolume(up.volume);
                    if (up.playbackRate !== undefined) engine.deckB.setPlaybackRate(up.playbackRate);
                    if (up.lowGain !== undefined) engine.deckB.setLowGain(up.lowGain);
                    if (up.midGain !== undefined) engine.deckB.setMidGain(up.midGain);
                    if (up.highGain !== undefined) engine.deckB.setHighGain(up.highGain);
                    if (up.filterFreq !== undefined) engine.deckB.setFilter('lowpass', up.filterFreq);
                  }
                }}
                crossfaderPos={crossfaderPos}
                onCrossfaderChange={handleCrossfaderChange}
                onTriggerTransition={handleTriggerTransition}
                onSyncDeck={(deckId) => {
                  const engine = audioEngineRef.current;
                  if (engine) {
                    engine.syncDecks(deckId === 'A' ? 'B' : 'A');
                    syncDeckStates();
                  }
                }}
                onPitchBend={(deckId, dir) => {
                  const engine = audioEngineRef.current;
                  if (engine) {
                    const deck = deckId === 'A' ? engine.deckA : engine.deckB;
                    engine.beatSync.nudge(deck, dir);
                  }
                }}
                onSeekDeckA={(sec) => {
                  audioEngineRef.current?.deckA.seek(sec);
                  syncDeckStates();
                }}
                onSeekDeckB={(sec) => {
                  audioEngineRef.current?.deckB.seek(sec);
                  syncDeckStates();
                }}
                isTransitionActive={isTransitioning}
                onActivateLoopA={(len) => {
                  audioEngineRef.current?.deckA.activateLoop(len);
                }}
                onActivateLoopB={(len) => {
                  audioEngineRef.current?.deckB.activateLoop(len);
                }}
                onToggleLoopA={() => {
                  const deck = audioEngineRef.current?.deckA;
                  if (deck) {
                    deck.loopController.getState().isActive ? deck.exitLoop() : deck.activateLoop();
                  }
                }}
                onToggleLoopB={() => {
                  const deck = audioEngineRef.current?.deckB;
                  if (deck) {
                    deck.loopController.getState().isActive ? deck.exitLoop() : deck.activateLoop();
                  }
                }}
                onJumpCueA={(idx) => {
                  audioEngineRef.current?.deckA.jumpToCue(idx);
                  syncDeckStates();
                }}
                onJumpCueB={(idx) => {
                  audioEngineRef.current?.deckB.jumpToCue(idx);
                  syncDeckStates();
                }}
                onSetCueA={(idx) => {
                  audioEngineRef.current?.deckA.setCue(idx);
                }}
                onSetCueB={(idx) => {
                  audioEngineRef.current?.deckB.setCue(idx);
                }}
                onSetEchoMixA={(m) => {
                  audioEngineRef.current?.deckA.effectsChain.setEchoMix(m);
                }}
                onSetEchoMixB={(m) => {
                  audioEngineRef.current?.deckB.effectsChain.setEchoMix(m);
                }}
                onSetFlangerMixA={(m) => {
                  audioEngineRef.current?.deckA.effectsChain.setFlangerMix(m);
                }}
                onSetFlangerMixB={(m) => {
                  audioEngineRef.current?.deckB.effectsChain.setFlangerMix(m);
                }}
                onSeparateStemsA={async () => {
                  const track = deckAState.currentTrack;
                  if (track && window.fluxoAPI) {
                    await window.fluxoAPI.separateStems(track.id, track.filePath, track.sampleRate, track.duration);
                  }
                }}
                onSeparateStemsB={async () => {
                  const track = deckBState.currentTrack;
                  if (track && window.fluxoAPI) {
                    await window.fluxoAPI.separateStems(track.id, track.filePath, track.sampleRate, track.duration);
                  }
                }}
              />
            )}
            {activeView === 'beginner' && (
              <BeginnerView
                activeDeck={activeDeckId === 'A' ? deckAState : deckBState}
                standbyDeck={activeDeckId === 'A' ? deckBState : deckAState}
                nextTrack={queueManagerRef.current.getQueue()[0]?.track}
                onPlayToggle={handlePlayPause}
                onTriggerTransition={handleTriggerTransition}
                onSkipNext={handlePlayNext}
                onVolumeChange={handleVolumeChange}
                isTransitionActive={isTransitioning}
              />
            )}
            {activeView === 'creator' && <MixCreatorView libraryTracks={tracks} />}
            {activeView === 'youtube' && (
              <YouTubeView
                onLoadToDeck={(deckId, track) => handleLoadDeck(deckId, track)}
                onAddToQueue={(track) => handleAddToQueue(track)}
                onPlayTrack={(track) => handlePlayTrack(track)}
                onTrackExtracted={(track) => {
                  setTracks((prev) => {
                    if (prev.some((t) => t.id === track.id)) return prev;
                    return [track, ...prev];
                  });
                  queueManagerRef.current.addTracks([track]);
                }}
              />
            )}
            {activeView === 'settings' && <SettingsView platformInfo={platformInfo} />}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Docked Persistent Now Playing Bar with Real-Time Audio Timecode */}
      <NowPlayingBar
        currentTrack={currentTrack}
        deckA={deckAState}
        deckB={deckBState}
        activeDeckId={activeDeckId}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onTriggerTransition={handleTriggerTransition}
        isTransitioning={isTransitioning}
      />

      {/* Global Keyboard Shortcuts Cheatsheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Error Toast Notification (P14-T005) */}
      {errorToast && (
        <div
          data-testid="error-toast"
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '24px',
            backgroundColor: 'rgba(26, 12, 16, 0.95)',
            border: '1px solid #EF4444',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#FCA5A5',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <AlertTriangle size={16} color="#EF4444" />
          <span>{errorToast}</span>
        </div>
      )}
    </div>
  );
}
