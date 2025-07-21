from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class VectorStore(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None


class Collection(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = []


class DocumentMetadata(BaseModel):
    documentId: str
    documentName: str
    chunkId: str
    chunkIndex: Optional[int] = None
    tags: Optional[List[str]] = None
    

class DocumentResponse(BaseModel):
    content: str
    metadata: DocumentMetadata
    source_id: str
    source_name: str
    source_type: str
    similarity: float


class SearchRequest(BaseModel):
    query: str
    k: int = 5
    backend_ids: Optional[List[str]] = None
    collection_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None 