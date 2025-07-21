import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * Vector database types supported in the application
 */
export type VectorDbType = 'milvus' | 'qdrant' | 'weaviate' | 'chroma' | 'pgvector';

/**
 * Helper class to manage vector database containers
 */
export class VectorDbManager {
  private readonly projectRoot: string;
  private readonly pcloudRagPath: string;
  private runningContainers: string[] = [];
  private composeCommand: string = '';
  private containerRuntime: 'docker' | 'podman' | null = null;

  constructor() {
    // Determine project root based on current file path
    this.projectRoot = process.cwd();
    this.pcloudRagPath = path.join(this.projectRoot, 'pcloud-rag');
  }

  /**
   * Detect which container management tool is available (docker-compose or podman-compose)
   */
  private async detectComposeCommand(): Promise<string> {
    if (this.composeCommand) {
      return this.composeCommand;
    }

    try {
      // Check if Podman is running
      const podmanRunning = await this.isRuntimeRunning('podman');
      
      // Check if Docker is running
      const dockerRunning = await this.isRuntimeRunning('docker');
      
      console.log(`Container runtime status: Podman running: ${podmanRunning}, Docker running: ${dockerRunning}`);
      
      // If Podman is running, try podman-compose first
      if (podmanRunning) {
        this.containerRuntime = 'podman';
        
        try {
          await execAsync('podman-compose --version');
          this.composeCommand = 'podman-compose';
          console.log('Using podman-compose for container management');
          return this.composeCommand;
        } catch (error) {
          // Podman-compose not available, try Docker Compose with Podman
          try {
            // Check if Docker Compose is configured to use Podman
            await execAsync('docker-compose --version');
            
            // Verify if it's using Podman by checking environment variables
            const { stdout: envOutput } = await execAsync('env | grep -E "DOCKER_HOST|DOCKER_SOCK"');
            if (envOutput.includes('podman')) {
              this.composeCommand = 'docker-compose';
              console.log('Using docker-compose with Podman backend');
              return this.composeCommand;
            }
          } catch (composeError) {
            // Try Docker Compose plugin directly
            try {
              await execAsync('podman compose version');
              this.composeCommand = 'podman compose';
              console.log('Using podman compose for container management');
              return this.composeCommand;
            } catch (dockerComposeError) {
              // No compose tool available for Podman
              console.warn('Podman is running but no compatible compose tool found');
            }
          }
        }
      }
      
      // If Docker is running, use Docker Compose
      if (dockerRunning) {
        this.containerRuntime = 'docker';
        
        try {
          // Try Docker Compose v1 first
          await execAsync('docker-compose --version');
          this.composeCommand = 'docker-compose';
          console.log('Using docker-compose for container management');
          return this.composeCommand;
        } catch (error) {
          try {
            // Try Docker Compose v2 next
            await execAsync('docker compose version');
            this.composeCommand = 'docker compose';
            console.log('Using docker compose (v2) for container management');
            return this.composeCommand;
          } catch (composeError) {
            console.warn('Docker is running but no compose tool found');
          }
        }
      }
      
      // If we're here, neither runtime is available or working correctly
      throw new Error('No working container runtime (Docker or Podman) detected');
      
    } catch (error) {
      // No container runtime available
      console.error(`Failed to detect container runtime: ${error.message}`);
      throw new Error('Neither podman-compose nor docker-compose is available with a working container runtime');
    }
  }
  
  /**
   * Check if a container runtime (Docker or Podman) is running
   */
  private async isRuntimeRunning(runtime: 'docker' | 'podman'): Promise<boolean> {
    try {
      if (runtime === 'docker') {
        await execAsync('docker info');
        return true;
      } else {
        await execAsync('podman info');
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Attempt to clean up any existing containers to avoid name conflicts
   * @param services List of service names to clean up
   */
  private async cleanupExistingContainers(services: string[]): Promise<void> {
    if (!this.containerRuntime || !this.composeCommand) {
      return;
    }

    try {
      // Change to the pcloud-rag directory
      process.chdir(this.pcloudRagPath);
      
      console.log('Cleaning up any existing containers to avoid conflicts...');
      
      // First try using compose down to clean everything
      try {
        await execAsync(`${this.composeCommand} down --remove-orphans -v`);
        console.log('Successfully ran compose down with --remove-orphans flag');
      } catch (error) {
        console.warn('Error running compose down, will try alternative cleanup:', error.message);
      }
      
      // Wait for short time to ensure compose down completes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For Docker or Podman, try to remove containers directly if possible
      try {
        // Try different cleanup strategies based on the runtime
        if (this.containerRuntime === 'podman') {
          // Try cleaning up with podman directly
          try {
            // List all podman containers that might be related to our services
            const { stdout: containerList } = await execAsync('podman ps -a --format "{{.Names}}"');
            const containers = containerList.split('\n').filter(Boolean);
            
            // Find potential matches (including pcloud-rag_ prefix)
            for (const service of services) {
              const matchingContainers = containers.filter(name => 
                name === service || 
                name.includes(`_${service}`) || 
                name.includes(`${service}_`) ||
                name.includes(`pcloud-rag_${service}`)
              );
              
              if (matchingContainers.length > 0) {
                console.log(`Found ${matchingContainers.length} containers matching ${service}`);
                for (const container of matchingContainers) {
                  try {
                    await execAsync(`podman rm -f "${container}"`);
                    console.log(`Removed container: ${container}`);
                  } catch (rmError) {
                    console.warn(`Failed to remove container ${container}:`, rmError.message);
                  }
                }
              }
            }
            
            // Additionally, remove any podman containers with "qdrant" in their name (common issue)
            try {
              await execAsync('podman rm -f $(podman ps -a -q --filter name=qdrant)');
            } catch (qdrantError) {
              // Ignore if no containers match
            }
          } catch (podmanError) {
            console.warn('Error listing podman containers:', podmanError.message);
          }
        } else if (this.containerRuntime === 'docker') {
          // Try cleaning up with docker directly
          try {
            // List all Docker containers that might be related to our services
            const { stdout: containerList } = await execAsync('docker ps -a --format "{{.Names}}"');
            const containers = containerList.split('\n').filter(Boolean);
            
            // Find potential matches (including pcloud-rag_ prefix)
            for (const service of services) {
              const matchingContainers = containers.filter(name => 
                name === service || 
                name.includes(`_${service}`) || 
                name.includes(`${service}_`) ||
                name.includes(`pcloud-rag_${service}`)
              );
              
              if (matchingContainers.length > 0) {
                console.log(`Found ${matchingContainers.length} containers matching ${service}`);
                for (const container of matchingContainers) {
                  try {
                    await execAsync(`docker rm -f "${container}"`);
                    console.log(`Removed container: ${container}`);
                  } catch (rmError) {
                    console.warn(`Failed to remove container ${container}:`, rmError.message);
                  }
                }
              }
            }
            
            // Additionally, remove any docker containers with "qdrant" in their name (common issue)
            try {
              await execAsync('docker rm -f $(docker ps -a -q --filter name=qdrant)');
            } catch (qdrantError) {
              // Ignore if no containers match
            }
          } catch (dockerError) {
            console.warn('Error listing docker containers:', dockerError.message);
          }
        }
      } catch (runtimeError) {
        console.warn('Error cleaning up containers directly:', runtimeError.message);
      }
      
      // Try forcing a system prune to clean up any stuck resources
      try {
        if (this.containerRuntime === 'podman') {
          await execAsync('podman system prune -f');
        } else if (this.containerRuntime === 'docker') {
          await execAsync('docker system prune -f');
        }
        console.log('Performed system prune to clean up resources');
      } catch (pruneError) {
        console.warn('Error during system prune:', pruneError.message);
      }
      
      // Return to original directory
      process.chdir(this.projectRoot);
    } catch (error) {
      console.warn('Error during container cleanup:', error.message);
      // Return to the original directory in case of error
      try {
        process.chdir(this.projectRoot);
      } catch (cdError) {
        // Ignore
      }
    }
  }

  /**
   * Start vector database containers using the available compose tool
   * @param dbs Array of vector database types to start
   */
  async startContainers(dbs: VectorDbType[] = ['qdrant']): Promise<void> {
    // Detect which compose command to use
    try {
      await this.detectComposeCommand();
    } catch (error) {
      console.error(error.message);
      console.warn('Skipping container startup - tests will run against already running services or fail');
      // Don't block test execution completely
      return;
    }

    // Build the service list for compose
    const services: string[] = [];
    
    // Map vector DB types to their service names in docker-compose.yml
    for (const db of dbs) {
      switch (db) {
        case 'milvus':
          services.push('milvus-standalone');
          services.push('etcd');
          services.push('minio');
          break;
        case 'qdrant':
          services.push('qdrant');
          break;
        case 'weaviate':
          services.push('weaviate');
          break;
        case 'chroma':
          services.push('chroma');
          break;
        case 'pgvector':
          services.push('postgres');
          break;
      }
    }

    // If no services were selected, exit early
    if (services.length === 0) {
      console.log('No vector database services selected to start');
      return;
    }

    try {
      // Check if pcloud-rag directory exists
      if (!fs.existsSync(this.pcloudRagPath)) {
        throw new Error(`pcloud-rag directory not found at ${this.pcloudRagPath}. Tests will run against already running services or fail.`);
      }

      // Clean up any existing containers first to avoid name conflicts
      await this.cleanupExistingContainers(services);

      // If Docker Compose file needs modification for the runtime
      const composeFilePath = path.join(this.pcloudRagPath, 'docker-compose.yml');
      
      // Fix version attribute in docker-compose.yml if causing issues
      if (fs.existsSync(composeFilePath)) {
        try {
          let composeContent = fs.readFileSync(composeFilePath, 'utf8');
          
          // If using Podman and version is specified, fix it
          if (this.containerRuntime === 'podman' && composeContent.includes('version:')) {
            composeContent = composeContent.replace(/version:\s*['"]?[0-9.]+['"]?/g, '# version removed for Podman compatibility');
            // Create a backup
            fs.writeFileSync(`${composeFilePath}.bak`, composeContent);
            // Write updated file
            fs.writeFileSync(composeFilePath, composeContent);
            console.log('Updated docker-compose.yml for better Podman compatibility');
          }
        } catch (fileError) {
          console.warn('Could not modify compose file:', fileError.message);
        }
      }

      // Change to the pcloud-rag directory
      process.chdir(this.pcloudRagPath);
      
      // Start only the selected services
      const servicesStr = services.join(' ');
      console.log(`Starting vector database containers: ${servicesStr}`);
      
      // Use compose to start the services
      try {
        // First try running directly
        const { stdout } = await execAsync(`${this.composeCommand} up -d ${servicesStr}`);
        console.log(stdout);
      } catch (composeError) {
        // If that fails and we're using Docker Compose with Podman backend, try with podman socket service
        if (this.containerRuntime === 'podman' && this.composeCommand === 'docker-compose') {
          console.log('Trying to start podman socket service before retrying...');
          try {
            await execAsync('systemctl --user start podman.socket');
            // Retry the command
            const { stdout } = await execAsync(`${this.composeCommand} up -d ${servicesStr}`);
            console.log(stdout);
          } catch (socketError) {
            console.error('Failed to start podman socket service:', socketError.message);
            throw composeError;
          }
        } else {
          throw composeError;
        }
      }
      
      this.runningContainers = services;
      
      // Return to the original directory
      process.chdir(this.projectRoot);
      
      // Wait for containers to be ready
      await this.waitForContainersReady(dbs);
    } catch (error) {
      console.error('Error starting containers:', error);
      console.warn('Continuing tests with existing services...');
      
      // Return to the original directory in case of error
      try {
        process.chdir(this.projectRoot);
      } catch (cdError) {
        // Ignore
      }
    }
  }

  /**
   * Stop all running containers
   */
  async stopContainers(): Promise<void> {
    if (this.runningContainers.length === 0 || !this.composeCommand) {
      return;
    }

    try {
      // Check if pcloud-rag directory exists
      if (!fs.existsSync(this.pcloudRagPath)) {
        return;
      }

      // Change to the pcloud-rag directory
      process.chdir(this.pcloudRagPath);
      
      // Stop all the running services
      console.log('Stopping vector database containers');
      
      // Use compose to stop the services
      const { stdout } = await execAsync(`${this.composeCommand} down`);
      console.log(stdout);
      
      this.runningContainers = [];
      
      // Return to the original directory
      process.chdir(this.projectRoot);
    } catch (error) {
      console.error('Error stopping containers:', error);
      
      // Return to the original directory in case of error
      try {
        process.chdir(this.projectRoot);
      } catch (cdError) {
        // Ignore
      }
    }
  }

  /**
   * Check if a vector database is running at its expected address
   */
  async isVectorDatabaseRunning(dbType: VectorDbType): Promise<boolean> {
    try {
      switch (dbType) {
        case 'qdrant':
          // Try to connect to Qdrant's health endpoint
          await execAsync('curl -s http://localhost:6333/healthz');
          return true;
        case 'weaviate':
          // Try to connect to Weaviate's ready endpoint
          await execAsync('curl -s http://localhost:8080/v1/.well-known/ready');
          return true;
        case 'chroma':
          // Try to connect to Chroma's heartbeat endpoint
          await execAsync('curl -s http://localhost:8000/api/v1/heartbeat');
          return true;
        case 'pgvector':
          // Try to connect to PostgreSQL
          await execAsync('pg_isready -h localhost -p 5432 -U postgres');
          return true;
        case 'milvus':
          // Try to connect to Milvus health endpoint
          await execAsync('curl -s http://localhost:9091/healthz');
          return true;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for containers to be ready by checking their health endpoints
   */
  private async waitForContainersReady(dbs: VectorDbType[]): Promise<void> {
    // Maximum time to wait in milliseconds
    const maxWaitTime = 30000;
    const startTime = Date.now();
    
    // Check each database type
    for (const db of dbs) {
      let isReady = false;
      
      while (!isReady && Date.now() - startTime < maxWaitTime) {
        isReady = await this.isVectorDatabaseRunning(db);
        
        if (!isReady) {
          // Not ready yet, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!isReady) {
        console.warn(`Warning: ${db} database not ready after ${maxWaitTime}ms, tests may fail`);
      } else {
        console.log(`${db} database is ready`);
      }
    }
  }

  /**
   * Create vector store configurations for each database type
   * @returns Vector store configurations for the UI
   */
  getVectorStoreConfigs(): Record<VectorDbType, any> {
    return {
      qdrant: {
        name: "Test Qdrant",
        type: "qdrant",
        url: "http://localhost:6333",
        collectionName: "test_collection",
        enabled: true,
        tags: ["test"]
      },
      weaviate: {
        name: "Test Weaviate",
        type: "weaviate",
        url: "http://localhost:8080",
        className: "TestClass",
        enabled: true,
        tags: ["test"]
      },
      chroma: {
        name: "Test Chroma",
        type: "chroma",
        url: "http://localhost:8000",
        collectionName: "test_collection",
        enabled: true,
        tags: ["test"]
      },
      pgvector: {
        name: "Test PGVector",
        type: "pgvector",
        connectionString: "postgresql://postgres:postgres@localhost:5432/vectordb",
        tableName: "test_vectors",
        enabled: true,
        tags: ["test"]
      },
      milvus: {
        name: "Test Milvus",
        type: "milvus",
        url: "localhost",
        port: 19530,
        collectionName: "test_collection",
        enabled: true,
        tags: ["test"]
      }
    };
  }
} 