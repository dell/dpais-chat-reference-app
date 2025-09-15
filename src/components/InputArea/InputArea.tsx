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

import React, { useState, useRef } from 'react';
import { Box, TextField, IconButton, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { v4 as uuidv4 } from 'uuid';
import { useAppDispatch, useAppSelector, sendMessage, receiveToken, endOfStream, startSession, store, setProcessing, cancelRequest } from '../../store/store';
import { getDB } from '../../db/db';
import { MessageDocType, DocumentReference } from '../../db/types';
import { callOpenAICompletion } from '../../client/openaiClient';
import { callRAGCompletion } from '../../client/langchainClient';
import { abortControllerService } from '../../services/AbortControllerService';
import './InputArea.css';

export const InputArea: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentSessionId, currentModel, isProcessing } = useAppSelector(state => state.chat);
  const [input, setInput] = useState('');
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleStop = () => {
    console.log('Stopping LLM request');
    dispatch(cancelRequest());
  };
  
  const handleSend = async () => {
    console.log('handleSend called');
    
    if (!input.trim()) {
      console.log("Input is empty, not sending");
      return;
    }
    
    if (isProcessing) {
      console.log("Already processing a message");
      return;
    }
    
    // Handle the case with no currentSessionId by creating one
    if (!currentSessionId) {
      console.warn("No active session found, creating a new one");
      const newSessionId = uuidv4();
      dispatch(startSession(newSessionId));
      
      try {
        const db = await getDB();
        await db.sessions.insert({
          sessionId: newSessionId,
          createdAt: Date.now(),
          messages: [],
          lastUpdated: Date.now(),
          title: 'New Chat'
        });
        console.log("Created emergency session:", newSessionId);
      } catch (error) {
        console.error("Failed to create emergency session:", error);
        return; // Can't proceed without a session
      }
    }
    
    const userMessage = input.trim();
    setInput('');
    
    // Create AbortController for this request
    const abortController = abortControllerService.createController();
    dispatch(setProcessing(true));
    
    try {
        console.log('Processing message:', userMessage);
        console.log('Current session ID:', currentSessionId);
        
        // Add message to Redux
        dispatch(sendMessage(userMessage));
        
        // Save user message to RxDB
        const db = await getDB();
        const userMsgDoc: MessageDocType = {
          id: uuidv4(),
          text: userMessage,
          sender: 'user',
          timestamp: Date.now(),
          documentReferences: []
        };
        
        console.log('Message to insert:', userMsgDoc);
        console.log('Required fields in schema:', /* get your required fields here */);
        
        try {
          await db.messages.insert(userMsgDoc);
          console.log('Message inserted successfully');
        } catch (error) {
          console.error('Error inserting message:', error);
          // Try a more complete object as fallback
          try {
            const fullUserMsg: MessageDocType = {
              ...userMsgDoc,
              embedding: [],
              metrics: {
                processingTimeMs: 0,
                tokensGenerated: 0,
                wordsGenerated: 0,
                tokensPerSecond: 0,
                startTime: Date.now(),
                endTime: Date.now()
              }
            };
            console.log('Trying with fallback object:', fullUserMsg);
            await db.messages.insert(fullUserMsg);
            console.log('Fallback message insert succeeded');
          } catch (fallbackError) {
            console.error('Fallback insert also failed:', fallbackError);
          }
        }
        
        // Update session with new message ID
        const sessionDoc = await db.sessions.findOne({
          selector: {
            sessionId: currentSessionId!
          }
        }).exec();
    
        if (sessionDoc) {
          await sessionDoc.update({
            $set: {
              messages: [...sessionDoc.messages, userMsgDoc.id],
              lastUpdated: Date.now()
            }
          });
        } else {
          console.error("Session not found in database:", currentSessionId);
          // Create session if it doesn't exist
          await db.sessions.insert({
            sessionId: currentSessionId!,
            createdAt: Date.now(),
            messages: [userMsgDoc.id],
            lastUpdated: Date.now(),
            title: 'New Chat'
          });
        }
        
        // Get messages from database instead of Redux store
        // This ensures we have the correct state without timing issues
        let formattedMessages: {role: string, content: string}[] = [];
        let currentSessionDoc = null;
        
        try {
          // Get messages from the database
          const db = await getDB();
          currentSessionDoc = await db.sessions.findOne({
            selector: { sessionId: currentSessionId! }
          }).exec();
          
          if (currentSessionDoc) {
            // Get message IDs from the session
            const messageIds = currentSessionDoc.messages || [];
            
            // Fetch all messages
            const messagesQuery = await db.messages.find({
              selector: {
                id: { $in: messageIds }
              }
            }).exec();
            
            // Convert to formatted messages
            formattedMessages = messagesQuery.map(doc => {
              const msg = doc.toJSON();
              return {
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
              };
            });
            
            console.log('DEBUG - Database messages:', JSON.stringify(formattedMessages));
          }
        } catch (error) {
          console.error('Error getting messages from database:', error);
          
          // Fallback to Redux store if database query fails
          const state = store.getState().chat;
          formattedMessages = state.messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
          }));
          
          console.log('DEBUG - Fallback to Redux messages:', JSON.stringify(formattedMessages));
          
          // If we don't have currentSessionDoc yet, try to get it
          if (!currentSessionDoc) {
            try {
              const db = await getDB();
              currentSessionDoc = await db.sessions.findOne({
                selector: { sessionId: currentSessionId! }
              }).exec();
            } catch (sessionError) {
              console.error('Error getting session document:', sessionError);
            }
          }
        }
        
        // Check if we should use RAG (document references exist)
        const documentTags = currentSessionDoc?.documentTags || [];
        const useRAG = documentTags.length > 0;
        
        console.log('===== RAG DETECTION =====');
        console.log('Session document tags:', documentTags);
        console.log('Using RAG mode:', useRAG);
        
        if (currentSessionDoc) {
          console.log('Full session data:', JSON.stringify({
            id: currentSessionDoc.sessionId,
            title: currentSessionDoc.title,
            messageCount: currentSessionDoc.messages.length,
            documentTags: currentSessionDoc.documentTags,
            lastUpdated: new Date(currentSessionDoc.lastUpdated).toISOString()
          }));
        }
        
        if (useRAG) {
          console.log('===== STARTING RAG FLOW =====');
          console.log('Document tags being used:', documentTags);
          // Call RAG completion
          await callRAGCompletion(
            userMessage,
            formattedMessages,
            currentSessionId || '',  // Ensure it's never null
            currentModel,
            (token) => {
              dispatch(receiveToken(token));
            },
            (documentReferences: DocumentReference[] = []) => {
              console.log('===== RAG COMPLETION FINISHED =====');
              console.log('Got document references with chunkIds:', 
                documentReferences.map(r => ({chunkId: r.chunkId, chunkIndex: r.chunkIndex})));
              console.log('Total document references returned:', documentReferences.length);
              dispatch(endOfStream(documentReferences));
            },
            abortController.signal
          );
        } else {
          console.log('===== USING STANDARD COMPLETION =====');
          console.log('No document tags found, using standard completion flow');
          // Call standard completion
          await callOpenAICompletion(
            userMessage,
            formattedMessages,
            currentModel,
            (token) => {
              dispatch(receiveToken(token));
            },
            (documentReferences: DocumentReference[] = []) => {
              console.log('===== STANDARD COMPLETION FINISHED =====');
              console.log('Got document references with chunkIds:', 
                documentReferences.map(r => ({chunkId: r.chunkId, chunkIndex: r.chunkIndex})));
              dispatch(endOfStream(documentReferences));
            },
            abortController.signal
          );
        }
      } catch (error) {
        console.error('Error handling message:', error);
        dispatch(setProcessing(false));
        abortControllerService.clear();
      }
    };
  
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      padding: 2,
      borderTop: '1px solid',
      borderTopColor: 'divider',
      backgroundColor: 'background.paper',
      justifyContent: 'center',
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        padding: 1,
        minWidth: '50%',
        maxWidth: '80%',
        margin: '0 auto'
      }}>
        <TextField
          placeholder="Type a message..."
          multiline
          maxRows={5}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          inputRef={textFieldRef}
          variant="standard"
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              padding: 1
            },
            '& .MuiInputBase-input': {
              color: 'text.primary'
            }
          }}
        />
        
        <IconButton 
          color="primary"
          onClick={isProcessing ? handleStop : handleSend}
          disabled={!isProcessing && !input.trim()}
          sx={{ ml: 1 }}
        >
          {isProcessing ? <StopIcon /> : <SendIcon />}
        </IconButton>
      </Box>
      
      <Box className="input-footer">
        <Typography variant="caption" color="textSecondary">
          Messages are stored locally in your browser using IndexedDB
        </Typography>
      </Box>
    </Box>
  );
};