from fastapi import FastAPI, Response
from contextlib import asynccontextmanager
import time
from app.config import settings
from app.api.story_routes import router as story_router
from app.utils.logging_config import setup_json_logging
from app.utils.middleware import RequestContextMiddleware
from app.utils.metrics import get_prometheus_metrics

# Initialize structured logging globally
setup_json_logging()

start_time = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup log
    print("Najmah AI Service starting up...")
    print(f"Validated GEMINI_API_KEY: {'[SET]' if settings.gemini_api_key else '[MISSING]'}")
    yield
    # Shutdown clean cleanup
    print("Najmah AI Service shutting down gracefully...")
    print("Releasing all provider clients and resources.")

app = FastAPI(
    title="Najmah AI Service",
    description="Python microservice for Najmah AI Platform intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

# Register context and tracing middleware
app.add_middleware(RequestContextMiddleware)

app.include_router(story_router, prefix="/ai", tags=["Story AI"])

@app.get("/health")
def health_check():
    uptime = time.time() - start_time
    gemini_ready = bool(settings.gemini_api_key)
    status = "ok" if gemini_ready else "unhealthy"
    
    return {
        "status": status,
        "version": "1.0.0",
        "uptime": f"{round(uptime, 2)}s",
        "provider_readiness": {
            "gemini": "ready" if gemini_ready else "not_configured"
        }
    }

@app.get("/metrics")
def metrics_check():
    return Response(
        content=get_prometheus_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )
