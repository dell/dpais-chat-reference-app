# Vector Database Backend API

This is the backend API service for the Dell Pro AI Studio Chat PWA's vector database functionality. It provides endpoints for accessing and searching vector databases such as PostgreSQL with pgvector extension.

## Setup

### Prerequisites

- Python 3.8+
- PostgreSQL with pgvector extension (for local PGVector)
- Podman and Podman Compose (recommended for containerized setup)

### Local Setup

1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Edit the `.env` file to configure your vector database connections.

5. Run the API server:
```bash
python run.py
```

The API will be available at http://localhost:8000

### Podman Compose Setup (Recommended)

1. Configure environment variables (optional):
```bash
cp .env.example .env
# Edit .env as needed
```

2. Start the services with Podman Compose:
```bash
podman-compose up -d
```

The API will be available at http://localhost:8000

## Loading Sample Data

The backend includes scripts to load NASA Apollo mission transcripts into the PGVector database:

```bash
# Start the backend if it is not already started
yarn backend:start

# Clear existing data
python scripts/clear_vector_db.py --clear-collections

# Load all collections from mission_collections.json
python scripts/load_mission_collections.py

# Load a specific collection (Apollo 11 only)
python scripts/load_mission_collections.py --collections-file scripts/apollo11_only.json
```

Or use the npm scripts from the root of the repository:

```bash
# Clear existing data and load NASA Apollo mission transcripts
yarn backend:load-data

# Or load only the mission data
yarn backend:load-missions

# To clear the database without loading new data
yarn backend:clear-data
```

For more details about loading data, see the [Data Loading Scripts README](scripts/README.md).

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /vector-stores` - List all available vector stores
- `GET /collections` - List all available document collections
- `GET /search` - Search for documents

See the API documentation at http://localhost:8000/docs for detailed endpoint specifications.

## Testing

Run the tests with pytest:

```bash
pytest
```

Or run a specific test file:

```bash
pytest app/tests/test_health.py
```

Run the integration test:

```bash
pytest app/tests/test_integration.py -v
```

## Integration with Frontend

Update the frontend settings to point to this API:

1. In the application settings, set the API Base URL to http://localhost:8000
2. The frontend will automatically use this service for vector store operations

## NPM Scripts

The main repository includes several npm scripts to manage the backend:

```bash
# Start the backend with podman-compose
yarn backend:start

# Stop the backend services
yarn backend:stop

# View backend logs
yarn backend:logs

# Restart the backend services
yarn backend:restart

# Setup local venv (only need to run this once)
yarn backend:setup-venv

# Run backend tests
yarn backend:test

# Run only backend unit tests
yarn backend:test:unit

# Run only backend integration tests
yarn backend:test:integration
```

## Development

- The API is built with FastAPI
- Run the server with `uvicorn app.main:app --reload` for development with auto-reload
- Use `podman-compose up -d` to start the entire stack including PostgreSQL with pgvector

## Troubleshooting

If you see an error about port 8000 being in use, this could be because:
1. The API server is already running
2. Another application is using port 8000

To resolve this:
```bash
# Find processes using port 8000
lsof -i :8000

# Stop the process (replace PID with the actual process ID)
kill PID
``` 

If you encounter issues with the vector database connection:

1. Verify that PostgreSQL is running properly:
```bash
podman ps | grep postgres
```

2. Check the PostgreSQL logs:
```bash
podman logs backend-postgres-1
```

3. Run the connection test script:
```bash
python test_connection.py
```

This script will attempt to connect to the database and verify that the pgvector extension is properly installed. 