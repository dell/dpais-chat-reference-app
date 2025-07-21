from fastapi import APIRouter
from app.config import API_VERSION
from app.models.schema import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    return HealthResponse(status="ok", version=API_VERSION) 