import { test } from '@playwright/test';
import { waitForChatReady, sendMessage } from './utils/test-helpers';

test('debug HTML structure', async ({ page }) => {
  // Go to the application
  await page.goto('/');
  
  // Wait for the chat interface to be ready
  await waitForChatReady(page);
  
  // Send a test message
  await sendMessage(page, 'Hello, this is a test message');
  
  // Wait a bit for the message to appear
  await page.waitForTimeout(2000);
  
  // Get and log the HTML content
  const html = await page.content();
  console.log('HTML CONTENT:', html);
  
  // Debug message elements
  const messageElements = await page.locator('.message-bubble, .user-message, .assistant-message').all();
  console.log('Found message elements:', messageElements.length);
  
  for (const element of messageElements) {
    const className = await element.getAttribute('class');
    const text = await element.innerText();
    console.log(`Element with class "${className}" contains text: "${text}"`);
  }
  
  // Wait to see the results
  await page.waitForTimeout(5000);
}); 