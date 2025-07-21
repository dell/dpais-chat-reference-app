# Backend API Specification for Vector Database Access

This document outlines the API endpoints required for the vector database access from the DPAIS Chat Template PWA.

## Base URL

The API base URL is configurable in the application settings, defaulting to:

```
http://localhost:8000
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the API.

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### List Available Vector Stores

```
GET /vector-stores
```

Returns a list of all available vector stores/backends.

**Response**:
```json
[
  {
    "id": "pgvector-1",
    "name": "PostgreSQL Vector DB",
    "type": "pgvector",
    "description": "Main document database for company docs"
  },
  {
    "id": "pinecone-1",
    "name": "Pinecone Knowledge Base",
    "type": "pinecone",
    "description": "Product knowledge base"
  }
]
```

### List Available Collections

```
GET /collections
```

Returns a list of all available document collections.

**Response**:
```json
[
  {
    "id": "company-policies",
    "name": "Company Policies",
    "description": "Corporate policy documents",
    "tags": ["policies", "corporate", "hr"]
  },
  {
    "id": "product-docs",
    "name": "Product Documentation",
    "description": "Technical product documentation",
    "tags": ["technical", "product", "manual"]
  }
]
```

### Search Documents

```
GET /search
```

Query parameters:
- `query` (required): The search query
- `k` (optional): Maximum number of results to return (default: 5)
- `backend_id` (optional): Filter by specific backend(s), can be specified multiple times
- `collection_id` (optional): Filter by specific collection(s), can be specified multiple times
- `tag` (optional): Filter by specific tag(s), can be specified multiple times

**Response**:
```json
[
  {
    "content": "This is the content of a document chunk...",
    "metadata": {
      "documentId": "doc-123",
      "documentName": "Employee Handbook",
      "chunkId": "chunk-456",
      "chunkIndex": 3,
      "tags": ["policies", "hr"]
    },
    "source_id": "pgvector-1",
    "source_name": "PostgreSQL Vector DB",
    "source_type": "pgvector",
    "similarity": 0.89
  }
]
```

## Implementation Notes

### FastAPI Implementation

This API can be implemented using FastAPI, a modern Python web framework designed for API development. The implementation would use LangChain's vector store integrations to connect to various backend vector databases.

Example FastAPI implementation structure:

```python
from fastapi import FastAPI, Query
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/vector-stores")
async def list_vector_stores():
    # Implementation connects to and lists available vector stores
    # ...

@app.get("/collections")
async def list_collections():
    # Implementation connects to and lists available document collections
    # ...

@app.get("/search")
async def search_documents(
    query: str,
    k: int = 5,
    backend_id: List[str] = Query(None),
    collection_id: List[str] = Query(None),
    tag: List[str] = Query(None)
):
    # Implementation performs search across vector stores based on parameters
    # ...
```

### Security Considerations

- **API Key Authentication**: Add an API key header for protected endpoints
- **CORS**: Configure appropriate CORS settings to allow access from the frontend application
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Input Validation**: Validate all input parameters to prevent injection attacks

## Deployment

The API can be deployed as a standalone service or as part of a Docker compose setup alongside vector databases like PostgreSQL with pgvector extension. 