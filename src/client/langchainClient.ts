/*
 * Copyright © 2025 Dell Inc. or its subsidiaries. All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *      http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChatOpenAI } from "@langchain/openai";
import { MultiVectorRAG } from './multiVectorRag';
import { DocumentReference } from '../db/types';
import { getSettings } from '../utils/settings';

// Store the most recent document references for UI display
let lastReferences: DocumentReference[] = [];

export function getLastReferences(): DocumentReference[] {
  return lastReferences;
}

/**
 * Clear the stored document references
 * Should be called when starting a new chat session
 */
export function clearLastReferences(): void {
  lastReferences = [];
}

/**
 * Process a chat message using RAG when document references are present
 */
export async function callRAGCompletion(
  userPrompt: string,
  previousMessages: Array<{role: string, content: string}>,
  sessionId: string,
  modelId: string,
  onToken: (token: string) => void,
  onDone: (documentReferences?: DocumentReference[]) => void,
  abortSignal?: AbortSignal
) {
  try {
    console.log('===== RAG COMPLETION STARTED =====');
    console.log('Input prompt:', userPrompt);
    console.log('Session ID:', sessionId);
    console.log('Model ID:', modelId);
    console.log('Previous message count:', previousMessages.length);
    
    // Check if already aborted
    if (abortSignal?.aborted) {
      console.log('Request already aborted');
      onDone([]);
      return;
    }
    
    // Get document-relevant content from the MultiVectorRAG service
    console.log('Fetching relevant documents...');
    const relevantDocs = await MultiVectorRAG.getRelevantDocuments(
      userPrompt,
      sessionId,
      5 // Max documents to retrieve
    );
    
    console.log(`Retrieved ${relevantDocs.length} relevant documents`);
    
    // If no relevant documents found, fall back to regular completion
    if (relevantDocs.length === 0) {
      console.log('NO DOCUMENTS FOUND - Falling back to standard completion');
      
      // Start tokens for the assistant response
      onToken("I couldn't find any relevant documents to answer your question. ");
      onToken("I'll answer based on my general knowledge instead.\n\n");
      
      return callFallbackCompletion(userPrompt, previousMessages, modelId, onToken, onDone, abortSignal);
    }

    // Log the document metadata
    console.log('Document summaries:');
    relevantDocs.forEach((doc, i) => {
      console.log(`Document ${i+1}:`, {
        pageContent: doc.pageContent.substring(0, 50) + '...',
        metadata: doc.metadata,
        sourceType: doc.metadata.sourceType || 'unknown',
        sourceName: doc.metadata.sourceName || 'unknown'
      });
    });
    
    // Convert documents to references for UI display
    const documentReferences = MultiVectorRAG.createDocumentReferences(relevantDocs);
    console.log('Created document references:', documentReferences);
    
    // Store references for UI display
    lastReferences = documentReferences;
    
    // Format documents for prompt
    const documentText = MultiVectorRAG.formatDocumentsForPrompt(relevantDocs);
    console.log('Formatted document text length:', documentText.length);
    
    // Generate system message with RAG context
    const defaultSystemMessage = 'You are a helpful virtual assistant, a state-of-the-art AI assistant renowned for accuracy, clarity, and thoughtful insights. Your mission is to provide detailed, well-reasoned answers that are both user-friendly and reliable. Always interpret the user\'s intent carefully—if a query is ambiguous, ask clarifying questions before responding. When uncertain about a fact, admit \'I don\'t know\' rather than guessing. Use a professional, yet warm tone, break down complex topics into understandable steps, and maintain consistency in style. Prioritize factual accuracy, and if new information is requested that falls outside your training, state your limitations clearly.';

    // Get base system message from settings or use default
    const settings = getSettings();
    const baseSystemPrompt = settings.systemMessage || defaultSystemMessage;

    // Apply settings for RAG behavior
    const strictMode = settings.strictRagMode === true;
    const showSources = settings.showDocumentSources !== false;
    
    console.log('RAG settings:', { strictMode, showSources });

    // Create system message with document context
    const systemMessage = MultiVectorRAG.generateSystemMessage(
      baseSystemPrompt,
      documentText,
      strictMode,
      showSources
    );
    
    console.log('Generated system message length:', systemMessage.content.length);
    
    // Create the message array for the LLM
    const messages = [
      systemMessage,
      ...previousMessages,
      { role: 'user', content: userPrompt }
    ];
    
    console.log('Final message count:', messages.length);
    
    // Initialize the LLM
    const apiBaseUrl = settings.apiBaseUrl;
    const apiKey = settings.apiKey;
    
    console.log('Initializing LLM with API URL:', apiBaseUrl);
    
    const llm = new ChatOpenAI({
      modelName: modelId,
      openAIApiKey: apiKey,
      streaming: true,
      maxCompletionTokens: 1024,
      temperature: 0.01,
      callbacks: [
        {
          handleLLMNewToken(token) {
            // Check if aborted during streaming
            if (abortSignal?.aborted) {
              console.log('Stream aborted by user');
              return;
            }
            onToken(token);
          },
          handleLLMEnd() {
            // Don't call onDone here, we'll call it after invoke with documentReferences
            console.log('LLM generation completed');
          },
          handleLLMError(error: any) {
            if (error.name === 'AbortError' || (abortSignal?.aborted && error.message?.includes('aborted'))) {
              console.log('Request cancelled by user');
            } else {
              console.error('LLM error:', error);
              onToken("\n\nI apologize, but I encountered an error while trying to generate a response. Please try again.");
            }
            onDone([]);
          }
        }
      ],
      configuration: {
        baseURL: apiBaseUrl,
      }
    });
    console.log('LLM initialized, sending request...');
    
    // Call the LLM with all the messages
    await llm.invoke(messages);
    console.log('LLM invoke completed successfully');
    
    // When calling onDone, pass the references
    console.log('Finishing RAG completion with references:', documentReferences.length);
    onDone(documentReferences.length > 0 ? documentReferences : []);
  } catch (err: any) {
    if (err.name === 'AbortError' || (abortSignal?.aborted && err.message?.includes('aborted'))) {
      console.log('Request cancelled by user');
      onDone([]);
    } else {
      console.error('ERROR IN RAG COMPLETION:', err);
      // Send error message to user
      onToken("\n\nI encountered an error while processing your question with the relevant documents. Falling back to standard completion.");
      // Fallback to regular completion
      return callFallbackCompletion(userPrompt, previousMessages, modelId, onToken, onDone, abortSignal);
    }
  }
}

// Fallback to standard completion if RAG fails
async function callFallbackCompletion(
  userPrompt: string,
  previousMessages: Array<{role: string, content: string}>,
  modelId: string,
  onToken: (token: string) => void,
  onDone: (documentReferences?: DocumentReference[]) => void,
  abortSignal?: AbortSignal
) {
  // Call the original OpenAI client
  const { callOpenAICompletion } = await import('./openaiClient');
  return callOpenAICompletion(userPrompt, previousMessages, modelId, onToken, onDone, abortSignal);
} 