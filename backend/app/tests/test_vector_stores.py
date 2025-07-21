import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.schema import VectorStore, Collection, DocumentResponse, DocumentMetadata

client = TestClient(app)

def test_list_vector_stores():
    """Test the vector stores endpoint"""
    response = client.get("/vector-stores")
    assert response.status_code == 200
    
    # We might have no vector stores configured in test env
    # So just validate the response structure
    data = response.json()
    assert isinstance(data, list)
    
    # If we have data, validate the structure
    if data:
        store = data[0]
        assert "id" in store
        assert "name" in store
        assert "type" in store

def test_list_collections():
    """Test the collections endpoint"""
    response = client.get("/collections")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    
    # Expected to have at least the mock collections
    assert len(data) >= 1
    
    # Validate structure
    collection = data[0]
    assert "id" in collection
    assert "name" in collection
    assert "tags" in collection

@patch('app.services.vector_stores.vector_store_service.search')
def test_search_endpoint(mock_search):
    """Test the search endpoint with mocked search results"""
    # Setup mock response
    mock_result = DocumentResponse(
        content="Test content",
        metadata=DocumentMetadata(
            documentId="doc123",
            documentName="Test Document",
            chunkId="chunk456",
            chunkIndex=1,
            tags=["test"]
        ),
        source_id="pgvector-1",
        source_name="Test Store",
        source_type="pgvector",
        similarity=0.95
    )
    
    mock_search.return_value = [mock_result]
    
    # Test the search endpoint
    response = client.get("/search?query=test&k=1")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    
    result = data[0]
    assert result["content"] == "Test content"
    assert result["metadata"]["documentId"] == "doc123"
    assert result["source_type"] == "pgvector"
    assert result["similarity"] == 0.95 