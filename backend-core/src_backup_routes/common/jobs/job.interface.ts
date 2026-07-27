export interface JobPayload {
  type: string;
  data: Record<string, any>;
}

export interface JobResult<T = any> {
  success: boolean;
  jobId: string;
  data?: T;
  error?: string;
}

export interface JobHandler<P extends JobPayload = JobPayload, R = any> {
  handle(payload: P): Promise<JobResult<R>>;
}

export interface JobDispatcher {
  dispatch<P extends JobPayload = JobPayload, R = any>(
    type: string,
    data: P['data'],
  ): Promise<JobResult<R>>;
  registerHandler(type: string, handler: JobHandler): void;
}
