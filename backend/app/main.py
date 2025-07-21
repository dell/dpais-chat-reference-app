from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import health, vector_stores

app = FastAPI(
    title="Vector Database API",
    description="API for vector database operations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Include routers
app.include_router(health.router)
app.include_router(vector_stores.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the Vector Database API. See /docs for API documentation."} 