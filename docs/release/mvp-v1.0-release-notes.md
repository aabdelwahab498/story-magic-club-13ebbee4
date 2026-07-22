# Najmah MVP Version 1.0 Release Notes

Welcome to Najmah Version 1.0! This release marks the official baseline of our Minimum Viable Product (MVP). We have successfully established the foundational architecture and primary user flows required to generate beautiful, personalized, SEL-aligned stories for children.

## Product Overview
Najmah MVP is an intelligent storytelling platform. Parents can securely register, set up individual profiles for their children (including specific ages, languages, and emotional development interests), and invoke an AI storyteller to craft localized, age-appropriate narratives in seconds. 

## The Core User Journey
1. **Register**: Parents create an account securely via the new backend authentication gateway.
2. **Create Child**: Parents define parameters like "Arabic," "5 years old," and "Courage" into a dedicated child profile.
3. **Generate Story**: Upon requesting a story, our orchestration layer triggers a Hybrid AI Gateway (utilizing OpenAI or Gemini) to architect a 4-act story blueprint and write the final text.
4. **Read Story**: The completed story is delivered instantly to a high-fidelity reading mode, supporting multi-language (RTL) reading, pagination, and intuitive reading progress indicators.

## Technical Stack Overview
- **Frontend Layer**: React 18 powered by Vite, leveraging TypeScript, Tailwind CSS, and `shadcn/ui` components for a modern, decoupled user interface.
- **Backend API Gateway**: A robust NestJS environment serving as the ultimate authority for data manipulation, authentication guards, and API orchestration.
- **AI Intelligence Layer**: A FastAPI (Python) microservice managing the volatile LLM interactions, enforcing schemas, and ensuring safety standards are met before stories are finalized.

## Known Limitations (Next Up in Sprint 11+)
This MVP freeze intentionally bounds the platform's features to ensure unmatched stability. As a result, the following capabilities are explicitly omitted from Version 1.0 and will be addressed in future phases:
- **Illustrations**: AI Image Generation for storybook pages is currently bypassed.
- **Audio Narration**: TTS (Text-to-Speech) read-along audio is under active prototyping and not included here.
- **Subscriptions / Payments**: Stripe integration is disabled.
- **PDF Export**: Print-ready PDF compilation is out of scope.
- **Advanced Personalization**: Persistent Character Bibles mimicking visual continuity across distinct stories will arrive in later modules.
