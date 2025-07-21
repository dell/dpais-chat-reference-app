import pytest
import subprocess
import time
import os
import requests
from pathlib import Path

def is_port_in_use(port):
    """Check if a port is in use"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

@pytest.mark.skip("Integration test - run manually")
def test_backend_api_connection():
    """
    Integration test to verify backend API connection from the frontend
    
    This test:
    1. Starts the backend API server
    2. Makes requests to the API endpoints
    3. Verifies the expected responses
    """
    backend_port = 8000
    
    # Skip if port is already in use
    if is_port_in_use(backend_port):
        print(f"Port {backend_port} is already in use - assuming API is running")
    else:
        # Start the backend API server in a subprocess
        api_process = subprocess.Popen(
            ["python", "run.py"],
            cwd=str(Path(__file__).parents[2]),  # backend directory
            env={**os.environ, "API_PORT": str(backend_port)}
        )
        
        # Give the server time to start up
        print("Waiting for API server to start...")
        time.sleep(2)
        
        # Ensure we clean up the process when done
        try:
            # Check that the server is running
            health_check_url = f"http://localhost:{backend_port}/health"
            response = None
            for _ in range(5):  # Try a few times
                try:
                    response = requests.get(health_check_url)
                    if response.status_code == 200:
                        break
                except requests.exceptions.ConnectionError:
                    time.sleep(1)
            
            assert response is not None, "Failed to connect to API server"
            assert response.status_code == 200, "API server health check failed"
            
            # Test calling the vector stores endpoint
            vector_stores_url = f"http://localhost:{backend_port}/vector-stores"
            vs_response = requests.get(vector_stores_url)
            assert vs_response.status_code == 200
            assert isinstance(vs_response.json(), list)
            
            # Test calling the collections endpoint
            collections_url = f"http://localhost:{backend_port}/collections"
            collections_response = requests.get(collections_url)
            assert collections_response.status_code == 200
            assert isinstance(collections_response.json(), list)
            
            # Test a search query
            search_url = f"http://localhost:{backend_port}/search?query=test&k=1"
            search_response = requests.get(search_url)
            assert search_response.status_code == 200
            assert isinstance(search_response.json(), list)
            
            print("API Integration test successful!")
            
        finally:
            # Clean up the subprocess
            api_process.terminate()
            api_process.wait(timeout=5)

if __name__ == "__main__":
    # Run the test directly for manual testing
    test_backend_api_connection() 