import openai
from app.config import OPENAI_API_KEY, OPENAI_API_BASE, EMBEDDINGS_MODEL
import logging

# logging.basicConfig(level=logging.DEBUG)  # or logging.INFO
# logging.getLogger("langchain").setLevel(logging.DEBUG)

# Set up OpenAI client
client = openai.OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_API_BASE
)

class EmbeddingsService:
    """Service for creating embeddings directly using OpenAI API"""
    
    def __init__(self):
        """Initialize the embeddings service"""
        print("=====Starting embeddings service=====")
        print(f"OPENAI_API_KEY: {OPENAI_API_KEY}")
        print(f"EMBEDDINGS_MODEL: {EMBEDDINGS_MODEL}")
        print(f"OPENAI_API_BASE: {OPENAI_API_BASE}")
    
    def embed_query(self, text: str) -> list:
        """Create embeddings for a query text"""
        try:
            print(f"Creating embedding for text: {text[:50]}...")
            response = client.embeddings.create(
                model=EMBEDDINGS_MODEL,
                input="search_query: " + text,
                encoding_format="float"
            )
            # Extract the embedding vector from the response
            embedding = response.data[0].embedding
            print(f"Successfully created embedding with dimension: {len(embedding)}")
            return embedding
        except Exception as e:
            print(f"Error creating embedding: {e}")
            raise

    def embed_documents(self, texts: list) -> list:
        """Create embeddings for multiple documents"""
        try:
            # add search_query: to the beginning of the every element in the list using lambda
            texts_nomic = list(map(lambda x: "search_query: " + x, texts))
            print(f"Creating embeddings for {len(texts)} documents")
            response = client.embeddings.create(
                model=EMBEDDINGS_MODEL,
                input=texts_nomic,
                encoding_format="float"
            )
            # Extract the embedding vectors from the response
            embeddings = [item.embedding for item in response.data]
            print(f"Successfully created {len(embeddings)} embeddings")
            return embeddings
        except Exception as e:
            print(f"Error creating document embeddings: {e}")
            raise

# Create a singleton instance for compatibility with existing code
embeddings_service = EmbeddingsService()

# Function to create embeddings for backward compatibility
def create_embeddings():
    """Return the embeddings service instance for backward compatibility"""
    return embeddings_service 