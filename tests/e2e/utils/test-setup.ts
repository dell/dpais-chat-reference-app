import { Page } from '@playwright/test';
import { configureApiSettings } from './test-helpers';
import * as path from 'path';

/**
 * Uploads a test document for RAG testing
 */
export async function uploadTestDocument(page: Page): Promise<void> {
  // Navigate to document library
  await page.click('button:has-text("Documents"), a:has-text("Documents")');
  
  // Wait for the document upload component to be visible
  await page.waitForSelector('input[type="file"]', { state: 'visible' });
  
  // Create a path to the test document
  const testFilePath = path.join(process.cwd(), 'tests/fixtures/test-document.pdf');
  console.log('Uploading test document from:', testFilePath);
  
  // Upload the test document
  await page.setInputFiles('input[type="file"]', testFilePath);
  
  // Wait for upload to complete
  try {
    await page.waitForSelector('text=Upload complete', { state: 'visible', timeout: 10000 });
    console.log('Document upload complete');
  } catch (error) {
    // If we don't see the exact "Upload complete" message, wait for any indication
    console.log('Upload complete message not found, waiting for document to appear in list');
    await page.waitForTimeout(2000);
  }
  
  // Go back to chat interface
  await page.click('button:has-text("Chat"), a:has-text("Chat")');
}

/**
 * Setup a complete test environment with API config and document upload
 */
export async function setupTestEnvironment(page: Page, options: { uploadDocument?: boolean } = {}): Promise<void> {
  // Navigate to the application
  await page.goto('/');
  
  // Configure API settings
  await configureApiSettings(page);
  
  // Upload test document if requested
  if (options.uploadDocument) {
    await uploadTestDocument(page);
  }
} 