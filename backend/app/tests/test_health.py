import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import API_VERSION

client = TestClient(app)

def test_health_endpoint():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == API_VERSION 