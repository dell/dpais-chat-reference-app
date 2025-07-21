import uuid
import json
import psycopg2
from typing import List, Dict, Any, Optional

from langchain_community.vectorstores.pgvector import PGVector
from langchain_community.vectorstores.pinecone import Pinecone
from langchain.schema import Document
from langchain.embeddings.base import Embeddings
from langchain_openai import OpenAIEmbeddings
from app.config import OPENAI_API_KEY, OPENAI_API_BASE, EMBEDDINGS_MODEL

from app.config import (
    PGVECTOR_CONNECTION_STRING,
    PGVECTOR_TABLE_NAME,
    PINECONE_API_KEY,
    PINECONE_ENVIRONMENT,
    PINECONE_INDEX,
    ENABLE_PGVECTOR,
    ENABLE_PINECONE
)
from app.models.schema import VectorStore, Collection, DocumentResponse, DocumentMetadata
from app.services.embeddings import embeddings_service


class VectorStoreService:
    """Service for interacting with vector stores"""
    
    def __init__(self):
        self.embeddings = embeddings_service
        self.vector_stores: Dict[str, Any] = {}
        self.initialize_vector_stores()
        
    def initialize_vector_stores(self) -> None:
        """Initialize all configured vector stores"""
        if ENABLE_PGVECTOR:
            try:
                self._init_pgvector()
            except Exception as e:
                print(f"Failed to initialize PGVector: {e}")
                
        if ENABLE_PINECONE and PINECONE_API_KEY:
            try:
                self._init_pinecone()
            except Exception as e:
                print(f"Failed to initialize Pinecone: {e}")
    
    def _init_pgvector(self) -> None:
        """Initialize PGVector store"""
        try:
            # Create a connection string for PGVector
            # PGVector API may vary between versions, so we'll use the most basic approach
            try:
                # Try to create a PGVector instance directly with the connection string
                pg_store = PGVector(
                    connection_string=PGVECTOR_CONNECTION_STRING,
                    embedding_function=self.embeddings,
                    collection_name=PGVECTOR_TABLE_NAME
                )
            except (TypeError, ValueError) as e:
                print(f"Basic initialization failed: {e}, trying alternative method")
                
                # Alternative method for older versions
                import sqlalchemy
                from sqlalchemy import create_engine
                
                engine = create_engine(PGVECTOR_CONNECTION_STRING)
                pg_store = PGVector(
                    engine=engine,
                    embedding_function=self.embeddings,
                    collection_name=PGVECTOR_TABLE_NAME
                )
            
            self.vector_stores["pgvector-1"] = {
                "store": pg_store,
                "info": {
                    "id": "pgvector-1",
                    "name": "PostgreSQL Vector DB",
                    "type": "pgvector",
                    "description": "Local PostgreSQL with pgvector extension"
                }
            }
            print("PGVector initialized successfully")
        except Exception as e:
            print(f"Error initializing PGVector: {e}")
            raise
    
    def _init_pinecone(self) -> None:
        """Initialize Pinecone store"""
        try:
            # Import pinecone here to avoid loading if not enabled
            import pinecone
            
            # Initialize pinecone
            pinecone.init(
                api_key=PINECONE_API_KEY,
                environment=PINECONE_ENVIRONMENT
            )
            
            # Get index
            index = pinecone.Index(PINECONE_INDEX)
            
            # Create Pinecone vector store
            pinecone_store = Pinecone.from_existing_index(
                index_name=PINECONE_INDEX,
                embedding=self.embeddings
            )
            
            self.vector_stores["pinecone-1"] = {
                "store": pinecone_store,
                "info": {
                    "id": "pinecone-1",
                    "name": "Pinecone Vector DB",
                    "type": "pinecone",
                    "description": "Cloud-based Pinecone vector database"
                }
            }
            print("Pinecone initialized successfully")
        except Exception as e:
            print(f"Error initializing Pinecone: {e}")
            raise
    
    def get_vector_stores(self) -> List[VectorStore]:
        """Get information about all available vector stores"""
        return [VectorStore(**store["info"]) for store in self.vector_stores.values()]
    
    def check_connections(self) -> Dict[str, Any]:
        """Check connectivity to all configured vector stores"""
        results = {
            "status": "ok",
            "vector_stores": {}
        }
        
        # Check PGVector connection if enabled
        if ENABLE_PGVECTOR:
            pgvector_status = {
                "name": "PostgreSQL Vector DB",
                "status": "error",
                "details": "",
                "document_count": 0
            }
            
            try:
                # Get connection to database
                conn = self._get_db_connection()
                cursor = conn.cursor()
                
                # Check if documents table exists
                cursor.execute(f"""
                    SELECT EXISTS (
                       SELECT FROM information_schema.tables 
                       WHERE table_name = '{PGVECTOR_TABLE_NAME}'
                    );
                """)
                table_exists = cursor.fetchone()[0]
                
                if table_exists:
                    # Get document count
                    cursor.execute(f"SELECT COUNT(*) FROM {PGVECTOR_TABLE_NAME}")
                    doc_count = cursor.fetchone()[0]
                    
                    # Get vector dimensions
                    cursor.execute(f"""
                        SELECT vector_dims(embedding) 
                        FROM {PGVECTOR_TABLE_NAME} 
                        WHERE embedding IS NOT NULL 
                        LIMIT 1;
                    """)
                    dims_row = cursor.fetchone()
                    
                    if dims_row:
                        dims = dims_row[0]
                        pgvector_status["dimensions"] = dims
                    
                    pgvector_status["document_count"] = doc_count
                    pgvector_status["status"] = "ok"
                    pgvector_status["details"] = f"Connected to database. {doc_count} documents found."
                else:
                    pgvector_status["status"] = "warning"
                    pgvector_status["details"] = f"Connected to database but table '{PGVECTOR_TABLE_NAME}' does not exist."
                
                cursor.close()
                conn.close()
                
            except Exception as e:
                pgvector_status["details"] = f"Failed to connect to database: {str(e)}"
            
            results["vector_stores"]["pgvector"] = pgvector_status
        
        # Check Pinecone connection if enabled
        if ENABLE_PINECONE and PINECONE_API_KEY:
            pinecone_status = {
                "name": "Pinecone Vector DB",
                "status": "error",
                "details": "",
                "document_count": 0
            }
            
            try:
                # Try to get Pinecone stats - Pinecone must be initialized before this
                if "pinecone-1" in self.vector_stores:
                    import pinecone
                    
                    # Get stats from index
                    stats = pinecone.Index(PINECONE_INDEX).describe_index_stats()
                    
                    vector_count = sum(stats['namespaces'].get(ns, {}).get('vector_count', 0) 
                                     for ns in stats['namespaces'])
                    
                    pinecone_status["document_count"] = vector_count
                    pinecone_status["status"] = "ok"
                    pinecone_status["details"] = f"Connected to Pinecone. {vector_count} vectors found."
                else:
                    pinecone_status["details"] = "Pinecone is enabled but not properly initialized."
            except Exception as e:
                pinecone_status["details"] = f"Failed to connect to Pinecone: {str(e)}"
            
            results["vector_stores"]["pinecone"] = pinecone_status
        
        # Set overall status
        has_errors = any(vs["status"] == "error" for vs in results["vector_stores"].values())
        results["status"] = "error" if has_errors else "ok"
        
        return results
    
    def get_collections(self) -> List[Collection]:
        """Get available collections from the database"""
        collections = []
        
        if not ENABLE_PGVECTOR:
            return collections
            
        try:
            # Get connection to database
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Check if collections table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = 'collections'
                );
            """)
            table_exists = cursor.fetchone()[0]
            
            if not table_exists:
                print("Collections table does not exist")
                return collections
                
            # Query all collections
            cursor.execute("SELECT id, name, description, tags FROM collections")
            rows = cursor.fetchall()
            
            print(f"Found {len(rows)} collections in database")
            
            for row in rows:
                collection_id, name, description, tags_json = row
                # Parse tags from JSON format - handle as string or already decoded
                try:
                    if isinstance(tags_json, str):
                        tags = json.loads(tags_json)
                    else:
                        # If it's already a list or dict, use it directly
                        tags = tags_json
                except Exception as e:
                    print(f"Error parsing tags JSON: {e}, using empty list")
                    tags = []
                
                collection = Collection(
                    id=collection_id,
                    name=name,
                    description=description,
                    tags=tags
                )
                collections.append(collection)
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Error retrieving collections: {e}")
            
        return collections
    
    def _get_db_connection(self):
        """Helper method to get database connection"""
        try:
            # Try direct connection first
            try:
                print("=====Starting direct connection=====")
                print(f"PGVECTOR_CONNECTION_STRING: {PGVECTOR_CONNECTION_STRING}")
                conn = psycopg2.connect(PGVECTOR_CONNECTION_STRING)
                return conn
            except Exception as e:
                print(f"Direct connection failed: {e}, trying to parse connection string")
            
            # Parse the connection string
            connection_params = {}
            if "postgres://" in PGVECTOR_CONNECTION_STRING or "postgresql://" in PGVECTOR_CONNECTION_STRING:
                # Handle the container environment connection string
                conn_str = PGVECTOR_CONNECTION_STRING.replace("postgresql://", "").replace("postgres://", "")
                parts = conn_str.split("@")
                user_pass = parts[0].split(":")
                host_port_db = parts[1].split("/")
                host_port = host_port_db[0].split(":")
                
                connection_params = {
                    "user": user_pass[0],
                    "password": user_pass[1],
                    "host": host_port[0],
                    "port": host_port[1] if len(host_port) > 1 else "5432",
                    "database": host_port_db[1]
                }
            else:
                # Use connection string directly
                connection_params = {"dsn": PGVECTOR_CONNECTION_STRING}
            
            # Connect to the database
            try:
                conn = psycopg2.connect(**connection_params)
                return conn
            except Exception as e:
                print(f"Direct connection failed: {e}, trying to parse connection string")
                # Fallback to using container-specific host directly
                connection_params = {
                    "user": "postgres",
                    "password": "postgres",
                    "host": "pgvector-db",  # Use container hostname directly
                    "port": "5432",
                    "database": "vectordb"
                }
                conn = psycopg2.connect(**connection_params)
                return conn
        except Exception as e:
            print(f"Failed to connect to database: {e}")
            raise
    
    async def search(
        self,
        query: str,
        k: int = 5,
        backend_ids: Optional[List[str]] = None,
        collection_ids: Optional[List[str]] = None,
        tags: Optional[List[str]] = None
    ) -> List[DocumentResponse]:
        """
        Search across vector stores with optional filters
        """
        results = []
        print("=====Starting search=====")
        print(f"Query: {query}")
        print(f"k: {k}")
        print(f"backend_ids: {backend_ids}")
        print(f"collection_ids: {collection_ids}")
        print(f"tags: {tags}")

        # Prioritize direct SQL search for pgvector for better performance
        if ENABLE_PGVECTOR and (not backend_ids or "pgvector-1" in backend_ids):
            try:
                print("=====Starting direct SQL search=====")
                direct_results = await self._direct_pgvector_search(
                    query=query,
                    k=k,
                    collection_ids=collection_ids,
                    tags=tags
                )
                if direct_results:
                    return direct_results
            except Exception as e:
                print(f"Direct SQL search failed: {e}, falling back to LangChain search")
        
        # Filter vector stores if backend_ids is provided
        stores_to_search = {}
        if backend_ids:
            for store_id in backend_ids:
                if store_id in self.vector_stores:
                    stores_to_search[store_id] = self.vector_stores[store_id]
        else:
            stores_to_search = self.vector_stores
            
        if not stores_to_search:
            print("No vector stores available for search")
            return results
        
        # Perform search on each store
        for store_id, store_data in stores_to_search.items():
            try:
                vector_store = store_data["store"]
                store_info = store_data["info"]
                
                # Build filter dictionary for metadata filtering
                filter_dict = {}
                
                # Add collection filter if collection_ids is provided
                if collection_ids:
                    filter_dict["collection"] = {"$in": collection_ids}
                
                # Add tags filter if tags are provided
                if tags:
                    filter_dict["tags"] = {"$in": tags}
                    
                # Use empty filter if no filters specified
                if not filter_dict:
                    filter_dict = None
                
                # Perform the search
                docs = await self._search_store(vector_store, query, k, filter_dict)
                
                # Format the results
                for doc in docs:
                    metadata = doc.metadata or {}
                    
                    # Create standardized document metadata
                    doc_metadata = DocumentMetadata(
                        documentId=metadata.get("documentId", str(uuid.uuid4())),
                        documentName=metadata.get("documentName", "Unknown Document"),
                        chunkId=metadata.get("chunkId", str(uuid.uuid4())),
                        chunkIndex=metadata.get("chunkIndex"),
                        tags=metadata.get("tags", [])
                    )
                    
                    # Create document response
                    doc_response = DocumentResponse(
                        content=doc.page_content,
                        metadata=doc_metadata,
                        source_id=store_id,
                        source_name=store_info["name"],
                        source_type=store_info["type"],
                        similarity=metadata.get("similarity", 0.0)
                    )
                    
                    results.append(doc_response)
            except Exception as e:
                print(f"Error searching store {store_id}: {e}")
        
        # Sort results by similarity score (highest first)
        results.sort(key=lambda x: x.similarity, reverse=True)
        
        # Limit to k results
        return results[:k]
    
    async def _direct_pgvector_search(
        self,
        query: str,
        k: int = 5,
        collection_ids: Optional[List[str]] = None,
        tags: Optional[List[str]] = None
    ) -> List[DocumentResponse]:
        """Direct SQL search using pgvector for better performance and reliability"""
        results = []
        
        try:
            print("=====Starting direct pgvector SQL search=====")
            print(f"Query: {query}")
            # Generate embedding for the query
            try:
                # Use our direct embeddings service instead of langchain
                query_embedding = embeddings_service.embed_query(query)
                print(f"Successfully generated embedding with dimensionality: {len(query_embedding)}")
            except Exception as e:
                print(f"Error generating embedding: {e}")
                print("Detailed error info:", str(e))
                raise
            
            print("=====Starting database connection=====")
            # Connect to the database
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            print("=====Starting SQL query=====")
            
            # The pgvector extension expects vector format with square brackets
            # Create a vector string correctly formatted for PostgreSQL
            vector_str = "["
            for i, value in enumerate(query_embedding):
                if i > 0:
                    vector_str += ","
                vector_str += str(value)
            vector_str += "]"
            
            # Use the properly formatted vector in the SQL query
            sql = f"""
                SELECT content, metadata, 
                       1 - (embedding <=> '{vector_str}'::vector) AS similarity
                FROM {PGVECTOR_TABLE_NAME}
            """
            
            # Build WHERE clause for filters
            where_clauses = []
            sql_params = []
            param_idx = 0
            
            # Add collection filter
            if collection_ids:
                # For PostgreSQL, use a different approach with string formatting for IN clauses
                # which is safer when we control the collection_ids values
                placeholders = []
                for collection_id in collection_ids:
                    sql_params.append(collection_id)
                    placeholders.append('%s')  # Use %s placeholder instead of $n
                
                # Join the placeholders with commas
                placeholders_str = ', '.join(["'" + cid + "'" for cid in collection_ids])
                collection_clause = f"metadata->>'collection' IN ({placeholders_str})"
                where_clauses.append(collection_clause)
            
            # Add tags filter (any of the requested tags match)
            if tags:
                tag_conditions = []
                for tag in tags:
                    # Use direct string formatting for tag conditions
                    tag_conditions.append(f"metadata->'tags' ? '{tag}'")
                
                if tag_conditions:
                    # Use OR for inclusive tag matching (any tag matches)
                    where_clauses.append(f"({' OR '.join(tag_conditions)})")
            
            # Add WHERE clause if we have filters
            if where_clauses:
                sql += " WHERE " + " AND ".join(where_clauses)
            
            # Add ORDER BY and LIMIT
            sql += f" ORDER BY similarity DESC LIMIT {k}"
            
            print(f"SQL query: {sql}")
            # No longer need to use sql_params
            
            # Execute the query without parameters
            cursor.execute(sql)
            
            rows = cursor.fetchall()
            
            # Process the results
            for row in rows:
                try:
                    content, metadata_json, similarity = row
                    
                    # Parse metadata - handle as string if needed
                    if isinstance(metadata_json, dict):
                        metadata = metadata_json
                    elif metadata_json:
                        metadata = json.loads(metadata_json) if isinstance(metadata_json, str) else metadata_json
                    else:
                        metadata = {}
                    
                    # Add similarity score to metadata
                    metadata["similarity"] = similarity
                    
                    # Create document metadata
                    doc_metadata = DocumentMetadata(
                        documentId=metadata.get("documentId", str(uuid.uuid4())),
                        documentName=metadata.get("documentName", "Unknown Document"),
                        chunkId=metadata.get("chunkId", str(uuid.uuid4())),
                        chunkIndex=metadata.get("chunkIndex"),
                        tags=metadata.get("tags", [])
                    )
                    
                    # Create document response
                    doc_response = DocumentResponse(
                        content=content,
                        metadata=doc_metadata,
                        source_id="pgvector-1",
                        source_name="PostgreSQL Vector DB",
                        source_type="pgvector",
                        similarity=similarity
                    )
                    
                    results.append(doc_response)
                except Exception as e:
                    print(f"Error processing row: {e}")
                    print(f"Row data: {row}")
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Error in direct pgvector search: {e}")
            raise
        
        return results
    
    async def _search_store(self, store, query: str, k: int, filter_dict: Dict[str, Any] = None):
        """Helper method to search a vector store with proper filtering"""
        try:
            docs = store.similarity_search(
                query=query,
                k=k,
                filter=filter_dict
            )
            return docs
        except Exception as e:
            print(f"Error in similarity search: {e}")
            return []

# Create a singleton instance
vector_store_service = VectorStoreService() 