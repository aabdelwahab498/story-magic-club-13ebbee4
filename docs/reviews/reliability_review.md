# Backend & AI Reliability Report — MVP v1.0

## 1. Exception Mapping & Error Handling
- **Consistency:** NestJS standard HTTP exceptions (`NotFoundException`, `InternalServerErrorException`) are consistently used in services/repositories to represent business errors.
- **AI Domain Errors:** Domain-specific exceptions (`AIValidationException`, `AIProviderException`) properly isolate AI pipeline failures from network-level failures.

## 2. Validation & Input Format
- Input is safely validated using DTOs (`CreateStoryRequestDto`).
- The controller correctly pipes parameters.

## 3. AI Pipeline Orchestration (`StoryGenerationOrchestrator`)
- **Success Path:** Works optimally, moving status sequentially through `DRAFT` -> `QUEUED` -> `GENERATING` -> `GENERATED`.
- **Gemini Provider:** Employs explicit timeouts (`Promise.race`) and retry logic (default 2 attempts) ensuring we don't hold the process open indefinitely.
- **Failure Path Vulnerability (Orphaned Generation Requests):**
  - **Identified Issue:** In the catch block of `StoryGenerationOrchestrator.generateStory`, the failure transition explicitly attempts to transition from `GENERATING` to `FAILED`. If an error occurs earlier in the pipeline (e.g., while fetching the child profile or building AI context when the status is `QUEUED`), the transition will throw an `InvalidStatusTransitionException`.
  - **Impact:** The request becomes orphaned and stuck in the `QUEUED` state indefinitely because it never successfully reaches `FAILED`, preventing the user from retrying.
  - **Resolution Plan:** Will update the catch block to fetch the actual current state of the request before attempting the transition to `FAILED`.

## Conclusion
The backend is largely stable and resilient to transient network errors. By addressing the orchestrator's state mismatch on early pipeline failures, the lifecycle manager will be completely watertight for the MVP release.
