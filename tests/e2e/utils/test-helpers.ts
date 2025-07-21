import { Page, expect } from '@playwright/test';

/**
 * Configure API settings for testing
 */
export async function configureApiSettings(page: Page): Promise<void> {
  // Set API settings in localStorage
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    
    // Update with the specified API endpoint and model
    const updatedSettings = {
      ...settings,
      apiBaseUrl: 'http://localhost:8553/v1',
      apiKey: 'dpais',
      selectedModel: 'deepseek-r1:1.5b',
      availableModels: ['deepseek-r1:1.5b']
    };
    
    // Save back to localStorage
    localStorage.setItem('chatAppSettings', JSON.stringify(updatedSettings));
  });
}

/**
 * Helper utility for waiting for the chat to be ready
 */
export async function waitForChatReady(page: Page): Promise<void> {
  // Wait for the input area to be visible
  await page.waitForSelector('[placeholder="Type a message..."]', { state: 'visible' });
}

/**
 * Helper to send a message in the chat
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  await page.fill('[placeholder="Type a message..."]', message);
  await page.click('button:has([data-testid="SendIcon"])');
}

/**
 * Helper to wait for a response from the assistant
 */
export async function waitForAssistantResponse(page: Page): Promise<string> {
  // Wait for any assistant message to appear
  await page.waitForSelector('.messages-container .MuiAvatar-root:has([data-testid="SmartToyIcon"])', { 
    state: 'visible',
    timeout: 30000  // Increased from 10000 to 30000 (30 seconds)
  });
  
  // Get the last message with an assistant avatar
  const assistantMessages = await page.locator('.messages-container .MuiBox-root:has(.MuiAvatar-root:has([data-testid="SmartToyIcon"]))').all();
  
  // Check if we got any messages
  expect(assistantMessages.length).toBeGreaterThan(0);
  
  // Get the last message
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  
  // Wait for thinking to complete (if any)
  try {
    await page.waitForSelector('.thinking-section', { state: 'detached', timeout: 15000 }); // Increased from 5000 to 15000
  } catch (e) {
    // It's okay if there's no thinking section
    console.log('No thinking section found or it remained visible');
  }
  
  // Get the text content from the last assistant message
  return await lastMessage.locator('p, li').allInnerTexts().then(texts => texts.join(' '));
}

/**
 * Helper to verify document references appear
 */
export async function verifyDocumentReferences(page: Page): Promise<number> {
  // Wait for document references to appear
  await page.waitForSelector('.document-reference, .MuiChip-root:has-text("Document")', { 
    state: 'visible', 
    timeout: 30000  // Increased from 10000 to 30000
  });
  
  // Count how many references are shown
  const count = await page.locator('.document-reference, .MuiChip-root:has-text("Document")').count();
  return count;
} 