from typing import List, Optional, Dict, Any
import math
from fastapi import APIRouter, Query
from app.models.schema import VectorStore, Collection, DocumentResponse, SearchRequest
from app.services.vector_stores import vector_store_service

router = APIRouter()

@router.get("/vector-stores", response_model=List[VectorStore])
async def list_vector_stores():
    """
    List all available vector stores
    """
    return vector_store_service.get_vector_stores()

@router.get("/vector-stores/status", response_model=Dict[str, Any])
async def vector_stores_status():
    """
    Check the status of all vector stores
    Returns connection status for each configured vector store
    """
    return vector_store_service.check_connections()

@router.get("/collections", response_model=List[Collection])
async def list_collections():
    """
    List all available document collections from the database
    """
    collections = vector_store_service.get_collections()
    print(f"Retrieved {len(collections)} collections from database")
    return collections

@router.get("/search", response_model=List[DocumentResponse])
async def search_documents(
    query: str,
    k: int = 5,
    backend_id: List[str] = Query(None, description="Filter by vector store backend ID"),
    collection_id: List[str] = Query(None, description="Filter by collection ID"),
    tag: List[str] = Query(None, description="Filter by document tags")
):
    """
    Search for documents across vector stores
    
    - **query**: The search query text
    - **k**: Maximum number of results to return
    - **backend_id**: Optional filter by vector store backend ID (pgvector-1, pinecone-1, etc.)
    - **collection_id**: Optional filter by collection ID (apollo-11, etc.)
    - **tag**: Optional filter by document tags (nasa, technical, etc.)
    """
    print(f"Search query: '{query}', k={k}, backends={backend_id}, collections={collection_id}, tags={tag}")
    
    results = await vector_store_service.search(
        query=query,
        k=k,
        backend_ids=backend_id,
        collection_ids=collection_id,
        tags=tag
    )
    
    # Clean NaN values from results before returning
    for result in results:
        # Check if similarity is NaN and replace with 0.0
        if hasattr(result, 'similarity') and (result.similarity is None or math.isnan(result.similarity)):
            result.similarity = 0.0
    
    print(f"Search returned {len(results)} results")
    return results 