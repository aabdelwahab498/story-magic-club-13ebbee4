import pytest
from fastapi.testclient import TestClient
from app.main import app
import json

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert "uptime" in data
    assert data["provider_readiness"]["gemini"] == "ready"

def test_plan_story_validation_error():
    # Missing required fields like 'selGoal'
    invalid_context = {
        "targetAge": 5,
        "language": "en",
        "readingLevel": "beginner",
        "theme": "space"
    }
    response = client.post("/ai/story/plan", json=invalid_context)
    assert response.status_code == 422
