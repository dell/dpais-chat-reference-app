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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the shape of our settings
interface Settings {
  apiKey?: string;
  apiBaseUrl?: string;
  backendApiUrl?: string;
  modelId?: string;
  embeddingsModel?: string;
  streamingEnabled?: boolean;
  systemMessage?: string;
  strictRagMode?: boolean;
  showDocumentSources?: boolean;
  companyDocumentsEnabled?: boolean;
  [key: string]: any; // Allow any additional settings
}

// Define the context shape
interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}

// Create the context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Default settings
const defaultSettings: Settings = {
  apiKey: '',
  apiBaseUrl: 'http://localhost:8553/v1',
  backendApiUrl: 'http://localhost:8000',
  modelId: 'llama3',
  embeddingsModel: 'nomic-embed-text',
  streamingEnabled: true,
  systemMessage: 'You are a helpful virtual assistant, a state-of-the-art AI assistant renowned for accuracy, clarity, and thoughtful insights. Your mission is to provide detailed, well-reasoned answers that are both user-friendly and reliable. Always interpret the user\'s intent carefully—if a query is ambiguous, ask clarifying questions before responding. When uncertain about a fact, admit \'I don\'t know\' rather than guessing. Use a professional, yet warm tone, break down complex topics into understandable steps, and maintain consistency in style. Prioritize factual accuracy, and if new information is requested that falls outside your training, state your limitations clearly.',
  strictRagMode: false,
  showDocumentSources: true,
  companyDocumentsEnabled: false
};

// Hook for easy access to the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  // Load settings from localStorage or use defaults
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const storedSettings = localStorage.getItem('chatAppSettings');
      return storedSettings ? { ...defaultSettings, ...JSON.parse(storedSettings) } : defaultSettings;
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      return defaultSettings;
    }
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('chatAppSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [settings]);

  // Listen for settings updates from other components
  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const storedSettings = localStorage.getItem('chatAppSettings');
        if (storedSettings) {
          setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) });
        }
      } catch (error) {
        console.error('Error reloading settings from localStorage:', error);
      }
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, []);

  // Update settings
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}; 