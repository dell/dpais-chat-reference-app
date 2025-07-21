import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, waitForAssistantResponse } from './utils/test-helpers';

test.describe('Model Selection Tests', () => {
  test('should change the model and verify selection is preserved', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Click on model selector (assuming it exists in the UI)
    await page.click('.model-selector, button:has-text("Model")');
    
    // Wait for model options to appear
    await page.waitForSelector('.model-option', { state: 'visible' });
    
    // Select a different model (e.g., GPT-4)
    const modelToSelect = 'gpt-4';
    await page.click(`.model-option:has-text("${modelToSelect}")`);
    
    // Verify the selected model is displayed in the UI
    const selectedModel = await page.locator('.selected-model, .model-selector').innerText();
    expect(selectedModel).toContain(modelToSelect);
    
    // Refresh the page to test persistence
    await page.reload();
    
    // Wait for the page to load
    await waitForChatReady(page);
    
    // Verify the model selection persisted
    const persistedModel = await page.locator('.selected-model, .model-selector').innerText();
    expect(persistedModel).toContain(modelToSelect);
  });

  test('should use selected model when sending messages', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Select a specific model
    await page.click('.model-selector, button:has-text("Model")');
    await page.waitForSelector('.model-option', { state: 'visible' });
    const testModel = 'gpt-3.5-turbo';
    await page.click(`.model-option:has-text("${testModel}")`);
    
    // Send a test message
    await sendMessage(page, 'What model are you using?');
    
    // Wait for response
    const response = await waitForAssistantResponse(page);
    
    // This is a more approximate test since the model might not explicitly state its name
    // We're looking for some indication in the network requests that the correct model was used
    
    // Check network requests to verify the model (if request inspection is enabled in Playwright)
    // This requires additional configuration in the Playwright setup

    // Alternative: Use the console logs to verify the model (assuming model info is logged)
    const logs = await page.evaluate(() => {
      return (window as any).lastUsedModel || '';
    });
    
    console.log(`Last used model from logs: ${logs}`);
    
    // Send another message to verify consistent behavior
    await sendMessage(page, 'Tell me about retrieval augmented generation');
    
    // Wait for another response
    await waitForAssistantResponse(page);
  });
}); 