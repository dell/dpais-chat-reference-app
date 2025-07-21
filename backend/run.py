import uvicorn
from app.config import API_PORT, API_HOST

if __name__ == "__main__":
    # Run the FastAPI application with uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True  # Enable auto-reload during development
    ) 