# Company Documents Feature

The Company Documents feature allows you to connect to remote vector databases for enterprise-level RAG (Retrieval Augmented Generation). This enables your chat application to retrieve information from external data sources without having to upload documents directly into the application.

## Supported Vector Databases

### On-Premises Solutions
- **Milvus**: High-performance vector database built for scalable similarity search
- **Qdrant**: Vector database with extended filtering capabilities
- **Weaviate**: Vector search engine and knowledge graph
- **Chroma DB**: Open-source embedding database for AI applications
- **PGVector**: PostgreSQL extension for vector similarity search

### Cloud Solutions
- **Pinecone**: Fully managed vector database for production ML applications
- **Milvus Cloud**: Cloud-based managed Milvus service

## Setting Up Vector Database Connections

1. Open the Settings dialog by clicking the gear icon at the bottom of the sidebar
2. Navigate to the "Vector Databases" tab
3. Click "Add Vector Database" button
4. Fill in the required fields:
   - **Name**: A friendly name for the connection
   - **Description**: Optional description
   - **Database Type**: Select your vector database type
   - **Tags**: Optional tags for filtering
   - **Enabled**: Toggle to enable/disable this connection
5. Fill in the database-specific connection details
6. Click "Test Connection" to verify connectivity
7. Click "Save" to save the configuration

## Database-Specific Configuration

### Milvus
- **URL**: The URL of your Milvus server
- **Port**: (Optional) The port number
- **Username**: (Optional) Authentication username
- **Password**: (Optional) Authentication password
- **Collection Name**: The name of the collection to query

### Qdrant
- **URL**: The URL of your Qdrant server
- **API Key**: (Optional) Authentication key
- **Collection Name**: The name of the collection to query

### Weaviate
- **URL**: The URL of your Weaviate server
- **API Key**: (Optional) Authentication key
- **Class Name**: The name of the class to query

### Chroma DB
- **URL**: The URL of your Chroma server
- **Collection Name**: The name of the collection to query

### PGVector
- **Connection String**: PostgreSQL connection string
- **Table Name**: The name of the table containing vectors
- **Query Name**: (Optional) Custom query name

### Pinecone
- **API Key**: Your Pinecone API key
- **Environment**: Pinecone environment (e.g., "us-east-1-aws")
- **Index Name**: The name of the index to query
- **Namespace**: (Optional) Namespace within the index

## Using Company Documents in Chat

1. Navigate to the "Company" tab in the sidebar
2. You'll see a list of your configured vector databases
3. Use the search bar to search across all enabled vector databases
4. Click the chat icon next to a search result to add that vector database as a context source
5. Ask questions related to the data in those databases

## Hybrid RAG Workflow

The application supports a hybrid RAG workflow that combines:
- Local documents uploaded to the application
- Remote documents from vector databases

To use hybrid RAG:
1. Add local document tags to a chat session (from the "Documents" tab)
2. Add company document sources to the same chat session (from the "Company" tab)
3. Your chat will now use both local and remote sources to answer your questions

## Technical Notes

- The system automatically manages connections to vector databases
- Connections are pooled and reused to improve performance
- Search requests are executed in parallel across all enabled databases
- Results are ranked by similarity scores and combined
- All configuration data is stored in localStorage
- No data or credentials are sent to external services except the configured databases 