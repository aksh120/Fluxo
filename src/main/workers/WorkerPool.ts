import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { WorkerTaskRequest, WorkerTaskResponse } from './WorkerProtocol';

export interface WorkerPoolOptions {
  maxWorkers?: number;
  workerScriptPath?: string;
}

interface QueuedTask {
  request: WorkerTaskRequest;
  resolve: (value: WorkerTaskResponse) => void;
  reject: (reason?: any) => void;
  timeoutId?: NodeJS.Timeout;
}

interface ManagedWorker {
  id: number;
  worker: Worker;
  isBusy: boolean;
  activeTask: QueuedTask | null;
}

export class WorkerPool {
  private maxWorkers: number;
  private workerScript: string;
  private workers: ManagedWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private isTerminated = false;
  private nextWorkerId = 1;

  constructor(options: WorkerPoolOptions = {}) {
    // Polite CPU scheduling: use N - 1 cores (minimum 1)
    const cpus = os.cpus()?.length || 2;
    this.maxWorkers = options.maxWorkers || Math.max(1, cpus - 1);

    this.workerScript =
      options.workerScriptPath ||
      path.resolve(__dirname, 'AnalysisWorker.js');

    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): ManagedWorker {
    const workerId = this.nextWorkerId++;
    const worker = new Worker(this.workerScript);

    const managed: ManagedWorker = {
      id: workerId,
      worker,
      isBusy: false,
      activeTask: null
    };

    worker.on('message', (response: WorkerTaskResponse) => {
      this.handleWorkerMessage(managed, response);
    });

    worker.on('error', (err) => {
      console.warn(`[WorkerPool] Worker ${workerId} encountered error:`, err);
      this.handleWorkerCrash(managed, err);
    });

    worker.on('exit', (code) => {
      if (!this.isTerminated && code !== 0) {
        console.warn(`[WorkerPool] Worker ${workerId} exited with code ${code}, restarting...`);
        this.handleWorkerCrash(managed, new Error(`Worker exited with code ${code}`));
      }
    });

    this.workers.push(managed);
    return managed;
  }

  private handleWorkerMessage(managed: ManagedWorker, response: WorkerTaskResponse): void {
    const task = managed.activeTask;
    if (task && task.request.taskId === response.taskId) {
      if (task.timeoutId) clearTimeout(task.timeoutId);
      managed.isBusy = false;
      managed.activeTask = null;
      task.resolve(response);
      this.drainQueue();
    }
  }

  private handleWorkerCrash(managed: ManagedWorker, err: Error): void {
    // Fail any active task on this worker
    if (managed.activeTask) {
      if (managed.activeTask.timeoutId) clearTimeout(managed.activeTask.timeoutId);
      managed.activeTask.reject(err);
      managed.activeTask = null;
    }

    // Remove crashed worker from pool
    const idx = this.workers.indexOf(managed);
    if (idx !== -1) {
      this.workers.splice(idx, 1);
    }

    try {
      managed.worker.terminate();
    } catch {
      // Ignore
    }

    // Re-spawn replacement worker if pool is still running
    if (!this.isTerminated) {
      this.spawnWorker();
      this.drainQueue();
    }
  }

  private drainQueue(): void {
    if (this.isTerminated || this.taskQueue.length === 0) return;

    const idleWorker = this.workers.find((w) => !w.isBusy);
    if (!idleWorker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    idleWorker.isBusy = true;
    idleWorker.activeTask = task;
    idleWorker.worker.postMessage(task.request);
  }

  /**
   * Executes a task on the next available worker thread
   */
  public execute(request: WorkerTaskRequest, timeoutMs = 30000): Promise<WorkerTaskResponse> {
    if (this.isTerminated) {
      return Promise.reject(new Error('WorkerPool is already terminated'));
    }

    return new Promise((resolve, reject) => {
      const task: QueuedTask = {
        request,
        resolve,
        reject
      };

      if (timeoutMs > 0) {
        task.timeoutId = setTimeout(() => {
          // Remove from queue if still pending
          const qIdx = this.taskQueue.indexOf(task);
          if (qIdx !== -1) {
            this.taskQueue.splice(qIdx, 1);
          }
          reject(new Error(`Task ${request.taskId} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      this.taskQueue.push(task);
      this.drainQueue();
    });
  }

  public getWorkerCount(): number {
    return this.workers.length;
  }

  public getBusyWorkerCount(): number {
    return this.workers.filter((w) => w.isBusy).length;
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }

  public terminate(): Promise<number[]> {
    this.isTerminated = true;
    // Reject remaining queued tasks
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task?.timeoutId) clearTimeout(task.timeoutId);
      task?.reject(new Error('WorkerPool terminated'));
    }

    const promises = this.workers.map((w) => w.worker.terminate());
    this.workers = [];
    return Promise.all(promises);
  }
}
