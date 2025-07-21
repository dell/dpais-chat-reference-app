#!/bin/bash
# Script to convert between Docker Compose and Podman Compose
# Usage: ./docker-to-podman.sh [docker|podman] [path-to-compose-file]

set -e

# Default values
CONVERT_TO="podman"
COMPOSE_FILE="backend/docker-compose.yml"
OUTPUT_FILE=""

# Parse arguments
if [ $# -ge 1 ]; then
  CONVERT_TO="$1"
fi

if [ $# -ge 2 ]; then
  COMPOSE_FILE="$2"
fi

# Check if the file exists
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Error: Compose file '$COMPOSE_FILE' not found."
  exit 1
fi

# Set output file name based on conversion direction
if [ "$CONVERT_TO" = "podman" ]; then
  OUTPUT_FILE="${COMPOSE_FILE/docker-compose.yml/podman-compose.yml}"
  echo "Converting Docker Compose to Podman Compose: $COMPOSE_FILE -> $OUTPUT_FILE"
elif [ "$CONVERT_TO" = "docker" ]; then
  OUTPUT_FILE="${COMPOSE_FILE/podman-compose.yml/docker-compose.yml}"
  echo "Converting Podman Compose to Docker Compose: $COMPOSE_FILE -> $OUTPUT_FILE"
else
  echo "Error: Invalid conversion direction. Use 'docker' or 'podman'."
  exit 1
fi

# If input and output are the same, create a backup
if [ "$COMPOSE_FILE" = "$OUTPUT_FILE" ]; then
  BACKUP_FILE="${COMPOSE_FILE}.backup"
  echo "Input and output files are the same. Creating backup at $BACKUP_FILE"
  cp "$COMPOSE_FILE" "$BACKUP_FILE"
  # Set output to a temporary file and move it later
  OUTPUT_FILE="${COMPOSE_FILE}.tmp"
fi

# Copy the file first
cp "$COMPOSE_FILE" "$OUTPUT_FILE"

# Make adjustments based on conversion direction
if [ "$CONVERT_TO" = "podman" ]; then
  # Docker to Podman adjustments
  
  # Check for host.docker.internal references and replace them
  if grep -q "host.docker.internal" "$OUTPUT_FILE"; then
    echo "Replacing host.docker.internal references with host.containers.internal"
    sed -i 's/host.docker.internal/host.containers.internal/g' "$OUTPUT_FILE"
  fi
  
  # Add podman-specific volume mount options if needed
  # (This is a placeholder - add specific conversions as needed)
  
elif [ "$CONVERT_TO" = "docker" ]; then
  # Podman to Docker adjustments
  
  # Check for host.containers.internal references and replace them
  if grep -q "host.containers.internal" "$OUTPUT_FILE"; then
    echo "Replacing host.containers.internal references with host.docker.internal"
    sed -i 's/host.containers.internal/host.docker.internal/g' "$OUTPUT_FILE"
  fi
  
  # Remove podman-specific options
  # (This is a placeholder - add specific conversions as needed)
fi

# If we used a temporary file, move it to the final location
if [[ "$OUTPUT_FILE" == *.tmp ]]; then
  mv "$OUTPUT_FILE" "${OUTPUT_FILE%.tmp}"
  echo "Converted file saved to ${OUTPUT_FILE%.tmp}"
else
  echo "Converted file saved to $OUTPUT_FILE"
fi

echo "Conversion complete!" 