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

import React, { useEffect, useState, useRef } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store, loadSession, startSession } from './store/store';
import { getDB } from './db/db';
import { Layout } from './components/Layout/Layout';
import { v4 as uuidv4 } from 'uuid';
import type { MessageDocType } from './db/types';
import { Settings, AppSettings } from './components/Settings/Settings';
import { createThemeOptions, DEFAULT_THEMES } from './theme/themeConfig';
import { SettingsProvider } from './context/SettingsContext';
import { OfflineProvider } from './context/OfflineContext';
import { Box } from '@mui/material';
import { ModelService } from './services/ModelService';
import { getSettings, saveSettings } from './utils/settings';
import { isMobileDevice } from './utils/deviceDetection';
import { MobileLanding } from './components/MobileLanding/MobileLanding';

// Make store globally accessible for debugging
declare global {
  interface Window {
    store: typeof store;
  }
}

window.store = store;

export const ChatApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Use the centralized getSettings function
    return getSettings();
  });
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Create a theme instance based on selected theme
  const theme = createTheme(
    createThemeOptions(
      settings.selectedTheme === 'custom' && settings.customTheme 
        ? settings.customTheme 
        : (DEFAULT_THEMES as any)[settings.selectedTheme] || DEFAULT_THEMES.light
    )
  );

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };

    // Initial check
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);
    
    // Check on orientation change
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Handle settings changes
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    // You may need to update OpenAI client configuration here
  };

  // Add this ref to track initialization
  const initialized = useRef(false);

  // Update the useEffect that initializes DB and session
  useEffect(() => {
    // Skip initialization if on mobile
    if (isMobile) {
      return;
    }

    const initApp = async () => {
      // Skip if we've already initialized
      if (initialized.current) {
        console.log('App already initialized, skipping');
        return;
      }
      
      initialized.current = true;
      
      try {
        // First initialize database
        const db = await getDB();
        console.log('RxDB initialized:', db.name);
        
        // Check if we have any sessions
        const sessions = await db.sessions.find().sort({ createdAt: 'desc' }).limit(1).exec();
        
        // Also check if we already have a session in Redux
        const currentState = store.getState();
        if (currentState.chat.currentSessionId) {
          console.log('Session already exists in Redux:', currentState.chat.currentSessionId);
          return;
        }
        
        if (sessions.length > 0) {
          console.log('Found existing session, restoring...');
          const session = sessions[0];
          
          // Load all messages for this session
          const messagePromises = session.messages.map(msgId => 
            db.messages.findOne(msgId).exec()
          );
          
          const messageResults = await Promise.all(messagePromises);
          const messages = messageResults
            .filter(Boolean)
            .map(doc => doc!.toJSON() as MessageDocType);
            
          // Dispatch to Redux store
          store.dispatch(loadSession({ 
            sessionId: session.sessionId, 
            messages 
          }));
          console.log('Session restored:', session.sessionId);
        } else {
          console.log('No sessions found, creating new session...');
          // Create a new session
          const newSessionId = uuidv4();
          
          // Update Redux first
          store.dispatch(startSession(newSessionId));
          
          // Then add to RxDB
          await db.sessions.insert({
            sessionId: newSessionId,
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            title: 'New Chat',
            messages: []
          });
          console.log('New session created:', newSessionId);
        }
        
        // Initialize models after database setup
        await ModelService.initializeModels();
      } catch (error) {
        console.error('Error initializing app:', error);
        // Fallback - just create a session in Redux
        store.dispatch(startSession());
        
        // Still try to initialize models even if database setup failed
        try {
          await ModelService.initializeModels();
        } catch (modelError) {
          console.warn('Failed to initialize models:', modelError);
        }
      }
    };
    
    initApp();
  }, [isMobile]);

  // Show mobile landing if on mobile device
  if (isMobile) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MobileLanding />
      </ThemeProvider>
    );
  }

  return (
    <SettingsProvider>
      <OfflineProvider>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box className="chat-container">
              <Layout onOpenSettings={() => setSettingsOpen(true)} />
              <Settings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onSave={handleSaveSettings}
                currentSettings={settings}
              />
            </Box>
          </ThemeProvider>
        </Provider>
      </OfflineProvider>
    </SettingsProvider>
  );
};

export default ChatApp;