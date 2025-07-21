import os
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# API Configuration
API_PORT = int(os.getenv("API_PORT", "8000"))
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_VERSION = "1.0.0"

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# Allow all origins in development mode - this is useful for debugging
if "*" in CORS_ORIGINS or "all" in CORS_ORIGINS:
    CORS_ORIGINS = ["*"]
else:
    # Strip any whitespace from the origins
    CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS if origin.strip()]
    
    # Ensure we have at least one origin
    if not CORS_ORIGINS:
        CORS_ORIGINS = ["*"]  # Default fallback
    
    # Debug log the origins
    print(f"CORS Origins: {CORS_ORIGINS}")

# Vector Database - PGVector Settings
PGVECTOR_CONNECTION_STRING = os.getenv("PGVECTOR_CONNECTION_STRING", "postgresql://postgres:postgres@localhost:5432/vectordb")
PGVECTOR_TABLE_NAME = os.getenv("PGVECTOR_TABLE_NAME", "documents")

# Vector Database - Pinecone Settings
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "")

# OpenAI API Settings
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dpais")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "http://localhost:8553/v1")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "nomic-embed-text")

# Feature flags for enabling/disabling specific vector stores
ENABLE_PGVECTOR = os.getenv("ENABLE_PGVECTOR", "true").lower() == "true"
ENABLE_PINECONE = os.getenv("ENABLE_PINECONE", "false").lower() == "true" 