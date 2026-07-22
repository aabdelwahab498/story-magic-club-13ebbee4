# Architecture Diagram

This document illustrates the migration of the frontend architecture.

## Current Architecture

Currently, the Lovable React frontend communicates directly with Supabase for almost all operations, bypassing the backend server entirely.

```mermaid
flowchart TD
    Frontend[Lovable React Frontend]
    
    subgraph Supabase BaaS
        Auth[Supabase Auth]
        DB[(PostgreSQL DB)]
        Edge[Edge Functions]
        Realtime[Realtime Channels]
        Storage[Supabase Storage]
    end

    Frontend -->|Session Management| Auth
    Frontend -->|Direct DB Queries| DB
    Frontend -->|Invoke Tasks| Edge
    Frontend -->|Subscribe to updates| Realtime
    Frontend -->|Asset Uploads| Storage
```

## Target Architecture

The target architecture enforces a strict boundary. The frontend will only communicate with the NestJS API, which securely orchestrates the required downstream services.

```mermaid
flowchart TD
    Frontend[Lovable React Frontend]
    
    subgraph Najmah Backend
        NestJS[NestJS API Server]
        Orchestrator[StoryGenerationOrchestrator]
        AIGateway[Hybrid AI Gateway]
    end
    
    subgraph Data & Infra
        DB[(PostgreSQL DB)]
        SupabaseAuth[Supabase Auth / Session]
    end

    subgraph AI Services
        FastAPI[Python AI Service]
        LLM[LLM Providers]
    end

    Frontend -->|HTTPS REST| NestJS
    
    NestJS -->|Validate Session| SupabaseAuth
    NestJS -->|Read/Write Data| DB
    NestJS -->|Dispatch Tasks| Orchestrator
    
    Orchestrator -->|Abstracted AI Logic| AIGateway
    AIGateway -->|Route Requests| FastAPI
    FastAPI -->|LLM Inference| LLM
```
