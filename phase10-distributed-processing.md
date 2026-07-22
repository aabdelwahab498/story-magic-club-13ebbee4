# Future Distributed Processing Plan (phase10-distributed-processing.md)

This document outlines the architectural roadmap for migrating long-running processes to asynchronous workers using BullMQ and Redis.

---

## 1. Candidate Jobs & Priorities

| Job Name | Priority | Target Timeout | Idempotency Key |
| :--- | :--- | :--- | :--- |
| **Story Generation** | High (Critical Path) | 60 seconds | `story:{userId}:{requestId}` |
| **Scene Illustrations** | Medium | 120 seconds | `illustrate:{storyId}:{pageIndex}` |
| **Audio Narrations (TTS)** | Medium | 60 seconds | `tts:{storyId}:{pageIndex}` |
| **PDF Generation** | Low | 180 seconds | `pdf:{storyId}` |
| **Payment Webhooks** | High (Transactional) | 15 seconds | `payment:{providerId}:{txId}` |

---

## 2. Queueing & Priority Strategy
* **Queue Isolation:** Distinct worker instances consume from separate queues (`high-priority-queue`, `media-queue`, `export-queue`) to prevent PDF generation tasks from blocking real-time story writing requests.
* **Concurrency Configuration:** Media workers stiching audio are CPU-intensive; they should restrict concurrency to `2-4` tasks per CPU core. Story planner workers (I/O bound REST queries) can scale up to `20-30` concurrent jobs.

---

## 3. Retries, Backoffs & Failure Handling
* **Exponential Backoff:** Outbound Gemini API calls must use exponential backoff:
  - Initial delay: 2s
  - Retries: 3
  - Max delay: 15s
* **Fail-Closed Verification:** If retry thresholds are exceeded, the job handler transitions status to `FAILED` and raises alerting alerts to Grafana.

---

## 4. Future Redis / BullMQ Integration Blueprint

```typescript
// Proposed future BullMQ Integration snippet
import { Queue } from 'bullmq';

@Injectable()
export class BullMQJobDispatcher implements JobDispatcher {
  private storyQueue = new Queue('story-generation', { connection: redisClient });

  async dispatch(type: string, data: any): Promise<JobResult> {
    const job = await this.storyQueue.add(type, data, {
      jobId: data.requestId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return { success: true, jobId: job.id };
  }
}
```
---

## 5. Idempotency Considerations
To prevent duplicate execution (e.g. double charging credits or double writing stories), every job dispatched contains a unique identifier (`requestId`). Workers check the status in the database prior to run execution; if the story status is already `GENERATED` or `PROCESSING`, the job is skipped or replayed from cache.
