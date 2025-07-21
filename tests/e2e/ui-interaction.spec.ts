import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, configureApiSettings } from './utils/test-helpers';
import { setupTestEnvironment } from './utils/test-setup';

test.describe('UI Interaction Tests', () => {
  test('should navigate between chat and document views', async ({ page }) => {
    // Setup test environment with API settings
    await setupTestEnvironment(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/chat-view.png' });
    
    // Verify we're in the chat view
    await expect(page.locator('[placeholder="Type a message..."]')).toBeVisible();
    
    // Navigate to document library
    await page.click('button:has-text("Documents"), a:has-text("Documents")');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/documents-view.png' });
    
    // Verify we're in the documents view - adjust the selector to match the actual UI
    await expect(page.locator('input[type="file"], .document-upload, .document-list')).toBeVisible();
    
    // Navigate back to chat
    await page.click('button:has-text("Chat"), a:has-text("Chat")');
    
    // Verify we're back in the chat view
    await expect(page.locator('[placeholder="Type a message..."]')).toBeVisible();
  });

  test('should open and close settings panel', async ({ page }) => {
    // Setup test environment
    await setupTestEnvironment(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Open settings
    await page.click('button:has-text("Settings")');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/settings-panel.png' });
    
    // Verify settings panel is open (adjust selector to match the actual UI)
    await expect(page.locator('dialog, .MuiDialog-paper')).toBeVisible();
    
    // Change a setting (theme) - try multiple potential selectors
    try {
      await page.click('text=Dark, [value="dark"], input[value="dark"] + label');
      console.log('Changed theme to Dark');
    } catch (error) {
      console.log('Could not change theme - interface may be different than expected');
    }
    
    // Close settings (try multiple potential buttons)
    await page.click('button:has-text("Save"), button:has-text("Close"), button:has-text("Cancel")');
    
    // Verify settings panel is closed
    await expect(page.locator('dialog, .MuiDialog-paper')).not.toBeVisible();
  });

  test('should send multiple messages in sequence', async ({ page }) => {
    // Setup test environment
    await setupTestEnvironment(page);
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Send first message
    await sendMessage(page, 'Hello');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/first-message.png' });
    
    // Verify first message appears
    const firstMessage = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').last();
    await expect(firstMessage).toContainText('Hello');
    
    // Wait a bit (simulating waiting for response)
    await page.waitForTimeout(2000);
    
    // Send second message
    await sendMessage(page, 'How are you?');
    
    // Take another screenshot
    await page.screenshot({ path: 'test-results/second-message.png' });
    
    // Verify second message appears
    const secondMessage = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').last();
    await expect(secondMessage).toContainText('How are you?');
    
    // Verify we have at least two user messages
    const userMessages = await page.locator('.MuiBox-root:has(.MuiAvatar-root:has([data-testid="PersonIcon"]))').count();
    expect(userMessages).toBeGreaterThanOrEqual(2);
  });
}); 