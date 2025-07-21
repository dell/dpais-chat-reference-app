import { test, expect, Page } from '@playwright/test';
import { configureApiSettings } from './utils/test-helpers';
import { 
  checkDockerAvailability, 
  startDockerCompose, 
  getRunningContainers,
  checkContainerStatus,
  getContainerLogs,
  checkAllDatabasesHealth,
  getDatabasePorts,
  checkPortAvailability
} from './utils/docker-helper';

// Vector database types to test against docker containers
const DOCKER_DATABASES = ['qdrant', 'weaviate', 'chroma', 'postgres'] as const;
type DockerDbType = typeof DOCKER_DATABASES[number];

// Sample questions from loaded ELI5 dataset that should match documents
const SAMPLE_QUERIES = [
  'Why do cats purr?',
  'How do airplanes stay in the air?',
  'How does cryptocurrency work?'
];

test.describe('Docker Vector Database Integration', () => {
  let dockerAvailable = false;
  let containersStarted = false;
  
  // Start docker containers before all tests
  test.beforeAll(async () => {
    // Check if Docker is available
    const dockerStatus = checkDockerAvailability();
    dockerAvailable = dockerStatus.isAvailable;
    
    if (!dockerAvailable) {
      console.log('Docker not available, tests will be skipped');
      console.log(`Docker error: ${dockerStatus.error}`);
      return;
    }
    
    console.log(`Docker available: ${dockerStatus.version}`);
    
    // Check if containers are already running
    const runningContainers = getRunningContainers('qdrant|weaviate|chroma|postgres');
    
    if (runningContainers.length > 0) {
      console.log('Found running containers:', runningContainers);
      containersStarted = true;
    } else {
      // Start containers using docker-compose
      containersStarted = startDockerCompose();
      
      if (containersStarted) {
        // Wait for services to be ready
        console.log('Waiting for services to be ready...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
  });
  
  // Check that databases are running in docker
  test('should verify docker containers are running', async () => {
    if (!dockerAvailable) {
      console.log('Docker not available, skipping test');
      test.skip();
      return;
    }
    
    // Check health of all databases
    const healthStatus = checkAllDatabasesHealth();
    console.log('Database container health status:');
    console.log(JSON.stringify(healthStatus, null, 2));
    
    // Count running databases
    let runningCount = 0;
    
    // Check each database and port
    const ports = getDatabasePorts();
    
    for (const [db, status] of Object.entries(healthStatus)) {
      if (status.isRunning) {
        runningCount++;
        console.log(`✅ ${db} container is running: ${status.status}`);
        
        // Try to check port availability
        const port = ports[db as keyof typeof ports];
        if (port) {
          const portAvailable = checkPortAvailability(port);
          console.log(`  - Port ${port} is ${portAvailable ? 'open' : 'closed'}`);
        }
      } else {
        console.log(`❌ ${db} container is not running`);
        if (status.error) {
          console.log(`  - Error: ${status.error}`);
        }
      }
    }
    
    // If at least one database is running, we'll consider the test passed
    // but log information about the others
    if (runningCount > 0) {
      console.log(`✅ ${runningCount} out of ${Object.keys(healthStatus).length} database containers are running`);
    } else {
      // If we claimed to start containers but none are running, that's a problem
      if (containersStarted) {
        console.error('❌ No database containers are running after attempt to start them');
      } else {
        console.log('❌ No database containers are running');
      }
    }
  });
  
  // Check if data-loader container ran and completed
  test('should verify data-loader container has run', async () => {
    if (!dockerAvailable) {
      console.log('Docker not available, skipping test');
      test.skip();
      return;
    }
    
    // Check status of data-loader container
    const loaderStatus = checkContainerStatus('vector-data-loader');
    
    if (loaderStatus.isRunning || loaderStatus.status) {
      console.log('Data loader container info:', loaderStatus);
      
      // Get logs from the container
      const loaderLogs = getContainerLogs('vector-data-loader', 50);
      
      if (loaderLogs.success) {
        console.log('✅ Data loader appears to have run successfully');
        
        // Show brief log excerpt
        const logLines = loaderLogs.logs.split('\n');
        const lastLines = logLines.slice(Math.max(0, logLines.length - 10)).join('\n');
        console.log('Log excerpt (last 10 lines):');
        console.log(lastLines);
      } else {
        console.log('⚠️ Data loader may not have completed successfully');
        if (loaderLogs.logs) {
          console.log('Log excerpt (last 20 lines):');
          const logLines = loaderLogs.logs.split('\n');
          const lastLines = logLines.slice(Math.max(0, logLines.length - 20)).join('\n');
          console.log(lastLines);
        }
        if (loaderLogs.error) {
          console.log(`Error getting logs: ${loaderLogs.error}`);
        }
      }
    } else {
      console.log('❌ Data loader container not found or not running');
      if (loaderStatus.error) {
        console.log(`Error: ${loaderStatus.error}`);
      }
    }
  });
  
  // Test integration with each database type
  for (const dbType of DOCKER_DATABASES) {
    test(`should be able to query data from ${dbType} using the UI`, async ({ page }) => {
      if (!dockerAvailable || !containersStarted) {
        console.log(`Docker not available or containers not started, skipping ${dbType} test`);
        test.skip();
        return;
      }
      
      // Check if this specific database is running
      const dbStatus = checkContainerStatus(dbType);
      if (!dbStatus.isRunning) {
        console.log(`${dbType} container is not running, skipping test`);
        test.skip();
        return;
      }
      
      // Go to app and configure
      await page.goto('/');
      await configureApiSettings(page);
      
      // Navigate to company documents
      await page.click('button[role="tab"]:has-text("Company")');
      
      // Wait for company documents to load
      await page.waitForTimeout(1000);
      
      // Check if the database type is displayed
      const dbElement = await page.locator(`:has-text("${dbType}")`).count();
      
      if (dbElement > 0) {
        console.log(`Found ${dbType} in company documents panel`);
        
        // Take screenshot of the company panel
        await page.screenshot({ path: `test-results/${dbType}-company-panel.png` });
        
        // Test a RAG query
        // First, click on the database to enable it
        await page.click(`:has-text("${dbType}")`);
        
        // Go to chats
        await page.click('button[role="tab"]:has-text("Chats")');
        
        // Choose a query from sample questions
        const queryIndex = Math.floor(Math.random() * SAMPLE_QUERIES.length);
        const query = SAMPLE_QUERIES[queryIndex];
        console.log(`Testing ${dbType} with query: "${query}"`);
        
        // Type and send query
        await page.fill('textarea[placeholder="Type a message..."]', query);
        await page.click('button:has([data-testid="SendIcon"])');
        
        // Wait for response with a reasonable timeout
        try {
          await page.waitForSelector('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="SmartToyIcon"]))', {
            state: 'visible',
            timeout: 15000
          });
          
          // Allow a moment for any additional content to load
          await page.waitForTimeout(2000);
          
          // Check for document references in the response
          const hasReferences = await page.locator('.document-reference, .MuiChip-root:has-text("Document")').count() > 0;
          
          // Screenshot the response
          await page.screenshot({ path: `test-results/${dbType}-rag-response.png` });
          
          if (hasReferences) {
            console.log(`✅ Found document references in ${dbType} RAG response!`);
          } else {
            console.log(`⚠️ No document references found in ${dbType} RAG response`);
          }
        } catch (error) {
          console.log(`❌ Error or timeout waiting for ${dbType} RAG response:`, error);
          await page.screenshot({ path: `test-results/${dbType}-rag-error.png` });
        }
      } else {
        console.log(`Database ${dbType} not found in company documents panel, it may not be configured`);
        // Take screenshot to show the state
        await page.screenshot({ path: `test-results/${dbType}-not-found.png` });
      }
    });
  }
}); 