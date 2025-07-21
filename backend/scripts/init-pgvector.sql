-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(768),  -- Nomic embedding size
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index on metadata
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);