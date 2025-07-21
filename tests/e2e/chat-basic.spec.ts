import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, waitForAssistantResponse, configureApiSettings } from './utils/test-helpers';

test.describe('Basic Chat Functionality', () => {
  test('should load the chat interface', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Configure API settings
    await configureApiSettings(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Verify the input area is visible
    const inputArea = await page.locator('[placeholder="Type a message..."]');
    await expect(inputArea).toBeVisible();
  });

  test('should send a message and verify it appears in chat', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Configure API settings
    await configureApiSettings(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Send a simple message
    const testMessage = 'Hello, how are you today?';
    await sendMessage(page, testMessage);
    
    // Verify the message appears in the chat
    const userMessage = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').last();
    await expect(userMessage).toContainText(testMessage);
    
    console.log('User message successfully sent and displayed in chat');
  });

  test('should receive a response from the assistant', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Configure API settings for the OpenAI endpoint
    await configureApiSettings(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Debug: Check console logs for API errors
    let hasApiError = false;
    page.on('console', msg => {
      console.log(`BROWSER LOG: ${msg.type()}: ${msg.text()}`);
      if (msg.text().includes('API') && msg.text().includes('error')) {
        hasApiError = true;
        console.log(`API Error detected: ${msg.text()}`);
      }
    });
    
    // Send a simple message
    const testMessage = 'Tell me about retrieval augmented generation';
    await sendMessage(page, testMessage);
    
    // If we detect API errors, skip the rest of the test
    if (hasApiError) {
      console.log('API connection error detected, skipping assistant response check');
      test.skip();
      return;
    }
    
    // Wait for the assistant's response with increased timeout
    console.log('Waiting for assistant response (this may take up to 30 seconds)...');
    const response = await waitForAssistantResponse(page);
    
    // Verify we got some kind of response (not empty)
    console.log('Assistant response received:', response);
    expect(response.length).toBeGreaterThan(0);
  });
}); 