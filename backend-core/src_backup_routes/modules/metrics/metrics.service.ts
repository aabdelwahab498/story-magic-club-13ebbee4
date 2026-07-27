import { Injectable } from '@nestjs/common';

class Histogram {
  private buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];
  private bucketCounts: Record<number, number> = {};
  private count = 0;
  private sum = 0;

  constructor() {
    for (const b of this.buckets) {
      this.bucketCounts[b] = 0;
    }
  }

  observe(valSeconds: number): void {
    this.count++;
    this.sum += valSeconds;
    for (const b of this.buckets) {
      if (valSeconds <= b) {
        this.bucketCounts[b]++;
      }
    }
  }

  getPrometheusFormat(name: string, help: string): string {
    const lines = [
      `# HELP ${name} ${help}`,
      `# TYPE ${name} histogram`,
    ];
    for (const b of this.buckets) {
      lines.push(`${name}_bucket{le="${b}"} ${this.bucketCounts[b]}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${this.count}`);
    lines.push(`${name}_sum ${this.sum.toFixed(4)}`);
    lines.push(`${name}_count ${this.count}`);
    return lines.join('\n');
  }
}

@Injectable()
export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private storyGenerationTotal = 0;
  private illustrationGenerationTotal = 0;
  private audioGenerationTotal = 0;
  private pdfExportTotal = 0;

  private activeRequestsCount = 0;

  private httpRequestDuration = new Histogram();
  private aiGenerationDuration = new Histogram();
  private databaseQueryDuration = new Histogram();
  private aiProviderLatency = new Histogram();
  private fileProcessingDuration = new Histogram();

  incrementHttpRequests(): void {
    this.httpRequestsTotal++;
  }

  incrementHttpErrors(): void {
    this.httpErrorsTotal++;
  }

  incrementStoryGeneration(): void {
    this.storyGenerationTotal++;
  }

  incrementIllustrationGeneration(): void {
    this.illustrationGenerationTotal++;
  }

  incrementAudioGeneration(): void {
    this.audioGenerationTotal++;
  }

  incrementPdfExport(): void {
    this.pdfExportTotal++;
  }

  incrementActiveRequests(): void {
    this.activeRequestsCount++;
  }

  decrementActiveRequests(): void {
    this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
  }

  observeHttpRequestDuration(seconds: number): void {
    this.httpRequestDuration.observe(seconds);
  }

  observeAiGenerationDuration(seconds: number): void {
    this.aiGenerationDuration.observe(seconds);
  }

  observeDatabaseQueryDuration(seconds: number): void {
    this.databaseQueryDuration.observe(seconds);
  }

  observeAiProviderLatency(seconds: number): void {
    this.aiProviderLatency.observe(seconds);
  }

  observeFileProcessingDuration(seconds: number): void {
    this.fileProcessingDuration.observe(seconds);
  }

  getPrometheusFormat(): string {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const cpuSeconds = (cpu.user + cpu.system) / 1000000;

    return [
      `# HELP http_requests_total The total number of HTTP requests processed`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${this.httpRequestsTotal}`,
      ``,
      `# HELP http_errors_total The total number of failed HTTP requests`,
      `# TYPE http_errors_total counter`,
      `http_errors_total ${this.httpErrorsTotal}`,
      ``,
      `# HELP story_generation_total Total story planning and writing requests`,
      `# TYPE story_generation_total counter`,
      `story_generation_total ${this.storyGenerationTotal}`,
      ``,
      `# HELP illustration_generation_total Total illustration requests`,
      `# TYPE illustration_generation_total counter`,
      `illustration_generation_total ${this.illustrationGenerationTotal}`,
      ``,
      `# HELP audio_generation_total Total audio/TTS requests`,
      `# TYPE audio_generation_total counter`,
      `audio_generation_total ${this.audioGenerationTotal}`,
      ``,
      `# HELP pdf_export_total Total PDF export requests`,
      `# TYPE pdf_export_total counter`,
      `pdf_export_total ${this.pdfExportTotal}`,
      ``,
      `# HELP active_requests The number of currently active HTTP requests`,
      `# TYPE active_requests gauge`,
      `active_requests ${this.activeRequestsCount}`,
      ``,
      `# HELP memory_usage The heap memory used by the application in bytes`,
      `# TYPE memory_usage gauge`,
      `memory_usage ${memory.heapUsed}`,
      ``,
      `# HELP cpu_usage The CPU user + system time in seconds`,
      `# TYPE cpu_usage gauge`,
      `cpu_usage ${cpuSeconds.toFixed(4)}`,
      ``,
      this.httpRequestDuration.getPrometheusFormat(
        'http_request_duration_seconds',
        'HTTP request latency in seconds',
      ),
      ``,
      this.aiGenerationDuration.getPrometheusFormat(
        'ai_generation_duration_seconds',
        'AI generation latency in seconds',
      ),
      ``,
      this.databaseQueryDuration.getPrometheusFormat(
        'database_query_duration_seconds',
        'Database query execution latency in seconds',
      ),
      ``,
      this.aiProviderLatency.getPrometheusFormat(
        'ai_provider_latency_seconds',
        'AI provider (Gemini/External) execution latency in seconds',
      ),
      ``,
      this.fileProcessingDuration.getPrometheusFormat(
        'file_processing_duration_seconds',
        'File generation (PDF/TTS) processing latency in seconds',
      ),
    ].join('\n');
  }
}
