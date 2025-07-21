#!/usr/bin/env python3
"""
Test script to verify connection to PGVector and API
"""
import os
import requests
import psycopg2
import json

# Database connection parameters - using host networking
DB_CONNECTION = "postgresql://postgres:postgres@localhost:5432/vectordb"

# API details
API_URL = "http://localhost:8000"

def test_database_connection():
    """Test connection to the pgvector database"""
    print("\n=== Testing Database Connection ===")
    try:
        # Connect to the database
        print(f"Connecting to {DB_CONNECTION}...")
        conn = psycopg2.connect(DB_CONNECTION)
        print("✅ Connection successful!")
        
        # Check pgvector extension
        with conn.cursor() as cursor:
            cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
            version = cursor.fetchone()
            if version:
                print(f"✅ pgvector extension installed (version {version[0]})")
            else:
                print("❌ pgvector extension not found!")
        
        # Check tables
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)
            tables = cursor.fetchall()
            print(f"Tables in database: {[t[0] for t in tables]}")
            
            # Check documents table
            if ('documents',) in tables:
                cursor.execute("SELECT COUNT(*) FROM documents;")
                count = cursor.fetchone()[0]
                print(f"✅ Documents table exists with {count} records")
                
                if count > 0:
                    cursor.execute("SELECT id, content, metadata FROM documents LIMIT 1;")
                    doc = cursor.fetchone()
                    print(f"  Sample document ID: {doc[0]}")
                    print(f"  Content snippet: {doc[1][:100]}...")
                    print(f"  Metadata: {doc[2]}")
                    
                    # Check embedding dimensions
                    cursor.execute("""
                        SELECT vector_dims(embedding) 
                        FROM documents 
                        WHERE embedding IS NOT NULL 
                        LIMIT 1;
                    """)
                    dims = cursor.fetchone()
                    if dims:
                        print(f"✅ Vector dimensions: {dims[0]}")
                    else:
                        print("❌ No embeddings found in documents!")
            else:
                print("❌ Documents table not found!")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")

def test_api_connection():
    """Test connection to the API"""
    print("\n=== Testing API Connection ===")
    
    try:
        # Test health endpoint
        health_url = f"{API_URL}/health"
        print(f"Testing API health endpoint: {health_url}")
        response = requests.get(health_url)
        
        if response.status_code == 200:
            print(f"✅ API is healthy: {response.json()}")
        else:
            print(f"❌ API health check failed: {response.status_code}")
        
        # Test vector db status
        vectordb_url = f"{API_URL}/vector-stores/status"
        print(f"Testing Vector DB status endpoint: {vectordb_url}")
        response = requests.get(vectordb_url)
        
        if response.status_code == 200:
            print(f"✅ Vector DB status: {response.json()}")
        else:
            print(f"❌ Vector DB status check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ API connection error: {e}")

if __name__ == "__main__":
    test_database_connection()
    test_api_connection() 