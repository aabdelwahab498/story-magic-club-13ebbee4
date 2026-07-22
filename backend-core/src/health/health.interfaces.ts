/** Shape of the /health response body. */
export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

/** Shape of the /health/ready response body. */
export interface ReadyResponse {
  status: 'ready' | 'unhealthy';
  database: 'connected' | 'disconnected';
  redis?: string;
  pythonAi?: string;
  providers?: Record<string, string>;
}

/** Shape of the /health/version response body. */
export interface VersionResponse {
  version: string;
  stage: string;
}
