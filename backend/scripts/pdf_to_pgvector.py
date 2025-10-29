#!/usr/bin/env python3
"""
PDF to PGVector - A script to download, process, and embed PDF documents
"""
import os
import sys
import json
import time
import argparse
import requests
import tempfile
from typing import List, Dict, Any, Optional
import logging
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import psycopg2
from psycopg2.extras import execute_values
import numpy as np
import tiktoken
from tqdm import tqdm

# PDF processing
import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('pdf_to_pgvector')

# Constants
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 250
DEFAULT_EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "nomic-embed-text")
DEFAULT_EMBEDDINGS_DIMENSIONS = 768  # nomic-embed-text dimensions
DEFAULT_OPENAI_API = os.getenv("OPENAI_API_BASE", "http://localhost:8553/v1")
DEFAULT_BATCH_SIZE = int(os.getenv("EMBEDDINGS_BATCH_SIZE", "20"))  # Get batch size from env var

class PDFProcessor:
    """Process PDFs and extract text content with metadata"""
    
    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            is_separator_regex=False
        )
    
    def download_pdf(self, url: str, output_path: Optional[str] = None) -> str:
        """Download a PDF from a URL and save it to a file"""
        logger.info(f"Downloading PDF from {url}")
        
        if output_path is None:
            # Create a temporary file with a .pdf extension
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                output_path = temp_file.name
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Get the total file size if available
        total_size = int(response.headers.get('content-length', 0))
        
        # Download with progress bar
        with open(output_path, 'wb') as f:
            if total_size == 0:
                f.write(response.content)
            else:
                with tqdm(total=total_size, unit='B', unit_scale=True, 
                          desc=os.path.basename(url)) as pbar:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            pbar.update(len(chunk))
        
        return output_path
    
    def extract_text_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract text and metadata from a PDF file"""
        logger.info(f"Extracting text from {pdf_path}")
        
        # Get the filename without extension for document ID
        filename = os.path.basename(pdf_path)
        doc_id = os.path.splitext(filename)[0]
        
        # Open the PDF
        pdf_document = fitz.open(pdf_path)
        
        all_chunks = []
        
        # Process each page
        for page_num, page in enumerate(pdf_document):
            text = page.get_text()
            if not text.strip():
                continue
                
            # Split text into chunks
            chunks = self.text_splitter.split_text(text)
            
            # Create document chunks with metadata
            for i, chunk_text in enumerate(chunks):
                chunk_id = f"{doc_id}_p{page_num+1}_c{i+1}"
                all_chunks.append({
                    "text": chunk_text,
                    "metadata": {
                        "documentId": doc_id,
                        "documentName": filename,
                        "pageNumber": page_num + 1,
                        "chunkId": chunk_id,
                        "chunkIndex": i,
                        "source": pdf_path
                    }
                })
        
        return all_chunks


class EmbeddingsService:
    """Service to create embeddings from text"""
    
    def __init__(self, 
                 model: str = DEFAULT_EMBEDDINGS_MODEL, 
                 api_base: str = DEFAULT_OPENAI_API,
                 api_key: str = ""):
        self.model = model
        self.api_base = api_base
        self.api_key = api_key
        
        # If API base doesn't end with a slash, add it
        if not self.api_base.endswith('/'):
            self.api_base += '/'
        
        # Set up tokenizer for counting tokens
        # self.tokenizer = tiktoken.get_encoding(model)  # Using OpenAI's encoding
    
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string"""
        tokens = self.tokenizer.encode(text)
        return len(tokens)
    
    def create_embeddings(self, texts: List[str], show_progress: bool = True) -> List[List[float]]:
        """Create embeddings for a list of text strings"""
        embeddings = []
        
        # Skip empty batch
        if not texts:
            return embeddings
            
        # Prepare progress bar
        if show_progress:
            pbar = tqdm(total=len(texts), desc="Creating embeddings")
        
        # Process in batches
        batch_size = DEFAULT_BATCH_SIZE
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            
            # Create embeddings
            try:
                payload = {
                    "model": self.model,
                    "input": [f"search_query: {x}" for x in batch]
                }
                # logger.info(f"Embedding API Request to {self.api_base}embeddings with model {self.model}")
                
                response = requests.post(
                    f"{self.api_base}embeddings",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
                    },
                    json=payload
                )
                
                if response.status_code != 200:
                    logger.error(f"API returned status code {response.status_code}: {response.text}")
                    raise Exception(f"API error: {response.status_code}")
                
                data = response.json()
                
                # Debug log the response format
                if i == 0:  # Only log the first batch
                    logger.info(f"API Response keys: {data.keys()}")
                    if 'data' in data and len(data['data']) > 0:
                        logger.info(f"First embedding item keys: {data['data'][0].keys()}")
                        logger.info(f"Embedding dimensions: {len(data['data'][0]['embedding'])}")
                
                # Extract embeddings
                batch_embeddings = []
                for item in data.get('data', []):
                    if 'embedding' in item and isinstance(item['embedding'], list):
                        batch_embeddings.append(item['embedding'])
                    else:
                        logger.error(f"Invalid embedding format: {item}")
                        # Add empty embeddings as placeholders
                        batch_embeddings.append([0.0] * DEFAULT_EMBEDDINGS_DIMENSIONS)
                
                embeddings.extend(batch_embeddings)
                
                # Update progress bar
                if show_progress:
                    pbar.update(len(batch))
                
                # Small delay to avoid rate limiting
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error creating embeddings: {e}")
                # Add empty embeddings as placeholders
                embeddings.extend([[0.0] * DEFAULT_EMBEDDINGS_DIMENSIONS] * len(batch))
                if show_progress:
                    pbar.update(len(batch))
        
        # Close progress bar
        if show_progress:
            pbar.close()
        
        # Check if we have the right number of embeddings
        if len(embeddings) != len(texts):
            logger.warning(f"Number of embeddings ({len(embeddings)}) doesn't match number of texts ({len(texts)})")
            # Pad with empty embeddings if needed
            while len(embeddings) < len(texts):
                embeddings.append([0.0] * DEFAULT_EMBEDDINGS_DIMENSIONS)
            # Truncate if too many
            embeddings = embeddings[:len(texts)]
        
        return embeddings


class PGVectorService:
    """Service to store and retrieve embeddings in PGVector"""
    
    def __init__(self, connection_string: str, table_name: str = "documents"):
        self.connection_string = connection_string
        self.table_name = table_name
        self.conn = None
    
    def connect(self) -> None:
        """Connect to the PostgreSQL database"""
        logger.info(f"Connecting to database: {self.connection_string}")
        self.conn = psycopg2.connect(self.connection_string)
    
    def close(self) -> None:
        """Close the database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    def create_tables(self, drop_tables=False) -> None:
        """Create the necessary tables and pgvector extension"""
        logger.info(f"Creating tables and pgvector extension")
        
        with self.conn.cursor() as cursor:
            # Create the pgvector extension if it doesn't exist
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # Drop existing tables if requested
            if drop_tables:
                logger.info(f"Dropping existing table {self.table_name}")
                cursor.execute(f"DROP TABLE IF EXISTS {self.table_name};")
                cursor.execute("DROP TABLE IF EXISTS collections;")
            
            # Create the documents table if it doesn't exist
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    metadata JSONB NOT NULL,
                    embedding vector({DEFAULT_EMBEDDINGS_DIMENSIONS}),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Create a GIN index on metadata
            cursor.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.table_name}_metadata 
                ON {self.table_name} USING GIN (metadata);
            """)
            
            # Create a vector index
            cursor.execute(f"""
                CREATE INDEX IF NOT EXISTS idx_{self.table_name}_embedding 
                ON {self.table_name} USING ivfflat (embedding vector_cosine_ops) 
                WITH (lists = 100);
            """)
            
            self.conn.commit()
    
    def insert_documents(self, documents: List[Dict[str, Any]], embeddings: List[List[float]]) -> None:
        """Insert documents and their embeddings into the database"""
        logger.info(f"Inserting {len(documents)} documents into {self.table_name}")
        
        # Ensure we have matching number of documents and embeddings
        if len(documents) != len(embeddings):
            logger.warning(f"Number of documents ({len(documents)}) doesn't match number of embeddings ({len(embeddings)})")
            # Use the minimum length
            doc_count = min(len(documents), len(embeddings))
            documents = documents[:doc_count]
            embeddings = embeddings[:doc_count]
        
        # Process in batches to avoid memory issues
        batch_size = DEFAULT_BATCH_SIZE
        total_inserted = 0
        
        for i in range(0, len(documents), batch_size):
            end_idx = min(i + batch_size, len(documents))
            doc_batch = documents[i:end_idx]
            emb_batch = embeddings[i:end_idx]
            
            try:
                with self.conn.cursor() as cursor:
                    # Prepare the data for insertion
                    data = []
                    for j, doc in enumerate(doc_batch):
                        # Verify the embedding format
                        embedding = emb_batch[j]
                        if not isinstance(embedding, list):
                            logger.error(f"Invalid embedding format: {type(embedding)}")
                            continue
                            
                        # Debug log the first embedding dimensions
                        if i == 0 and j == 0:
                            logger.info(f"First embedding dimensions: {len(embedding)}")
                            
                        data.append((
                            doc["text"],
                            json.dumps(doc["metadata"]),
                            embedding
                        ))
                    
                    if not data:
                        logger.warning("No valid data to insert")
                        continue
                        
                    # Insert the data
                    query = f"""
                        INSERT INTO {self.table_name} (content, metadata, embedding)
                        VALUES %s
                        ON CONFLICT DO NOTHING;
                    """
                    
                    # Use execute_values for efficient bulk insertion
                    execute_values(cursor, query, data, template="(%s, %s, %s::vector)")
                    self.conn.commit()
                    
                    total_inserted += len(data)
                    logger.info(f"Successfully inserted batch {i//batch_size + 1}, total: {total_inserted}")
                    
            except Exception as e:
                logger.error(f"Error inserting documents batch {i//batch_size + 1}: {e}")
                # Try to commit what we have so far
                try:
                    self.conn.commit()
                except:
                    self.conn.rollback()
        
        logger.info(f"Insertion complete. Total documents inserted: {total_inserted}")

    def insert_collection(self, collection_name: str, collection_id: str, tags: List[str]) -> None:
        """Insert collection metadata into collections table"""
        logger.info(f"Inserting collection {collection_name} with tags {tags}")
        
        with self.conn.cursor() as cursor:
            # Check if collections table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = 'collections'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            # Create collections table if it doesn't exist
            if not table_exists:
                cursor.execute("""
                    CREATE TABLE collections (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        tags JSONB NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                """)
            
            # Insert or update collection
            cursor.execute("""
                INSERT INTO collections (id, name, description, tags)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE 
                SET name = EXCLUDED.name, 
                    description = EXCLUDED.description, 
                    tags = EXCLUDED.tags;
            """, (collection_id, collection_name, f"NASA Apollo mission transcripts: {collection_name}", json.dumps(tags)))
            
            self.conn.commit()


def process_pdfs(pdf_urls: List[str],
                collection_name: str,
                collection_id: str,
                collection_tags: List[str],
                connection_string: str,
                table_name: str = "documents",
                embeddings_model: str = DEFAULT_EMBEDDINGS_MODEL,
                embeddings_api: str = DEFAULT_OPENAI_API,
                chunk_size: int = CHUNK_SIZE,
                chunk_overlap: int = CHUNK_OVERLAP,
                drop_tables: bool = False) -> None:
    """Process a list of PDFs and insert them into the database"""
    
    # Initialize the services
    pdf_processor = PDFProcessor(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    embeddings_service = EmbeddingsService(model=embeddings_model, api_base=embeddings_api)
    db_service = PGVectorService(connection_string=connection_string, table_name=table_name)
    
    # Connect to the database
    db_service.connect()
    
    try:
        # Create tables
        db_service.create_tables(drop_tables=drop_tables)
        
        # Process each PDF URL
        all_documents = []
        temp_files = []
        
        for url in pdf_urls:
            try:
                # Download the PDF
                pdf_path = pdf_processor.download_pdf(url)
                temp_files.append(pdf_path)
                
                # Extract text
                documents = pdf_processor.extract_text_from_pdf(pdf_path)
                
                # Add collection tags to each document metadata
                for doc in documents:
                    doc['metadata']['tags'] = collection_tags
                    doc['metadata']['collection'] = collection_id
                
                all_documents.extend(documents)
                
            except Exception as e:
                logger.error(f"Error processing PDF {url}: {e}")
        
        # Create embeddings
        texts = [doc["text"] for doc in all_documents]
        logger.info(f"Creating embeddings for {len(texts)} text chunks")
        embeddings = embeddings_service.create_embeddings(texts)
        
        # Insert documents into the database
        db_service.insert_documents(all_documents, embeddings)
        
        # Insert collection metadata
        db_service.insert_collection(collection_name, collection_id, collection_tags)
        
        logger.info(f"Successfully processed {len(all_documents)} chunks from {len(pdf_urls)} PDFs")
        
    finally:
        # Close the database connection
        db_service.close()
        
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except:
                pass


def parse_arguments():
    parser = argparse.ArgumentParser(description="Download and embed PDFs into a PGVector database")
    
    parser.add_argument('--urls', action='append', default=[], help='List of PDF URLs to process (can be used multiple times)')
    parser.add_argument('--url-file', type=str, help='Path to a JSON file containing PDF URLs')
    parser.add_argument('--collection-name', type=str, required=True, help='Name of the collection')
    parser.add_argument('--collection-id', type=str, help='ID of the collection (defaults to slugified name)')
    parser.add_argument('--tags', action='append', default=[], help='Tags to assign to the collection (can be used multiple times)')
    
    parser.add_argument('--connection-string', type=str, 
                       default="postgresql://postgres:postgres@localhost:5432/vectordb",
                       help='PostgreSQL connection string')
    parser.add_argument('--table-name', type=str, default="documents", 
                       help='Name of the table to store documents')
    parser.add_argument('--drop-tables', action='store_true',
                       help='Drop existing tables before creating new ones')
    
    parser.add_argument('--embeddings-model', type=str, default=DEFAULT_EMBEDDINGS_MODEL,
                       help='Embeddings model to use')
    parser.add_argument('--embeddings-api', type=str, default=DEFAULT_OPENAI_API,
                       help='API endpoint for embeddings')
    
    parser.add_argument('--chunk-size', type=int, default=CHUNK_SIZE,
                       help='Size of text chunks')
    parser.add_argument('--chunk-overlap', type=int, default=CHUNK_OVERLAP,
                       help='Overlap between text chunks')
    
    return parser.parse_args()


def slugify(text: str) -> str:
    """Convert a string to a slug format (lowercase, hyphens)"""
    import re
    # Replace non-alphanumeric characters with hyphens
    slug = re.sub(r'[^a-zA-Z0-9]', '-', text.lower())
    # Replace multiple hyphens with a single hyphen
    slug = re.sub(r'-+', '-', slug)
    # Remove leading and trailing hyphens
    slug = slug.strip('-')
    return slug


def main():
    args = parse_arguments()
    
    # Get PDF URLs
    pdf_urls = []
    if args.urls:
        pdf_urls.extend(args.urls)
    
    if args.url_file:
        try:
            with open(args.url_file, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    pdf_urls.extend(data)
                elif isinstance(data, dict) and 'urls' in data:
                    pdf_urls.extend(data['urls'])
        except Exception as e:
            logger.error(f"Error loading URL file: {e}")
            sys.exit(1)
    
    if not pdf_urls:
        logger.error("No PDF URLs provided. Use --urls or --url-file.")
        sys.exit(1)
    
    # Generate collection ID if not provided
    collection_id = args.collection_id
    if not collection_id:
        collection_id = slugify(args.collection_name)
    
    # Process the PDFs
    process_pdfs(
        pdf_urls=pdf_urls,
        collection_name=args.collection_name,
        collection_id=collection_id,
        collection_tags=args.tags,
        connection_string=args.connection_string,
        table_name=args.table_name,
        embeddings_model=args.embeddings_model,
        embeddings_api=args.embeddings_api,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        drop_tables=args.drop_tables
    )


if __name__ == "__main__":
    main() 