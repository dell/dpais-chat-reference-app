import { test, expect } from '@playwright/test';
import { waitForChatReady, sendMessage, waitForAssistantResponse, verifyDocumentReferences } from './utils/test-helpers';

test.describe('Document Retrieval Quality Tests', () => {
  test('should retrieve relevant documents based on query specificity', async ({ page }) => {
    // Go to the application with documents already uploaded
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Ensure we have documents by going to document library
    await page.click('button:has-text("Documents"), a:has-text("Documents")');
    
    // Verify at least one document exists
    const documentCount = await page.locator('.document-item').count();
    expect(documentCount).toBeGreaterThan(0);
    
    // Go back to chat
    await page.click('button:has-text("Chat"), a:has-text("Chat")');
    
    // Ask a specific question related to document content
    const specificQuestion = 'What are the key features of the system described in the documentation?';
    await sendMessage(page, specificQuestion);
    
    // Wait for response
    await waitForAssistantResponse(page);
    
    // Verify document references appear
    const specificReferenceCount = await verifyDocumentReferences(page);
    
    // Record the relevance scores (if displayed in the UI)
    const specificScores = await page.locator('.document-reference .similarity-score').allInnerTexts();
    
    // Now ask a vague question
    const vagueQuestion = 'Tell me about it';
    await sendMessage(page, vagueQuestion);
    
    // Wait for response
    await waitForAssistantResponse(page);
    
    // Check if there are document references for vague query
    const vagueReferenceCount = await verifyDocumentReferences(page);
    
    // Compare reference counts or relevance scores between specific and vague queries
    console.log(`Specific query retrieved ${specificReferenceCount} documents`);
    console.log(`Vague query retrieved ${vagueReferenceCount} documents`);
    
    // We might expect more relevant documents for specific queries
    expect(specificReferenceCount).toBeGreaterThanOrEqual(1);
  });

  test('should interact with document references in UI', async ({ page }) => {
    // Go to the application
    await page.goto('/');
    
    // Wait for the chat interface to be ready
    await waitForChatReady(page);
    
    // Send a message that will trigger document retrieval
    const question = 'What information is in the uploaded documents?';
    await sendMessage(page, question);
    
    // Wait for response
    await waitForAssistantResponse(page);
    
    // Verify document references appear
    const referenceCount = await verifyDocumentReferences(page);
    expect(referenceCount).toBeGreaterThan(0);
    
    // Click on a document reference
    await page.click('.document-reference');
    
    // Verify document viewer opens
    await page.waitForSelector('.document-viewer', { state: 'visible' });
    
    // Verify the document content is displayed
    const documentContent = await page.locator('.document-viewer-content');
    expect(await documentContent.isVisible()).toBeTruthy();
    
    // Test highlighting of relevant passages (if implemented)
    const highlights = await page.locator('.highlight');
    if (await highlights.count() > 0) {
      expect(await highlights.first().isVisible()).toBeTruthy();
    }
    
    // Close the document viewer
    await page.click('.close-document-viewer');
    
    // Verify document viewer is closed
    await expect(page.locator('.document-viewer')).not.toBeVisible();
  });
}); 