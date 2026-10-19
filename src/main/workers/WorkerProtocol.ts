export type WorkerMessageType =
  | 'PING'
  | 'PONG'
  | 'ANALYZE_TRACK'
  | 'ANALYSIS_RESULT'
  | 'ERROR'
  | 'SHUTDOWN';

export interface WorkerTaskRequest {
  taskId: string;
  type: WorkerMessageType;
  payload: {
    trackId: string;
    filePath: string;
    metadata?: Record<string, unknown>;
  };
}

export interface WorkerTaskResponse {
  taskId: string;
  type: WorkerMessageType;
  success: boolean;
  data?: {
    trackId: string;
    bpm: number;
    bpmConfidence: number;
    musicalKey: string;
    camelotCode: string;
    energyLevel: number;
    integratedLufs: number;
    beatGrid: {
      firstDownbeat: number;
      bpm: number;
      interval: number;
      confidence: number;
    };
  };
  error?: string;
}
