# NASA Apollo Mission Transcripts to PGVector

This directory contains scripts for downloading, processing, and loading NASA Apollo mission transcripts into a PostgreSQL database with pgvector extension for vector search.

## Features

- Downloads PDF transcripts from NASA's archives
- Processes and chunks the documents for optimal retrieval
- Creates embeddings for each chunk using OpenAI-compatible embeddings models
- Loads the documents into PostgreSQL with pgvector extension
- Supports multiple collections defined in a JSON file
- Optimized for use with the Vector Database API backend

## Prerequisites

- Docker or Podman with Docker Compose or Podman Compose
- Python 3.8+ with required packages (see requirements.txt)
- Access to an OpenAI-compatible embeddings API

## Scripts

The following scripts are available:

- `pdf_to_pgvector.py`: Downloads, processes, and embeds PDF documents
- `load_mission_collections.py`: Loads collections of PDFs defined in a JSON file
- `clear_vector_db.py`: Clears data from the vector database
- `mission_collections.json`: Contains metadata and URLs for NASA Apollo mission transcripts

## Usage

### Quick Start

```bash
# Clear existing data
python clear_vector_db.py --clear-collections

# Load all collections from mission_collections.json
python load_mission_collections.py

# Load a specific collection file
python load_mission_collections.py --collections-file path/to/collections.json

# Load PDFs directly with custom parameters
python pdf_to_pgvector.py --urls https://example.com/document.pdf --collection-name "My Collection" --collection-id "my-collection" --tags "tag1" "tag2"
```

Or use the npm scripts from the root of the repository:

```bash
# Clear existing data
yarn backend:clear-data

# Load all missions
yarn backend:load-missions

# Load a specific mission collection file
yarn backend:load-mission path/to/collections.json
```

### Command Line Arguments

#### load_mission_collections.py

- `--collections-file`: Path to the collections JSON file (default: mission_collections.json)
- `--connection-string`: PostgreSQL connection string (default: postgresql://postgres:postgres@localhost:5432/vectordb)
- `--table-name`: Name of the table to store documents (default: documents)

#### pdf_to_pgvector.py

- `--urls`: List of PDF URLs to process
- `--url-file`: Path to a JSON file containing PDF URLs
- `--collection-name`: Name of the collection (required)
- `--collection-id`: ID of the collection (defaults to slugified name)
- `--tags`: Tags to assign to the collection
- `--connection-string`: PostgreSQL connection string
- `--table-name`: Name of the table to store documents
- `--embeddings-model`: Embeddings model to use (default: nomic-embed-text)
- `--embeddings-api`: API endpoint for embeddings (default: http://localhost:8553/v1)
- `--chunk-size`: Size of text chunks (default: 1000)
- `--chunk-overlap`: Overlap between text chunks (default: 200)

#### clear_vector_db.py

- `--connection-string`: PostgreSQL connection string
- `--table-name`: Name of the table to clear
- `--clear-collections`: Whether to clear the collections table as well

### Collection JSON Format

The `mission_collections.json` file follows this format:

```json
{
  "collections": [
    {
      "id": "apollo-11",
      "name": "Apollo 11 Mission",
      "description": "Description of the mission",
      "tags": ["apollo", "nasa", "moon-landing"],
      "urls": [
        "https://example.com/document1.pdf",
        "https://example.com/document2.pdf"
      ]
    }
  ]
}
```

## Customization

You can modify the following aspects of the loader:

- **Collections**: Edit the `mission_collections.json` file to add or remove collections
- **Chunk size**: Set with `--chunk-size=N` (default: 1000 characters)
- **Chunk overlap**: Set with `--chunk-overlap=N` (default: 200 characters)
- **Embeddings model**: Set with `--embeddings-model=MODEL` (default: nomic-embed-text)

## Connecting to the Vector Database API

After loading the data, the PostgreSQL with pgvector database will contain your documents and embeddings. You can then connect the Vector Database API to it by ensuring the connection string matches the one used by the loader:

```
postgresql://postgres:postgres@pgvector:5432/vectordb
```

## Architecture

```
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│                │    │                │    │                │
│  NASA Mission  │───>│  PDF to Vector │───>│   PostgreSQL   │
│   Transcripts  │    │    Scripts     │    │  with pgvector │
│    (PDFs)      │    │    (Python)    │    │  (Database)    │
│                │    │                │    │                │
└────────────────┘    └────────────────┘    └────────────────┘
                                                    │
                                                    ▼
                                           ┌────────────────┐
                                           │                │
                                           │  Vector DB API │
                                           │   (FastAPI)    │
                                           │                │
                                           └────────────────┘
                                                    │
                                                    ▼
                                           ┌────────────────┐
                                           │                │
                                           │  Frontend App  │
                                           │   (Browser)    │
                                           │                │
                                           └────────────────┘
``` 