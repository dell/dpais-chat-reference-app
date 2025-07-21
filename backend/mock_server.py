"""
Simple Mock Server for Vector Database API
"""
from flask import Flask, jsonify, request, Response
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Mock data
vector_stores = [
    {
        "id": "pgvector-1", 
        "name": "PostgreSQL Vector DB", 
        "type": "pgvector",
        "description": "Local PostgreSQL with pgvector extension"
    },
    {
        "id": "mock-pinecone", 
        "name": "Pinecone Vector DB", 
        "type": "pinecone",
        "description": "Cloud-based Pinecone vector database"
    }
]

collections = [
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

mock_documents = [
    {
        "content": "This is a company policy document about workplace conduct.",
        "metadata": {
            "documentId": "doc-001",
            "documentName": "Workplace Conduct Policy",
            "chunkId": "chunk-001",
            "chunkIndex": 0,
            "tags": ["policies", "hr"]
        },
        "source_id": "pgvector-1",
        "source_name": "PostgreSQL Vector DB",
        "source_type": "pgvector",
        "similarity": 0.95
    },
    {
        "content": "The product requires regular maintenance to ensure optimal performance.",
        "metadata": {
            "documentId": "doc-002",
            "documentName": "Product Maintenance Guide",
            "chunkId": "chunk-002",
            "chunkIndex": 0,
            "tags": ["technical", "product"]
        },
        "source_id": "mock-pinecone",
        "source_name": "Pinecone Vector DB",
        "source_type": "pinecone",
        "similarity": 0.87
    }
]

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "version": "1.0.0"
    })

@app.route('/vector-stores', methods=['GET'])
def list_vector_stores():
    return jsonify(vector_stores)

@app.route('/collections', methods=['GET'])
def list_collections():
    return jsonify(collections)

@app.route('/search', methods=['GET'])
def search():
    # Extract query parameters
    query = request.args.get('query', '')
    k = int(request.args.get('k', 5))
    backend_ids = request.args.getlist('backend_id')
    collection_ids = request.args.getlist('collection_id')
    tags = request.args.getlist('tag')
    
    # Log the request for debugging
    print(f"Search request: query={query}, k={k}, backend_ids={backend_ids}, tags={tags}")
    
    # Filter documents based on parameters (in a real implementation)
    filtered_docs = mock_documents
    
    # Apply backend filtering if specified
    if backend_ids:
        filtered_docs = [doc for doc in filtered_docs if doc['source_id'] in backend_ids]
    
    # Apply tag filtering if specified
    if tags:
        filtered_docs = [
            doc for doc in filtered_docs 
            if any(tag in doc['metadata'].get('tags', []) for tag in tags)
        ]
    
    # Sort by similarity and limit results
    filtered_docs = sorted(filtered_docs, key=lambda x: x['similarity'], reverse=True)[:k]
    
    return jsonify(filtered_docs)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True) 