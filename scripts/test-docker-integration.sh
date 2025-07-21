#!/bin/bash
# Script to run Docker integration tests

set -e

# Enable debug mode with DEBUG=1
if [ "$DEBUG" = "1" ]; then
  set -x
fi

# Print header
echo "===== Docker Vector Database Integration Tests ====="
echo "This script will test integration with Docker vector databases"
echo ""

# Function to check if Docker is running
check_docker() {
  if ! docker --version > /dev/null 2>&1; then
    echo "❌ Docker not available. Please install Docker and try again."
    exit 1
  fi
  
  echo "✅ Docker is available"
}

# Function to check if containers are running
check_containers() {
  local containers=$(docker ps --format "{{.Names}}" | grep -E "qdrant|weaviate|chroma|postgres" || true)
  
  if [ -z "$containers" ]; then
    echo "⚠️ No vector database containers are currently running"
    
    # Ask user if they want to start containers
    if [ "$AUTO_START" != "1" ]; then
      read -p "Do you want to start the containers with docker-compose? (y/n) " answer
      if [ "$answer" != "y" ]; then
        echo "Continuing without starting containers..."
        return
      fi
    fi
    
    echo "Starting containers with docker-compose..."
    cd pcloud-rag
    docker-compose up -d
    cd ..
    
    echo "Waiting for containers to initialize..."
    sleep 15
  else
    echo "✅ Found running containers:"
    echo "$containers"
  fi
}

# Function to run tests
run_tests() {
  # Clean test results directory
  mkdir -p test-results
  
  echo "Running Docker integration tests..."
  yarn test:docker-integration
}

# Main function
main() {
  # Check requirements
  check_docker
  
  # Check containers if not explicitly skipped
  if [ "$SKIP_CONTAINER_CHECK" != "1" ]; then
    check_containers
  fi
  
  # Run tests
  run_tests
}

# Run main function
main

echo "===== Docker Integration Tests Complete =====" 