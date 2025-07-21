import { Page } from '@playwright/test';
import * as path from 'path';
import { VectorDbType } from './vector-db-setup';

/**
 * Helper functions for testing document upload and vector database functionality
 */
export class DocumentTestHelpers {
  /**
   * Navigate to the document upload page
   */
  static async navigateToDocumentUpload(page: Page): Promise<void> {
    // Navigate to documents section
    await page.click('button:has-text("Documents"), a:has-text("Documents")');
    
    // Ensure we're on the document upload page
    await page.waitForSelector('input[type="file"]', { state: 'visible', timeout: 10000 });
  }

  /**
   * Upload a test document
   * @param page Playwright page
   * @param fileName Name of the file in the fixtures directory to upload
   */
  static async uploadDocument(page: Page, fileName: string): Promise<void> {
    // Get the path to the test document
    const testFilePath = path.join(process.cwd(), 'tests/fixtures', fileName);
    console.log(`Uploading document from: ${testFilePath}`);
    
    // Set the file input
    await page.setInputFiles('input[type="file"]', testFilePath);
    
    // Wait for upload to complete (looking for success message or completion indicator)
    try {
      // Wait for the document to appear in the list
      await page.waitForSelector('.document-item, .document-card', { 
        state: 'visible', 
        timeout: 30000 // Increased timeout for document processing
      });
      console.log('Document upload completed');
    } catch (error) {
      console.error('Error waiting for document upload:', error);
      throw new Error('Document upload failed or timed out');
    }
  }

  /**
   * Configure a vector database connection in the UI
   * @param page Playwright page
   * @param dbType Type of vector database
   * @param config Configuration object for the database
   */
  static async configureVectorDatabase(page: Page, dbType: VectorDbType, config: any): Promise<void> {
    // Take a screenshot before attempting to open settings to debug UI state
    await page.screenshot({ path: `test-results/${dbType}-before-settings.png` });
    
    // Make sure we're on the main page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log(`Configuring ${dbType} vector database`);
    
    // Try different ways to access settings with better error handling
    try {
      // Look for the settings button with a more flexible selector
      // First try to find if using the exact text "Settings"
      const settingsButton = page.locator('button:has-text("Settings"), [aria-label="Settings"], header button, nav button').first();
      await settingsButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Found settings button, clicking...');
      await settingsButton.click();
    } catch (error) {
      console.error('Failed to find or click Settings button:', error.message);
      console.log('Taking screenshot to debug UI state');
      await page.screenshot({ path: `test-results/${dbType}-settings-button-error.png` });
      
      // Try alternate approach - look for any button in the header/nav area
      try {
        const headerButtons = await page.locator('header button, nav button').all();
        console.log(`Found ${headerButtons.length} buttons in header/nav`);
        
        // Click the likely settings button (usually last or second to last)
        if (headerButtons.length > 0) {
          await headerButtons[headerButtons.length - 1].click();
          console.log('Clicked last header button as fallback');
        } else {
          throw new Error('No header buttons found');
        }
      } catch (altError) {
        console.error('Alternative approach also failed:', altError.message);
        throw new Error('Could not access settings - UI may have changed');
      }
    }
    
    // Wait for settings dialog to appear with increased timeout
    try {
      await page.waitForSelector('dialog, .MuiDialog-paper, [role="dialog"]', { 
        state: 'visible',
        timeout: 15000 
      });
      console.log('Settings dialog appeared');
    } catch (dialogError) {
      console.error('Settings dialog did not appear:', dialogError.message);
      await page.screenshot({ path: `test-results/${dbType}-settings-dialog-error.png` });
      throw new Error('Settings dialog did not appear');
    }
    
    // Navigate to Vector Database settings tab (if it exists)
    try {
      await page.click('button:has-text("Vector Databases"), a:has-text("Vector Databases"), [role="tab"]:has-text("Vector")');
      console.log('Clicked Vector Databases tab');
    } catch (error) {
      console.log('No Vector Databases tab found, trying to add from main settings');
    }
    
    // Click "Add Database" or similar button with more flexible selectors
    try {
      await page.click('button:has-text("Add Database"), button:has-text("Configure Vector Database"), button:has-text("Add"), button:has-text("New")');
      console.log('Clicked Add Database button');
    } catch (addError) {
      console.error('Could not find Add Database button:', addError.message);
      await page.screenshot({ path: `test-results/${dbType}-add-db-error.png` });
      throw new Error('Could not find Add Database button');
    }
    
    // Fill in the form based on DB type
    console.log('Filling in database form');
    try {
      // Try to select database type
      await page.selectOption('select[name="type"], [aria-label="Database Type"], select', dbType);
      
      // Fill in generic fields first
      await page.fill('input[name="name"], [aria-label="Name"], input[placeholder*="name" i]', config.name);
      
      // Fill in database-specific fields
      switch (dbType) {
        case 'qdrant':
          await page.fill('input[name="url"], [aria-label="URL"], input[placeholder*="url" i]', config.url);
          await page.fill('input[name="collectionName"], [aria-label="Collection Name"], input[placeholder*="collection" i]', config.collectionName);
          break;
        case 'weaviate':
          await page.fill('input[name="url"], [aria-label="URL"], input[placeholder*="url" i]', config.url);
          await page.fill('input[name="className"], [aria-label="Class Name"], input[placeholder*="class" i]', config.className);
          break;
        case 'chroma':
          await page.fill('input[name="url"], [aria-label="URL"], input[placeholder*="url" i]', config.url);
          await page.fill('input[name="collectionName"], [aria-label="Collection Name"], input[placeholder*="collection" i]', config.collectionName);
          break;
        case 'pgvector':
          await page.fill('input[name="connectionString"], [aria-label="Connection String"], input[placeholder*="connection" i]', config.connectionString);
          await page.fill('input[name="tableName"], [aria-label="Table Name"], input[placeholder*="table" i]', config.tableName);
          break;
        case 'milvus':
          await page.fill('input[name="url"], [aria-label="URL"], input[placeholder*="url" i]', config.url);
          await page.fill('input[name="port"], [aria-label="Port"], input[placeholder*="port" i]', config.port.toString());
          await page.fill('input[name="collectionName"], [aria-label="Collection Name"], input[placeholder*="collection" i]', config.collectionName);
          break;
      }
    } catch (formError) {
      console.error('Error filling database form:', formError.message);
      await page.screenshot({ path: `test-results/${dbType}-form-fill-error.png` });
    }
    
    // Submit the form
    try {
      await page.click('button:has-text("Save"), button:has-text("Add"), form button[type="submit"]');
      console.log('Submitted database form');
    } catch (submitError) {
      console.error('Error submitting form:', submitError.message);
      await page.screenshot({ path: `test-results/${dbType}-submit-error.png` });
    }
    
    // Wait for success indicator or confirmation
    await page.waitForSelector('text="Saved", text="Added", .success-message', { 
      state: 'visible',
      timeout: 10000 
    }).catch(() => {
      console.log('No explicit success message found, continuing...');
    });
    
    // Take a screenshot after configuration
    await page.screenshot({ path: `test-results/${dbType}-after-config.png` });
    
    // Close settings if it's still open
    try {
      await page.click('button:has-text("Close"), button:has-text("Cancel"), [aria-label="Close"]');
      console.log('Closed settings dialog');
    } catch (error) {
      console.log('Settings dialog may have closed automatically');
    }
  }

  /**
   * Test document retrieval with a query
   * @param page Playwright page
   * @param query Search query to test
   * @returns True if document references were found
   */
  static async testDocumentRetrieval(page: Page, query: string): Promise<boolean> {
    // Navigate to chat view
    await page.click('button:has-text("Chat"), a:has-text("Chat")');
    
    // Wait for chat interface to load
    await page.waitForSelector('[placeholder="Type a message..."]', { 
      state: 'visible' 
    });
    
    // Send query to search for documents
    await page.fill('[placeholder="Type a message..."]', query);
    await page.click('button:has([data-testid="SendIcon"])');
    
    // Wait for response
    try {
      // Wait for any message to appear
      await page.waitForSelector('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="SmartToyIcon"]))', {
        state: 'visible',
        timeout: 30000
      });
      
      // Try to find document references
      const referencesCount = await page.locator('.document-reference, .MuiChip-root:has-text("Document")').count();
      
      return referencesCount > 0;
    } catch (error) {
      console.error('Error checking for document references:', error);
      return false;
    }
  }

  /**
   * Test connection to a vector database
   * @param page Playwright page
   * @param dbType Type of vector database
   * @returns True if connection was successful
   */
  static async testDatabaseConnection(page: Page, dbType: VectorDbType): Promise<boolean> {
    // Navigate to settings
    await page.click('button:has-text("Settings")');
    
    // Wait for settings dialog to appear
    await page.waitForSelector('dialog, .MuiDialog-paper', { 
      state: 'visible' 
    });
    
    // Navigate to Vector Database settings tab
    try {
      await page.click('button:has-text("Vector Databases"), a:has-text("Vector Databases")');
    } catch (error) {
      console.log('No Vector Databases tab found, proceeding with main settings view');
    }
    
    // Find the database in the list
    const dbRow = page.locator(`tr:has-text("${dbType}"), .vector-db-item:has-text("${dbType}")`).first();
    
    // Click "Test Connection" button if available
    try {
      await dbRow.locator('button:has-text("Test"), button:has-text("Test Connection")').click();
      
      // Wait for success message
      await page.waitForSelector('text="Connected successfully", text="Connection successful", .success-message', {
        state: 'visible',
        timeout: 5000
      });
      
      // Close settings
      await page.click('button:has-text("Close"), button:has-text("Cancel")');
      
      return true;
    } catch (error) {
      console.error(`Error testing connection to ${dbType}:`, error);
      
      // Close settings
      try {
        await page.click('button:has-text("Close"), button:has-text("Cancel")');
      } catch (dialogError) {
        console.log('Settings dialog may have closed automatically');
      }
      
      return false;
    }
  }
} 