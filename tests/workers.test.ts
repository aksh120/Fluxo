import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { WorkerPool } from '../src/main/workers/WorkerPool';
import type { WorkerTaskRequest } from '../src/main/workers/WorkerProtocol';

describe('Phase 5 Background Worker Process Pool & IPC Tests', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool({
      maxWorkers: 2,
      workerScriptPath: path.resolve(__dirname, '../src/main/workers/AnalysisWorker.js')
    });
  });

  afterEach(async () => {
    await pool.terminate();
  });

  it('P05-T003: initializes worker pool with configured worker count', () => {
    expect(pool.getWorkerCount()).toBe(2);
    expect(pool.getBusyWorkerCount()).toBe(0);
    expect(pool.getQueueLength()).toBe(0);
  });

  it('P05-T004: sends PING and receives PONG over typed worker channel', async () => {
    const request: WorkerTaskRequest = {
      taskId: 'test-ping-1',
      type: 'PING',
      payload: {
        trackId: 'test-trk',
        filePath: 'C:/Music/test.mp3'
      }
    };

    const response = await pool.execute(request);
    expect(response.taskId).toBe('test-ping-1');
    expect(response.type).toBe('PONG');
    expect(response.success).toBe(true);
  });

  it('P05-T004: analyzes track and returns BPM, Camelot, and BeatGrid asynchronously', async () => {
    const request: WorkerTaskRequest = {
      taskId: 'task-analyze-101',
      type: 'ANALYZE_TRACK',
      payload: {
        trackId: 'trk-edm-hit',
        filePath: 'C:/Music/edm.mp3'
      }
    };

    const response = await pool.execute(request);
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.trackId).toBe('trk-edm-hit');
    expect(response.data?.bpm).toBeGreaterThanOrEqual(120);
    expect(response.data?.bpm).toBeLessThanOrEqual(135);
    expect(response.data?.camelotCode).toBeDefined();
    expect(response.data?.beatGrid?.confidence).toBeGreaterThan(0.9);
  });

  it('P05-T003: queues multiple parallel tasks and distributes across workers', async () => {
    const tasks: WorkerTaskRequest[] = Array.from({ length: 6 }, (_, i) => ({
      taskId: `task-bulk-${i}`,
      type: 'ANALYZE_TRACK',
      payload: {
        trackId: `track-${i}`,
        filePath: `C:/Music/track-${i}.mp3`
      }
    }));

    const results = await Promise.all(tasks.map((t) => pool.execute(t)));
    expect(results.length).toBe(6);
    for (const res of results) {
      expect(res.success).toBe(true);
      expect(res.data?.bpm).toBeDefined();
    }
  });
});
