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

import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import type { MessageDocType } from '../db/types';
import { dbMiddleware } from './dbMiddleware';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getDB } from '../db/db';
import type { DocumentReference } from '../db/types';
import { clearLastReferences } from '../client/langchainClient';
import { getSettings } from '../utils/settings';
import { abortControllerService } from '../services/AbortControllerService';

interface ChatState {
  currentSessionId: string | null; // which session is active
  sessions: string[]; // keep track of session IDs in memory
  messages: MessageDocType[]; // current messages in memory
  thinkingTokens: string; // store partial tokens from <think></think>
  isThinking: boolean;   // track if we are inside <think> ... </think>
  currentModel: string;  // currently selected model
  displayThinking: Record<string, boolean>; // track which messages should display thinking content
  isProcessing: boolean; // Add processing state
}

// Get default model from settings or use fallback
const getDefaultModel = (): string => {
  try {
    const savedSettings = getSettings();
    
    // If we have available models, make sure the default is actually available and enabled
    if (savedSettings.availableModels && savedSettings.availableModels.length > 0) {
      const enabledModels = savedSettings.enabledModels || {};
      
      // Check if the stored default model is valid (exists and is enabled)
      if (savedSettings.defaultModel && 
          savedSettings.availableModels.includes(savedSettings.defaultModel) &&
          enabledModels[savedSettings.defaultModel] !== false) {
        return savedSettings.defaultModel;
      }
      
      // If no valid default, find the first enabled model
      const firstEnabledModel = savedSettings.availableModels.find((modelId: string) => 
        enabledModels[modelId] !== false
      );
      
      if (firstEnabledModel) {
        return firstEnabledModel;
      }
    }
    
    // Fallback to stored default or hardcoded fallback
    return savedSettings.defaultModel || 'phi3:phi3-mini-4k';
  } catch (e) {
    return 'phi3:phi3-mini-4k';
  }
};

const initialState: ChatState = {
  currentSessionId: null,
  sessions: [],
  messages: [],
  thinkingTokens: '',
  isThinking: false,
  currentModel: getDefaultModel(),
  displayThinking: {},
  isProcessing: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    startSession: (state, action: PayloadAction<string | undefined>) => {
      const newSessionId = action.payload || uuidv4();
      state.currentSessionId = newSessionId;
      state.sessions.push(newSessionId);
      state.messages = [];
      state.thinkingTokens = '';
      state.isThinking = false;
      state.displayThinking = {};
      
      // Clear any document references from previous sessions
      clearLastReferences();
    },
    loadSession: (state, action: PayloadAction<{ sessionId: string; messages: MessageDocType[] }>) => {
      state.currentSessionId = action.payload.sessionId;
      // replace in-memory messages with loaded ones
      state.messages = action.payload.messages;
      
      // Initialize displayThinking for messages with thinking content
      state.displayThinking = {};
      action.payload.messages.forEach(msg => {
        if (msg.thinkingContent) {
          state.displayThinking[msg.id] = true;
        }
      });
      
      if (!state.sessions.includes(action.payload.sessionId)) {
        state.sessions.push(action.payload.sessionId);
      }
      state.thinkingTokens = '';
      state.isThinking = false;
      
      // Clear any document references that aren't attached to messages
      clearLastReferences();
    },
    sendMessage: (state, action: PayloadAction<string>) => {
      const newMessage: MessageDocType = {
        id: uuidv4(),
        text: action.payload,
        sender: 'user',
        timestamp: Date.now(),
      };
      state.messages.push(newMessage);
    },
    receiveToken: (state, action: PayloadAction<string>) => {
      const token = action.payload;
    
      // Check for mixed content with opening think tag
      if (token.includes('<think>') && !token.startsWith('<think>')) {
        const parts = token.split('<think>');
        // Add first part to regular message
        const regularText = parts[0];
        
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || lastMessage.sender !== 'assistant') {
          state.messages.push({
            id: uuidv4(),
            text: regularText,
            sender: 'assistant',
            timestamp: Date.now()
          });
        } else {
          lastMessage.text += regularText;
        }
        
        // Then process the think tag and any content after it
        state.isThinking = true;
        if (parts[1]) {
          state.thinkingTokens += parts[1];
        }
        return;
      }
      
      // Check for mixed content with closing think tag
      if (state.isThinking && token.includes('</think>') && !token.startsWith('</think>')) {
        const parts = token.split('</think>');
        // Add first part to thinking content
        state.thinkingTokens += parts[0];
        
        // Process think tag close
        state.isThinking = false;
        
        // Attach thinking to last assistant message
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.sender === 'assistant') {
          lastMessage.thinkingContent = state.thinkingTokens;
          state.displayThinking[lastMessage.id] = true;
        }
        
        // Add any content after closing tag to regular message
        if (parts[1]) {
          if (!lastMessage || lastMessage.sender !== 'assistant') {
            state.messages.push({
              id: uuidv4(),
              text: parts[1],
              sender: 'assistant',
              timestamp: Date.now()
            });
          } else {
            lastMessage.text += parts[1];
          }
        }
        return;
      }
    
      // Handle pure tags
      if (token === '<think>') {
        state.isThinking = true;
        return;
      }
      
      if (token === '</think>') {
        state.isThinking = false;
        
        // Attach thinking content to last assistant message
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.sender === 'assistant') {
          lastMessage.thinkingContent = state.thinkingTokens;
          state.displayThinking[lastMessage.id] = true;
        }
        return;
      }
    
      // Regular token processing
      if (state.isThinking) {
        // accumulate tokens in thinkingTokens
        state.thinkingTokens += token;
      } else {
        // place them in last assistant message or create a new one
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || lastMessage.sender !== 'assistant') {
          const newMessage: MessageDocType = {
            id: uuidv4(),
            text: token,
            sender: 'assistant',
            timestamp: Date.now(),
            model: state.currentModel
          };
          state.messages.push(newMessage);
        } else {
          lastMessage.text += token;
        }
      }
    },
    endOfStream: (state, action: PayloadAction<DocumentReference[] | undefined>) => {
      // If we have accumulated thinking tokens, attach them to the last assistant message
      if (state.thinkingTokens.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.sender === 'assistant') {
          lastMessage.thinkingContent = state.thinkingTokens;
          // Enable thinking display for this message
          state.displayThinking[lastMessage.id] = true;
        }
      }
      
      // Add document references to last assistant message if provided
      if (action.payload && action.payload.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage && lastMessage.sender === 'assistant') {
          lastMessage.documentReferences = action.payload;
        }
      }
      
      // Reset thinking status at the end
      state.isThinking = false;
      state.thinkingTokens = ''; // Clear thinking tokens after processing
      state.isProcessing = false; // Reset processing state
      abortControllerService.clear(); // Clear abort controller from service
    },
    setCurrentModel: (state, action: PayloadAction<string>) => {
      state.currentModel = action.payload;
    },
    toggleThinkingDisplay: (state, action: PayloadAction<string>) => {
      const messageId = action.payload;
      // If it's undefined or doesn't exist yet, default to false (since we're toggling from true)
      state.displayThinking[messageId] = !(state.displayThinking[messageId]);
    },
    deleteSession: (state, action: PayloadAction<string>) => {
      const sessionIdToDelete = action.payload;
      // Remove from sessions array
      state.sessions = state.sessions.filter(id => id !== sessionIdToDelete);
      
      // If the deleted session was the current one, set current to null
      if (state.currentSessionId === sessionIdToDelete) {
        state.currentSessionId = null;
        state.messages = [];
      }
    },
    
    setChatTitle: (state, action: PayloadAction<{ sessionId: string; title: string }>) => {
      // This only updates the title in Redux, the DB update happens in middleware
      if (action.payload.sessionId === state.currentSessionId) {
        // We don't need to store titles in Redux state currently, 
        // but we might want to add that in the future
      }
    },
    
    regenerateMessage: (state) => {
      // Find the last assistant message
      const lastAssistantMessageIndex = [...state.messages].reverse().findIndex(m => m.sender === 'assistant');
      
      if (lastAssistantMessageIndex !== -1) {
        // Convert to actual index from reverse index
        const actualIndex = state.messages.length - 1 - lastAssistantMessageIndex;
        
        // Remove only the last assistant message (will be regenerated)
        // We want to keep the conversation history for context
        state.messages = state.messages.slice(0, actualIndex);
        
        // Reset thinking tokens
        state.thinkingTokens = '';
        state.isThinking = false;
        
        // Log regeneration for analytics
        console.log('Regenerating assistant message with model:', state.currentModel);
      }
    },
    setProcessing: (state, action: PayloadAction<boolean>) => {
      state.isProcessing = action.payload;
    },
    cancelRequest: (state) => {
      // Use the service to abort
      abortControllerService.abort();
      
      state.isProcessing = false;
      state.isThinking = false;
      state.thinkingTokens = '';
      
      // Add a cancelled message to indicate the request was stopped
      const cancelledMessage: MessageDocType = {
        id: uuidv4(),
        text: '*(Request cancelled by user)*',
        sender: 'assistant',
        timestamp: Date.now(),
      };
      state.messages.push(cancelledMessage);
    },
  },
});

export const {
  startSession,
  loadSession,
  sendMessage,
  receiveToken,
  endOfStream,
  setCurrentModel,
  toggleThinkingDisplay,
  deleteSession,
  setChatTitle,
  regenerateMessage,
  setProcessing,
  cancelRequest,
} = chatSlice.actions;

export const store = configureStore({
  reducer: {
    chat: chatSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware().concat(dbMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const endOfStreamAsync = createAsyncThunk(
  'chat/endOfStream',
  async (documentReferences: DocumentReference[] = [], thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const lastMessage = state.chat.messages[state.chat.messages.length - 1];
    
    if (lastMessage && lastMessage.sender === 'assistant') {
      try {
        const db = await getDB();
        await db.messages.insert({
          id: lastMessage.id,
          text: lastMessage.text,
          sender: lastMessage.sender,
          timestamp: lastMessage.timestamp,
          documentReferences: documentReferences || [], // Ensure it's always an array
          // ... other fields
        });
      } catch (error) {
        console.error('Error saving assistant message:', error);
      }
    }
    
    return { documentReferences: documentReferences || [] };
  }
);