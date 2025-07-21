/**
 * Docker Helper Utility
 * 
 * This module provides helper functions for managing Docker containers
 * during tests, including checks for container status and logs.
 */

import { execSync } from 'child_process';

export interface DockerStatus {
  isAvailable: boolean;
  version?: string;
  error?: string;
}

export interface ContainerStatus {
  isRunning: boolean;
  status?: string;
  error?: string;
}

export interface DockerLogs {
  logs: string;
  success: boolean;
  error?: string;
}

/**
 * Check if Docker is available on the system
 */
export function checkDockerAvailability(): DockerStatus {
  try {
    const version = execSync('docker --version').toString().trim();
    return { isAvailable: true, version };
  } catch (error) {
    return { 
      isAvailable: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Start containers using docker-compose
 */
export function startDockerCompose(): boolean {
  try {
    console.log('Starting docker-compose services...');
    execSync('cd pcloud-rag && docker-compose up -d', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Error starting docker-compose:', error);
    return false;
  }
}

/**
 * Get list of running containers matching a pattern
 */
export function getRunningContainers(pattern: string): string[] {
  try {
    const output = execSync(`docker ps --format "{{.Names}}" | grep -E "${pattern}"`).toString();
    return output.split('\n').filter(line => line.trim() !== '');
  } catch (error) {
    // grep returns non-zero exit code when no matches are found
    return [];
  }
}

/**
 * Check if a specific container is running
 */
export function checkContainerStatus(containerName: string): ContainerStatus {
  try {
    const status = execSync(`docker ps --format "{{.Status}}" --filter "name=${containerName}"`).toString().trim();
    
    if (status) {
      return { isRunning: true, status };
    } else {
      return { isRunning: false };
    }
  } catch (error) {
    return { 
      isRunning: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Get logs from a container
 */
export function getContainerLogs(containerName: string, tail?: number): DockerLogs {
  try {
    let command = `docker logs ${containerName}`;
    if (tail) {
      command += ` --tail ${tail}`;
    }
    
    const logs = execSync(command).toString();
    
    // Look for common success indicators in logs
    const successIndicators = [
      'Documents loaded successfully',
      'Processing complete',
      'Added documents to',
      'Server started',
      'Ready to accept connections'
    ];
    
    const success = successIndicators.some(indicator => logs.includes(indicator));
    
    return { logs, success };
  } catch (error) {
    return { 
      logs: '', 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Check if the database containers are healthy
 */
export function checkAllDatabasesHealth(): Record<string, ContainerStatus> {
  const databases = ['qdrant', 'weaviate', 'chroma', 'postgres'];
  const result: Record<string, ContainerStatus> = {};
  
  for (const db of databases) {
    result[db] = checkContainerStatus(db);
  }
  
  return result;
}

/**
 * Check if a port is available (container is accepting connections)
 */
export function checkPortAvailability(port: number): boolean {
  try {
    // Using nc (netcat) to check if port is open
    execSync(`nc -z localhost ${port}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all database ports
 */
export function getDatabasePorts(): Record<string, number> {
  return {
    qdrant: 6333,
    weaviate: 8080,
    chroma: 8000,
    postgres: 5432
  };
} 