# Python AI Service Architecture

## 1. Introduction
With the release of Najmah MVP v1.0, the core platform architecture relies heavily on NestJS for business logic, authentication, multi-tenancy, and routing. However, as the platform's AI capabilities expand (e.g., utilizing advanced Agent frameworks like LangGraph, or custom PyTorch models), a dedicated AI service becomes necessary.

Python is the industry standard for AI development. To future-proof Najmah, we have introduced the `ai-service`—a Python microservice using FastAPI and Pydantic.

## 2. Service Boundaries

### What belongs in NestJS?
- **Authentication & RBAC**: Managing user sessions, JWTs, and permissions.
- **Database Interaction**: Reading/writing to Supabase (`stories`, `users`, `children`, etc.).
- **Lifecycle Management**: Tracking a story's status from `Draft` -> `Generating` -> `Generated` -> `Failed`.
- **API Gateway**: Exposing public endpoints to the frontend.
- **Quota & Payments**: Managing credits, Stripe subscriptions, and rate limiting.

### What belongs in Python (`ai-service`)?
- **AI Intelligence**: Prompt construction, LLM interaction (Gemini/OpenAI), parsing AI output, and agentic workflows.
- **No Database Access**: The Python service is completely stateless. It does not have access to Supabase or the main database.
- **No Business Logic**: It should not know about "Users" or "Credits". It simply receives a `StoryContext` and returns a `StoryPlan` or `GeneratedStory`.

## 3. Communication Protocol
The NestJS application communicates with the Python service synchronously via REST API over HTTP.

**Data Flow Example (Story Planning)**:
1. Frontend calls `POST /api/v2/stories/generate` on NestJS.
2. NestJS validates the user, checks quota, and updates status to `Generating`.
3. NestJS builds the `StoryContext`.
4. NestJS sends `POST /ai/story/plan` to Python service with `StoryContext`.
5. Python service's `StoryPlanningAgent` calls Gemini LLM.
6. Python service returns `StoryPlan` JSON.
7. NestJS proceeds with writing the story.

**Contracts**: Both services must agree on JSON structures. Pydantic models in Python mirror the TypeScript interfaces in `@najmah/shared/src/contracts/ai`.

## 4. Future Roadmap
Currently, Python only handles the `StoryPlanningAgent`. The following phases are planned for upcoming sprints:
1. **StoryWriterAgent**: Move the actual story writing phase into Python.
2. **StoryValidatorAgent**: Move the post-generation validation into Python.
3. **LangGraph Integration**: Replace sequential logic with a LangGraph state machine.
4. **Asynchronous Queues**: Transition from synchronous HTTP calls to asynchronous message queues (e.g., RabbitMQ or Redis Pub/Sub) to handle long-running AI generations without blocking NestJS HTTP connections.
