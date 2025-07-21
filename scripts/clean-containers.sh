#!/bin/bash

# Script to clean up existing containers before starting services
# This helps avoid the "container already exists" errors

echo "Cleaning up existing containers..."

# Define containers in dependency order (dependent containers first)
CONTAINERS=("vector-db-api" "pgvector-db")

for CONTAINER in "${CONTAINERS[@]}"; do
  echo "Checking for container: $CONTAINER"
  
  # Check if container exists
  if podman container exists "$CONTAINER"; then
    echo "Container $CONTAINER exists, stopping and removing..."
    podman stop "$CONTAINER" || true
    podman rm "$CONTAINER" || true
    echo "Container $CONTAINER removed."
  else
    echo "Container $CONTAINER doesn't exist, nothing to clean."
  fi
done

echo "Container cleanup completed."
exit 0 