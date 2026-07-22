# Production Monitoring Activation

Before launching, ensure monitoring tools are actively capturing telemetry.

## 1. Backend API Monitoring (Railway/Render)
The backend hosting provider automatically captures standard output (stdout) and standard error (stderr).
- **Log Aggregation**: Monitor the live logs via the provider's dashboard. Ensure that internal server errors (`500`) are clearly visible.
- **Health Probes**: The Load Balancer automatically hits `GET /api/v2/health` (or default endpoint). If the application becomes unresponsive, the platform will auto-restart the container.
- **Action Item**: Verify that `GET /api/v2/health` returns `200 OK`.

## 2. AI Pipeline Observability
The `ai_audit_logs` and `ai_story_history` tables act as an operational log for generation metrics.
- Track **Generation Failures**: Look for `status = 'failed'` in the lifecycle manager logs.
- Track **Duration**: Ensure generating stories doesn't regularly timeout (e.g., > 60 seconds).
- Track **Provider Errors**: Check for specific LLM timeout or API limit errors caught and logged by the NestJS application.

## 3. Database Monitoring (Supabase)
Supabase provides built-in reports in the dashboard.
- **Connection Issues**: Monitor the Database health tab for excessive connections or Postgres restart events.
- **API Requests**: Monitor API Edge network usage (Requests per second).
- **Storage**: Monitor bucket capacity and transfer metrics.

## 4. Frontend Error Tracking
- If enabled, verify integration with tools like Sentry to catch unhandled React exceptions in the browser.
- Ensure Vite is building with sourcemaps (if required) for easier debugging, but ensure they are not exposed to the public inappropriately.
