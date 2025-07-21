FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client tools and dependencies for PyMuPDF
RUN apt-get update && \
    apt-get install -y postgresql-client libmupdf-dev build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the scripts
COPY pdf_to_pgvector.py .
COPY load_mission_collections.py .
COPY clear_vector_db.py .
COPY mission_collections.json .

# Set environment variables (can be overridden during docker run)
ENV PGVECTOR_CONNECTION_STRING="postgresql://postgres:postgres@pgvector:5432/vectordb" \
    OPENAI_API_KEY="" \
    OPENAI_API_BASE="http://host.docker.internal:8553/v1" \
    EMBEDDINGS_MODEL="nomic-embed-text" \
    STARTUP_DELAY="5"

# Run the script
CMD ["python", "load_mission_collections.py"] 