import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, waitForAssistantResponse } from './utils/test-helpers';

test.describe('Settings and Configuration Tests', () => {
  test('should open settings panel and change theme', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Click on settings button
    await page.click('button:has-text("Settings")');
    
    // Wait for settings panel to open
    await page.waitForSelector('text=Theme', { state: 'visible' });
    
    // Change theme to dark
    await page.click('text=Dark');
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Verify theme has changed by checking for dark mode class or styles
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark/);
  });

  test('should change RAG configuration settings', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Click on settings button
    await page.click('button:has-text("Settings")');
    
    // Wait for settings panel to open
    await page.waitForSelector('text=RAG Settings', { state: 'visible' });
    
    // Navigate to RAG settings section
    await page.click('text=RAG Settings');
    
    // Change document chunk size
    await page.fill('input[name="documentChunkSize"]', '1500');
    
    // Change max documents retrieved
    await page.fill('input[name="maxDocumentsRetrieved"]', '3');
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Verify settings were saved by reopening settings
    await page.click('button:has-text("Settings")');
    
    // Check if new values are displayed
    const chunkSizeValue = await page.inputValue('input[name="documentChunkSize"]');
    expect(chunkSizeValue).toBe('1500');
    
    const maxDocsValue = await page.inputValue('input[name="maxDocumentsRetrieved"]');
    expect(maxDocsValue).toBe('3');
    
    // Close settings
    await page.click('button:has-text("Cancel")');
    
    // Now test if the settings affect RAG behavior
    // We could send a message that triggers RAG and verify the number of retrieved documents matches our setting
    await sendMessage(page, 'What information is in the uploaded documents?');
    
    // Wait for response
    await waitForAssistantResponse(page);
    
    // Count document references, should not exceed our setting of 3
    const referenceCount = await page.locator('.document-reference').count();
    expect(referenceCount).toBeLessThanOrEqual(3);
  });
}); 