import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, configureApiSettings } from './utils/test-helpers';

test.describe('Chat Input Functionality', () => {
  test('should allow sending messages', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Configure API settings for the endpoint provided by the user
    await configureApiSettings(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/initial-state.png' });
    
    // Send multiple messages and verify they appear in the chat
    const messages = [
      'Hello, this is test message 1',
      'This is test message 2 with some code: console.log("hello")',
      'This is test message 3 with emojis: 🚀 🔥 👍'
    ];
    
    for (let i = 0; i < messages.length; i++) {
      // Send the message
      await sendMessage(page, messages[i]);
      
      // Take a screenshot after each message
      await page.screenshot({ path: `test-results/message-${i+1}.png` });
      
      // Verify the message appears in the chat
      const userMessage = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').last();
      await expect(userMessage).toContainText(messages[i]);
      
      console.log(`Message ${i+1} sent and verified: ${messages[i].substring(0, 30)}...`);
      
      // Wait a bit before sending the next message
      await page.waitForTimeout(1000);
    }
    
    // Verify we have the expected number of user messages
    const userMessages = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').count();
    expect(userMessages).toBeGreaterThanOrEqual(messages.length);
    console.log(`Found ${userMessages} user messages, expected at least ${messages.length}`);
  });
  
  test('should maintain empty input after sending', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Configure API settings
    await configureApiSettings(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Verify input is initially empty
    const initialInputValue = await page.inputValue('[placeholder="Type a message..."]');
    expect(initialInputValue).toBe('');
    
    // Send a message
    await sendMessage(page, 'Test message');
    
    // Verify input is empty after sending
    const inputValueAfterSend = await page.inputValue('[placeholder="Type a message..."]');
    expect(inputValueAfterSend).toBe('');
    
    console.log('Input field cleared correctly after sending message');
  });
}); 