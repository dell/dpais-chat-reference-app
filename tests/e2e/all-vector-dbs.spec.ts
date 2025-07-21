import { test, expect } from '@playwright/test';
import { configureApiSettings } from './utils/test-helpers';
import { DocumentTestHelpers } from './utils/document-test-helpers';
import { VectorDbManager, VectorDbType } from './utils/vector-db-setup';

// Vector database manager to start/stop containers
const dbManager = new VectorDbManager();

// All supported vector database types
const allVectorDbs: VectorDbType[] = [
  'qdrant',
  'weaviate',
  'chroma',
  'pgvector',
  'milvus'
];

// Track test results for each database
const testResults: Record<VectorDbType, { 
  connected: boolean, 
  documentUploaded: boolean, 
  retrievalWorked: boolean
}> = Object.fromEntries(
  allVectorDbs.map(db => [db, { 
    connected: false, 
    documentUploaded: false, 
    retrievalWorked: false 
  }])
) as any;

// Global setup - start each database container before tests
test.beforeAll(async () => {
  console.log('This test will start and test each vector database type sequentially');
});

test.describe('All Vector Database Types', () => {
  // Sequential tests for each database type
  for (const dbType of allVectorDbs) {
    test.describe(`${dbType} Tests`, () => {
      // Track whether this database's container was started
      let dbContainerStarted = false;
      
      // Setup database container before tests for this DB type
      test.beforeAll(async () => {
        console.log(`Starting ${dbType} container...`);
        try {
          await dbManager.startContainers([dbType]);
          
          // Check if the database is actually running
          if (await dbManager.isVectorDatabaseRunning(dbType)) {
            dbContainerStarted = true;
            console.log(`${dbType} is running`);
          } else {
            console.warn(`${dbType} not running. Tests may be skipped.`);
          }
        } catch (error) {
          console.error(`Failed to start ${dbType} container:`, error);
          console.warn('Tests will proceed and check if the service is already running.');
          
          // Still check if the database is already running
          if (await dbManager.isVectorDatabaseRunning(dbType)) {
            console.log(`${dbType} is already running externally`);
            dbContainerStarted = true;
          }
        }
      });
      
      // Teardown database container after tests for this DB type
      test.afterAll(async () => {
        if (dbContainerStarted) {
          console.log(`Stopping ${dbType} container...`);
          await dbManager.stopContainers();
        } else {
          console.log(`No ${dbType} container was started by the test, skipping cleanup.`);
        }
      });
      
      test(`should connect to ${dbType}`, async ({ page }) => {
        // Check if the database is running before attempting the test
        const dbRunning = await dbManager.isVectorDatabaseRunning(dbType);
        test.skip(!dbRunning, `Skipping test because ${dbType} is not running`);
        
        // Set up API settings
        await page.goto('/');
        await configureApiSettings(page);
        
        // Wait for chat interface to be ready
        await page.waitForSelector('[placeholder="Type a message..."]', { state: 'visible' });
        
        // Configure the vector database
        const dbConfigs = dbManager.getVectorStoreConfigs();
        await DocumentTestHelpers.configureVectorDatabase(page, dbType, dbConfigs[dbType]);
        
        // Take a screenshot
        await page.screenshot({ path: `test-results/${dbType}-connection.png` });
        
        // Test the database connection
        const connectionSuccess = await DocumentTestHelpers.testDatabaseConnection(page, dbType);
        
        // Record result
        testResults[dbType].connected = connectionSuccess;
        
        // Assert connection was successful
        expect(connectionSuccess).toBeTruthy();
      });
      
      test(`should upload and store document in ${dbType}`, async ({ page }) => {
        // Skip if previous test failed
        test.skip(!testResults[dbType].connected, `Skipping test because ${dbType} connection failed`);
        
        // Check if the database is running
        const dbRunning = await dbManager.isVectorDatabaseRunning(dbType);
        test.skip(!dbRunning, `Skipping test because ${dbType} is not running`);
        
        // Set up API settings
        await page.goto('/');
        await configureApiSettings(page);
        
        // Wait for chat interface to be ready
        await page.waitForSelector('[placeholder="Type a message..."]', { state: 'visible' });
        
        // Configure the vector database
        const dbConfigs = dbManager.getVectorStoreConfigs();
        await DocumentTestHelpers.configureVectorDatabase(page, dbType, dbConfigs[dbType]);
        
        // Navigate to document upload page
        await DocumentTestHelpers.navigateToDocumentUpload(page);
        
        // Upload the test document
        await DocumentTestHelpers.uploadDocument(page, 'test-document.pdf');
        
        // Take a screenshot after upload
        await page.screenshot({ path: `test-results/${dbType}-upload.png` });
        
        // Wait for document processing and indexing
        await page.waitForTimeout(5000);
        
        // Verify the document appears in the list
        const documentCount = await page.locator('.document-item, .document-card').count();
        
        // Record result
        testResults[dbType].documentUploaded = documentCount > 0;
        
        expect(documentCount).toBeGreaterThan(0);
      });
      
      test(`should retrieve information from ${dbType}`, async ({ page }) => {
        // Skip if previous test failed
        test.skip(!testResults[dbType].documentUploaded, `Skipping test because document upload failed for ${dbType}`);
        
        // Check if the database is running
        const dbRunning = await dbManager.isVectorDatabaseRunning(dbType);
        test.skip(!dbRunning, `Skipping test because ${dbType} is not running`);
        
        // Set up API settings
        await page.goto('/');
        await configureApiSettings(page);
        
        // Wait for chat interface to be ready
        await page.waitForSelector('[placeholder="Type a message..."]', { state: 'visible' });
        
        // Configure the vector database
        const dbConfigs = dbManager.getVectorStoreConfigs();
        await DocumentTestHelpers.configureVectorDatabase(page, dbType, dbConfigs[dbType]);
        
        // Test document retrieval with a specific query
        const retrievalQuery = "What are the key features of the RAG system?";
        
        // Test document retrieval
        const retrievalSuccess = await DocumentTestHelpers.testDocumentRetrieval(page, retrievalQuery);
        
        // Take a screenshot after querying
        await page.screenshot({ path: `test-results/${dbType}-retrieval.png` });
        
        // Record result
        testResults[dbType].retrievalWorked = retrievalSuccess;
        
        expect(retrievalSuccess).toBeTruthy();
      });
    });
  }
  
  // Final test to summarize all results
  test('should summarize all vector database test results', async ({ page }) => {
    // Print summary table to console
    console.log('\n=== Vector Database Test Results ===');
    console.log('Database Type | Connection | Document Upload | Retrieval');
    console.log('-------------|------------|----------------|----------');
    
    for (const dbType of allVectorDbs) {
      const results = testResults[dbType];
      console.log(`${dbType.padEnd(13)}| ${formatResult(results.connected)} | ${formatResult(results.documentUploaded)} | ${formatResult(results.retrievalWorked)}`);
    }
    
    // Take a screenshot of the app in its final state
    await page.goto('/');
    await configureApiSettings(page);
    await page.screenshot({ path: 'test-results/final-state.png' });
    
    // This is a meta-test, so it always passes
    expect(true).toBeTruthy();
  });
});

// Helper function to format test results
function formatResult(result: boolean): string {
  return result ? '✅ PASS' : '❌ FAIL';
} 