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

import { Middleware } from '@reduxjs/toolkit';
import { getDB } from '../db/db';
import { callOpenAICompletion } from '../client/openaiClient';
import { MessageDocType, MessageMetrics, DocumentReference } from '../db/types';
import { vectorizeAndStoreMessage } from '../db/vectorStore';
import { DocumentManager } from '../services/DocumentManager';
import { createOpenAIEmbeddings, RxDBVectorStore } from '../services/LangChainIntegration';
import { generateChatTitle } from '../services/titleGenerator';
import { store } from './store';

// Actions we're handling, with their payload types
interface EndOfStreamAction {
  type: 'chat/endOfStream';
  payload?: DocumentReference[];
}

interface DeleteSessionAction {
  type: 'chat/deleteSession';
  payload: string;
}

interface SendMessageAction {
  type: 'chat/sendMessage';
  payload: string;
}

interface ReceiveTokenAction {
  type: 'chat/receiveToken';
  payload: string;
}

interface RegenerateMessageAction {
  type: 'chat/regenerateMessage';
}

// Union type of all possible actions
type KnownAction = 
  | EndOfStreamAction
  | DeleteSessionAction
  | SendMessageAction
  | ReceiveTokenAction
  | RegenerateMessageAction;

// Type predicate to narrow action type
function isKnownAction(action: any): action is KnownAction {
  return (
    action && 
    typeof action === 'object' && 
    'type' in action && 
    (
      action.type === 'chat/endOfStream' ||
      action.type === 'chat/deleteSession' ||
      action.type === 'chat/sendMessage' ||
      action.type === 'chat/receiveToken' ||
      action.type === 'chat/regenerateMessage'
    )
  );
}

// Global map to track processing metrics
const processingMetrics: Record<string, MessageMetrics> = {};

export const dbMiddleware: Middleware = store => next => action => {
  // First, let the action go through to complete the state update
  const result = next(action);

  // Handle different action types
  if (isKnownAction(action)) {
    (async () => {
      if (action.type === 'chat/endOfStream') {
        await handleEndOfStream(store, action.payload);
      } else if (action.type === 'chat/deleteSession') {
        await handleDeleteSession(action.payload);
      } else if (action.type === 'chat/sendMessage') {
        // Track the start time for metrics
        const state = store.getState().chat;
        const userMessageId = state.messages[state.messages.length - 1]?.id;
        
        if (userMessageId) {
          processingMetrics[userMessageId] = {
            startTime: Date.now(),
            tokensGenerated: 0 // Initialize tokensGenerated to 0
          };
          
          console.log('Started tracking metrics for message:', userMessageId);
          
          // For the first message in chat, schedule a title summarization
          // if (state.messages.length <= 1) { // Just sent first message
          //   await scheduleTitleSummarization(state.currentSessionId, action.payload);
          // }
          
          // Vectorize user message for semantic search
          const userMessage = state.messages[state.messages.length - 1];
          if (userMessage) {
            try {
              await vectorizeAndStoreMessage(userMessage, false);
            } catch (error) {
              console.error('Error vectorizing user message:', error);
            }
          }
          
          // Add document context if the session has document tags
          if (state.currentSessionId) {
            try {
              const db = await getDB();
              const session = await db.sessions.findOne({
                selector: { sessionId: state.currentSessionId }
              }).exec();
              
              if (session && session.documentTags && session.documentTags.length > 0) {
                // Create a LangChain vector store with the session's tags
                const embeddings = createOpenAIEmbeddings();
                const vectorStore = new RxDBVectorStore(embeddings, { 
                  tags: session.documentTags 
                });
                
                // Get relevant document chunks for the user's query
                const relevantDocs = await vectorStore.similaritySearch(
                  action.payload,
                  4 // Get top 4 most relevant chunks
                );
                
                if (relevantDocs.length > 0) {
                  // Format the relevant documents as context
                  const context = relevantDocs.map((doc, i) => {
                    return `[Document ${i+1}: ${doc.metadata.documentName}]\n${doc.pageContent}`;
                  }).join('\n\n');
                  
                  // Create a contextualized prompt
                  const promptWithContext = `
I have the following information from my documents:
---
${context}
---

Based on this information, please answer my question:
${action.payload}
`;
                  
                  // Override the payload with the contextualized version
                  action.payload = promptWithContext;
                }
              }
            } catch (error) {
              console.error('Error adding document context:', error);
            }
          }
        }
      } else if (action.type === 'chat/receiveToken') {
        // Approximated token count for metrics
        const state = store.getState().chat;
        const lastAssistantMessageId = state.messages
          .filter((m: MessageDocType) => m.sender === 'assistant')
          .slice(-1)[0]?.id;
          
        if (lastAssistantMessageId) {
          if (!processingMetrics[lastAssistantMessageId]) {
            processingMetrics[lastAssistantMessageId] = {
              tokensGenerated: 0,
              startTime: Date.now() // Set start time if not already set
            };
          }
          
          // Increment token count - more accurately estimate tokens
          // A better approximation is about 0.75 tokens per word or ~4 chars per token
          const token = action.payload;
          const tokenWords = token.trim().split(/\s+/).length;
          const tokenEstimate = Math.max(0.1, tokenWords * 0.75); // At least 0.1 tokens per update
          
          processingMetrics[lastAssistantMessageId].tokensGenerated = 
            (processingMetrics[lastAssistantMessageId].tokensGenerated || 0) + tokenEstimate;
            
          // Also track word count
          if (!processingMetrics[lastAssistantMessageId].wordsGenerated) {
            processingMetrics[lastAssistantMessageId].wordsGenerated = 0;
          }
          processingMetrics[lastAssistantMessageId].wordsGenerated += tokenWords;
        }
      } else if (action.type === 'chat/regenerateMessage') {
        // Handle regeneration by re-sending the last user message
        const state = store.getState().chat;
        
        // Find the last user message
        const lastUserMessage = [...state.messages].reverse().find((m: MessageDocType) => m.sender === 'user');
        
        if (lastUserMessage) {
          // Make sure we have all messages up to this point before regenerating
          await handleRegeneration(lastUserMessage.text);
        }
      }
    })();
  }

  return result;
};

// Handle end of stream (saving assistant message)
async function handleEndOfStream(store: any, documentReferences?: DocumentReference[]) {
  const state = store.getState().chat;
  
  // Find last user message, then find the assistant message that follows it
  const messages = state.messages;
  const lastUserMsgIndex = [...messages].reverse().findIndex((m: MessageDocType) => m.sender === 'user');
  
  if (lastUserMsgIndex !== -1) {
    // Convert to actual index (from reverse index)
    const actualUserMsgIndex = messages.length - 1 - lastUserMsgIndex;
    // Find assistant message that follows this user message
    const assistantMsg = messages.find((m: MessageDocType, idx: number) => 
      m.sender === 'assistant' && idx > actualUserMsgIndex
    );
    
    if (assistantMsg) {
      // Complete the metrics for this message
      if (processingMetrics[assistantMsg.id]) {
        // Set end time if not already set
        if (!processingMetrics[assistantMsg.id].endTime) {
          processingMetrics[assistantMsg.id].endTime = Date.now();
        }
        
        // Calculate processing time if we have start time
        if (processingMetrics[assistantMsg.id].startTime) {
          processingMetrics[assistantMsg.id].processingTimeMs = 
            processingMetrics[assistantMsg.id].endTime! - 
            processingMetrics[assistantMsg.id].startTime!;
          
          // If processing time is unreasonably short, set a minimum value
          if (processingMetrics[assistantMsg.id]?.processingTimeMs && 
              processingMetrics[assistantMsg.id]?.processingTimeMs < 100) {
            // Use non-null assertion only after checking assistantMsg.id exists in the map
            const metrics = processingMetrics[assistantMsg.id];
            if (metrics) {
              metrics.processingTimeMs = 500; // Default minimum time
            }
          }
          
          console.log('Timing metrics for message:', assistantMsg.id, {
            startTime: processingMetrics[assistantMsg.id].startTime,
            endTime: processingMetrics[assistantMsg.id].endTime,
            processingTimeMs: processingMetrics[assistantMsg.id].processingTimeMs
          });
        }
      }
      
      await saveAssistantMessage(assistantMsg, state.currentSessionId, documentReferences);
      
      // After saving, remove from tracking object to save memory
      delete processingMetrics[assistantMsg.id];
    }
  } else {
    // Fallback to last message if no user message found
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage?.sender === 'assistant') {
      await saveAssistantMessage(lastMessage, state.currentSessionId, documentReferences);
    }
  }

  // After saving the assistant message and updating the session
  if (state.currentSessionId) {
    const db = await getDB();
    const session = await db.sessions.findOne({
      selector: { sessionId: state.currentSessionId }
    }).exec();

    if (session && session.messages.length >= 2) {
      // Get all messages for this session
      const messageIds = session.messages;
      const messagesQuery = await db.messages.find({
        selector: {
          id: {
            $in: messageIds
          }
        }
      }).exec();
      const messages = messagesQuery.map(doc => doc.toJSON());

      // Only generate title if we don't already have a custom one
      if (session.title === 'New Chat') {
        // Generate a title based on the first exchange
        const newTitle = await generateChatTitle(messages);
        
        // Update the session title
        await session.update({
          $set: { title: newTitle }
        });
        
        console.log('Updated session title to:', newTitle);
      }
    }
  }
}

// Handle deleting a session and its messages
async function handleDeleteSession(sessionId: string) {
  try {
    const db = await getDB();
    
    // First fetch the session to get message IDs
    const session = await db.sessions.findOne({
      selector: { sessionId }
    }).exec();
    
    if (session) {
      // Delete all messages in this session
      const messageIds = session.messages;
      for (const msgId of messageIds) {
        const message = await db.messages.findOne({
          selector: { id: msgId }
        }).exec();
        
        if (message) {
          await message.remove();
          console.log(`Deleted message ${msgId}`);
        }
      }
      
      // Delete the session
      await session.remove();
      console.log(`Deleted session ${sessionId}`);
    }
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

// Save assistant message
async function saveAssistantMessage(assistantMsg: MessageDocType, currentSessionId: string | null, documentReferences?: DocumentReference[]) {
  try {
    // Get database instance
    const db = await getDB();
    
    // Get the current model from Redux store
    const currentModel = store.getState().chat.currentModel;

    // Create local message metrics object with proper defaults
    const messageMetrics: MessageMetrics = {
      // Calculate words more accurately with proper regex
      wordsGenerated: assistantMsg.text.trim().split(/\s+/).filter(word => word.length > 0).length,
      processingTimeMs: processingMetrics[assistantMsg.id]?.processingTimeMs || 0,
      tokensGenerated: Math.round(processingMetrics[assistantMsg.id]?.tokensGenerated || 0),
      tokensPerSecond: 0,
      startTime: processingMetrics[assistantMsg.id]?.startTime || 0,
      endTime: processingMetrics[assistantMsg.id]?.endTime || 0
    };
    
    // If we didn't track word count during streaming but have the final text,
    // use the text-based word count
    if (processingMetrics[assistantMsg.id]?.wordsGenerated) {
      messageMetrics.wordsGenerated = processingMetrics[assistantMsg.id].wordsGenerated;
    }
    
    // If tokens generated is too low compared to word count, estimate from word count
    if ((messageMetrics.tokensGenerated || 0) < (messageMetrics.wordsGenerated || 0) * 0.5) {
      messageMetrics.tokensGenerated = Math.round((messageMetrics.wordsGenerated || 0) * 1.3);
    }
    
    // Calculate tokens per second if we have both metrics
    if (messageMetrics.processingTimeMs && messageMetrics.processingTimeMs > 0 && messageMetrics.tokensGenerated) {
      messageMetrics.tokensPerSecond = (messageMetrics.tokensGenerated / (messageMetrics.processingTimeMs / 1000));
    }
    
    console.log('Calculated metrics for message:', assistantMsg.id, messageMetrics);

    // First check if this message already exists
    const existingMsg = await db.messages.findOne({
      selector: { id: assistantMsg.id }
    }).exec();

    if (!existingMsg) {
      // If message doesn't exist, insert a new one
      try {
        const messageToSave: MessageDocType = {
          id: assistantMsg.id,
          text: assistantMsg.text,
          sender: assistantMsg.sender,
          timestamp: assistantMsg.timestamp,
          thinkingContent: assistantMsg.thinkingContent || '',
          metrics: messageMetrics,
          model: currentModel, // Save the model used for generation
          documentReferences: documentReferences?.map(ref => ({
            documentId: ref.documentId,
            documentName: ref.documentName,
            chunkId: ref.chunkId,        // Required for DB lookup
            chunkIndex: ref.chunkIndex,  // For UI reference
            similarity: ref.similarity || 0.8,
            content: ref.content         // Include content
          }))
        };
        
        await db.messages.insert(messageToSave);
        console.log('Assistant message saved successfully');
        
        // Also generate and save vector embedding for semantic search
        try {
          await vectorizeAndStoreMessage(messageToSave, false);
        } catch (error) {
          console.error('Error creating vector embedding:', error);
        }

        // Update the session with this message ID
        if (currentSessionId) {
          const session = await db.sessions.findOne({
            selector: { sessionId: currentSessionId }
          }).exec();

          if (session) {
            // Make sure we're not adding duplicate message IDs
            if (!session.messages.includes(assistantMsg.id)) {
              const updatedMsgIds = [...session.messages, assistantMsg.id];
              await session.update({
                $set: { 
                  messages: updatedMsgIds,
                  lastUpdated: Date.now()
                }
              });
              console.log('Session updated with assistant message ID');
            }
          } else {
            console.error('Session not found when saving assistant message');
          }
        }
      } catch (insertError) {
        // Handle the case where the message was inserted by another operation
        console.log('Error inserting message, might already exist:', insertError);
        
        // Try to fetch it again and update instead
        const retryMsg = await db.messages.findOne({
          selector: { id: assistantMsg.id }
        }).exec();
        
        if (retryMsg) {
          await retryMsg.update({
            $set: {
              text: assistantMsg.text,
              timestamp: assistantMsg.timestamp,
              thinkingContent: assistantMsg.thinkingContent || '',
              metrics: messageMetrics,
              model: currentModel, // Save the model used for generation
              documentReferences: documentReferences?.map(ref => ({
                documentId: ref.documentId,
                documentName: ref.documentName,
                chunkId: ref.chunkId,        // Required for DB lookup
                chunkIndex: ref.chunkIndex,  // For UI reference
                similarity: ref.similarity || 0.8,
                content: ref.content         // Include content
              }))
            }
          });
          console.log('Updated existing message after insert conflict');
        }
      }
    } else {
      console.log('Updating existing assistant message in database');
      // Update the existing message, using the existing document to prevent conflicts
      try {
        await existingMsg.update({
          $set: {
            text: assistantMsg.text,
            timestamp: assistantMsg.timestamp,
            thinkingContent: assistantMsg.thinkingContent || existingMsg.thinkingContent || '',
            metrics: messageMetrics,
            model: currentModel, // Save the model used for generation
            documentReferences: documentReferences?.map(ref => ({
              documentId: ref.documentId,
              documentName: ref.documentName,
              chunkId: ref.chunkId,        // Required for DB lookup
              chunkIndex: ref.chunkIndex,  // For UI reference
              similarity: ref.similarity || 0.8,
              content: ref.content         // Include content
            }))
          }
        });
        console.log('Assistant message updated successfully');
      } catch (updateError) {
        console.error('Error updating message:', updateError);
        // If update fails, the document might have changed - fetch latest and retry
        const latestMsg = await db.messages.findOne({
          selector: { id: assistantMsg.id }
        }).exec();
        
        if (latestMsg) {
          try {
            await latestMsg.update({
              $set: {
                text: assistantMsg.text,
                timestamp: assistantMsg.timestamp,
                thinkingContent: assistantMsg.thinkingContent || latestMsg.thinkingContent || '',
                metrics: messageMetrics,
                model: currentModel, // Save the model used for generation
                documentReferences: documentReferences?.map(ref => ({
                  documentId: ref.documentId,
                  documentName: ref.documentName,
                  chunkId: ref.chunkId,        // Required for DB lookup
                  chunkIndex: ref.chunkIndex,  // For UI reference
                  similarity: ref.similarity || 0.8,
                  content: ref.content         // Include content
                }))
              }
            });
            console.log('Assistant message updated on retry');
          } catch (retryError) {
            console.error('Failed to update message even after retry:', retryError);
          }
        }
      }
      
      // Update session lastUpdated regardless of message update success
      if (currentSessionId) {
        const session = await db.sessions.findOne({
          selector: { sessionId: currentSessionId }
        }).exec();
        if (session) {
          await session.update({
            $set: { lastUpdated: Date.now() }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error saving assistant message:', error);
  }
}

// Generate a title for the chat based on content
async function scheduleTitleSummarization(sessionId: string | null, userMessage: string) {
  if (!sessionId) return;
  
  try {
    // Wait to allow a bit of time for initial processing
    setTimeout(async () => {
      try {
        const db = await getDB();
        
        // Get the full user message (which may include context)
        const session = await db.sessions.findOne({
          selector: { sessionId }
        }).exec();
        
        if (!session) return;
        
        // Extract the original question from context-enhanced message if needed
        let titleSource = userMessage;
        if (userMessage.includes('Based on this context, please answer my question:')) {
          titleSource = userMessage.split('Based on this context, please answer my question:')[1].trim();
        }
        
        // Create a better prompt for summarization
        const prompt = `Create a very short title (3-5 words maximum) that summarizes this question.
        Return ONLY the title, with no quotes, prefixes, or explanations.
        Question: "${titleSource}"`;
        
        let titleText = '';
        
        await callOpenAICompletion(
          prompt,
          [{ role: 'user', content: prompt }],
          'deepseek-r1:1.5b', // Use a small fast model for title generation
          (token) => {
            titleText += token;
          },
          async () => {
            // Clean up the title
            titleText = titleText.trim()
              .replace(/^["']|["']$/g, '') // Remove surrounding quotes
              .replace(/^Title:?\s*/i, '') // Remove "Title:" prefix if present
              .split('\n')[0] // Take only first line
              .trim();
              
            // Ensure we have a reasonable title length
            if (titleText.length > 30) {
              titleText = titleText.substring(0, 30) + '...';
            } else if (titleText.length < 2) {
              // Fallback for very short titles
              titleText = 'New Chat';
            }
            
            console.log(`Generated title: "${titleText}"`);
            
            // Update the session title
            try {
              await session.update({
                $set: { title: titleText }
              });
              console.log(`Updated session title to: ${titleText}`);
            } catch (updateError) {
              console.error('Error updating session title:', updateError);
            }
          }
        );
      } catch (error) {
        console.error('Error in title summarization:', error);
      }
    }, 1500); // Give time for any async operations
  } catch (error) {
    console.error('Error scheduling title summarization:', error);
  }
}

// Handle regeneration of a message
async function handleRegeneration(lastUserMessageText: string) {
  try {
    // Re-send the message to the OpenAI API using the current model
    const state = store.getState().chat;
    
    // Collect the conversation history up to the last user message
    const formattedMessages = state.messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Call the OpenAI completion endpoint to regenerate a response
    const currentModel = state.currentModel;
    console.log('Regenerating message with model:', currentModel);
    
    await callOpenAICompletion(
      lastUserMessageText,
      formattedMessages,
      currentModel,
      (token) => {
        // Dispatch token to state
        store.dispatch({ type: 'chat/receiveToken', payload: token });
      },
      () => {
        // End of stream handler
        store.dispatch({ type: 'chat/endOfStream' });
      }
    );
  } catch (error) {
    console.error('Error regenerating message:', error);
  }
}

// Helper function to vectorize message with control over vectorization
