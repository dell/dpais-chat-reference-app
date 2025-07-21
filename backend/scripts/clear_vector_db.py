#!/usr/bin/env python3
"""
Clear Vector DB - A script to clear data from the pgvector database
"""
import argparse
import logging
import psycopg2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('clear_vector_db')

def clear_database(connection_string, table_name="documents", clear_collections=True):
    """Clear data from the pgvector database"""
    
    logger.info(f"Connecting to database: {connection_string}")
    conn = psycopg2.connect(connection_string)
    
    try:
        with conn.cursor() as cursor:
            # Check if table exists
            cursor.execute(f"""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_name = %s
                );
            """, (table_name,))
            table_exists = cursor.fetchone()[0]
            
            if table_exists:
                logger.info(f"Clearing data from table: {table_name}")
                cursor.execute(f"DELETE FROM {table_name};")
                logger.info(f"Table {table_name} cleared successfully")
            else:
                logger.info(f"Table {table_name} does not exist, nothing to clear")
            
            # Clear collections table if requested
            if clear_collections:
                cursor.execute("""
                    SELECT EXISTS (
                       SELECT FROM information_schema.tables 
                       WHERE table_name = 'collections'
                    );
                """)
                collections_exists = cursor.fetchone()[0]
                
                if collections_exists:
                    logger.info("Clearing data from collections table")
                    cursor.execute("DELETE FROM collections;")
                    logger.info("Collections table cleared successfully")
                else:
                    logger.info("Collections table does not exist, nothing to clear")
            
            conn.commit()
    
    finally:
        conn.close()

def parse_arguments():
    parser = argparse.ArgumentParser(description="Clear data from the pgvector database")
    
    parser.add_argument('--connection-string', type=str, 
                       default="postgresql://postgres:postgres@localhost:5432/vectordb",
                       help='PostgreSQL connection string')
    
    parser.add_argument('--table-name', type=str, default="documents", 
                       help='Name of the table to clear')
    
    parser.add_argument('--clear-collections', action='store_true',
                       help='Whether to clear the collections table as well')
    
    return parser.parse_args()

def main():
    args = parse_arguments()
    clear_database(
        connection_string=args.connection_string,
        table_name=args.table_name,
        clear_collections=args.clear_collections
    )

if __name__ == "__main__":
    main() 