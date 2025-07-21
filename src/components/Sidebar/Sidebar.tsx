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

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  Button, 
  IconButton, 
  Tooltip, 
  Tabs, 
  Tab,
  Badge,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import DescriptionIcon from '@mui/icons-material/Description';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CloudIcon from '@mui/icons-material/Cloud';
import { ChatHistoryItem } from '../ChatHistoryItem/ChatHistoryItem';
import { DocumentLibrary } from '../DocumentLibrary/DocumentLibrary';
import { CompanyDocuments } from '../CompanyDocuments/CompanyDocuments';
import { useAppSelector, useAppDispatch, startSession, deleteSession } from '../../store/store';
import { getDB } from '../../db/db';
import type { SessionDocType } from '../../db/types';
import { v4 as uuidv4 } from 'uuid';
import { vectorDbService } from '../../services/VectorDbService';
import { VectorDbConfig } from '../../types/vectorDb';
import { useSettings } from '../../context/SettingsContext';

interface SidebarProps {
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const dispatch = useAppDispatch();
  const currentSessionId = useAppSelector(state => state.chat.currentSessionId);
  const messages = useAppSelector(state => state.chat.messages);
  const [loadedSessions, setLoadedSessions] = useState<SessionDocType[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'documents' | 'company'>('chats');
  const [documentCount, setDocumentCount] = useState(0);
  const [companyDbCount, setCompanyDbCount] = useState(0);
  const [activeVectorDbs, setActiveVectorDbs] = useState<VectorDbConfig[]>([]);
  const { settings } = useSettings();
  
  // Check if current session is empty (has no messages)
  const isCurrentSessionEmpty = messages.length === 0;

  // Reset activeTab if company tab is disabled
  useEffect(() => {
    if (activeTab === 'company' && !settings.companyDocumentsEnabled) {
      setActiveTab('chats');
    }
  }, [settings.companyDocumentsEnabled, activeTab]);

  // Load sessions from database
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const db = await getDB();
        // Subscribe to sessions collection for real-time updates
        const subscription = db.sessions.find()
          .sort({ lastUpdated: 'desc' })
          .$.subscribe((sessions) => {
            // Convert RxDB documents to plain objects to avoid readonly issues
            const sessionDocs = sessions.map(doc => ({
              sessionId: doc.sessionId,
              createdAt: doc.createdAt,
              lastUpdated: doc.lastUpdated,
              title: doc.title,
              messages: [...doc.messages],
              documentTags: doc.documentTags || []
            }));
            setLoadedSessions(sessionDocs);
          });
        
        // Count documents
        const documents = await db.documents.find().exec();
        setDocumentCount(documents.length);
        
        // Subscribe to document changes
        const docSubscription = db.documents.find().$.subscribe(docs => {
          setDocumentCount(docs.length);
        });
        
        // Count company vector databases
        const companyDbConfigs = vectorDbService.getConfigurations();
        setCompanyDbCount(companyDbConfigs.filter(config => config.enabled).length);
        
        return () => {
          subscription.unsubscribe();
          docSubscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    };
    
    loadSessions();
  }, []);
  
  // Load active vector databases when current session changes
  useEffect(() => {
    if (currentSessionId) {
      loadActiveVectorDbs(currentSessionId);
    } else {
      setActiveVectorDbs([]);
    }
  }, [currentSessionId]);
  
  // Load active vector DBs for the current session
  const loadActiveVectorDbs = async (sessionId: string) => {
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId }
      }).exec();
      
      if (session) {
        const tags = session.documentTags || [];
        const vdbIds: string[] = [];
        
        // Extract vector DB IDs from tags
        tags.forEach(tag => {
          if (tag.startsWith('vdb:')) {
            const parts = tag.substring(4).split(':');
            vdbIds.push(parts[0]); // Get the DB ID
          }
        });
        
        // Get configurations for these IDs
        const allConfigs = vectorDbService.getConfigurations();
        const activeConfigs = allConfigs.filter(config => vdbIds.includes(config.id));
        
        setActiveVectorDbs(activeConfigs);
      }
    } catch (error) {
      console.error('Error loading active vector DBs:', error);
    }
  };

  // Create a new chat session
  const handleNewChat = async () => {
    try {
      const newSessionId = uuidv4();
      
      // First update Redux
      dispatch(startSession(newSessionId));
      
      // Then add to RxDB
      const db = await getDB();
      await db.sessions.insert({
        sessionId: newSessionId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        title: 'New Chat',
        messages: [],
        documentTags: [] // Added for document references
      });
      
      console.log('Created new chat session:', newSessionId);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  // Delete a chat session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Update Redux state first
      dispatch(deleteSession(sessionId));
      
      // The actual deletion in the database happens in the middleware
      console.log('Deleting session:', sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      width: 350,
      height: '100%', // Add height to allow bottom positioning
      bgcolor: 'background.paper',
      borderRight: '1px solid',
      borderRightColor: 'divider',
      overflow: 'hidden'
    }}>
      <Box sx={{
        padding: 2,
        borderBottom: '1px solid',
        borderBottomColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Dell Pro AI Studio Chat
          </Typography>
          <Tooltip title={isCurrentSessionEmpty ? "Enter a message first" : "New Chat"}>
            <span> {/* Wrapper needed for disabled Tooltip */}
              <IconButton 
                onClick={handleNewChat} 
                color="primary" 
                size="small"
                disabled={isCurrentSessionEmpty}
              >
                <NoteAddIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        
        {/* Active Vector Databases Chips */}
        {activeVectorDbs.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {activeVectorDbs.map(vdb => (
              <Tooltip key={vdb.id} title={vdb.description || vdb.name}>
                <Chip 
                  size="small" 
                  icon={<CloudIcon fontSize="small" />} 
                  label={vdb.name}
                  color="secondary"
                  variant="outlined"
                />
              </Tooltip>
            ))}
          </Box>
        )}
        
        <Tabs 
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          aria-label="sidebar tabs"
          sx={{ mb: 1 }}
        >
          <Tab 
            icon={<ChatIcon />} 
            label="Chats" 
            value="chats"
          />
          <Tab 
            icon={
              <Badge badgeContent={documentCount} color="primary">
                <DescriptionIcon />
              </Badge>
            } 
            label="Documents" 
            value="documents"
          />
          {settings.companyDocumentsEnabled && (
            <Tab 
              icon={
                <Badge badgeContent={companyDbCount} color="secondary">
                  <CloudIcon />
                </Badge>
              } 
              label="Company" 
              value="company"
            />
          )}
        </Tabs>
      </Box>

      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        padding: 2
      }}>
        {activeTab === 'chats' && (
          <>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 1.5, 
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              Chat History
            </Typography>
            <List sx={{ padding: 0 }}>
              {loadedSessions.map((session) => (
                <ChatHistoryItem 
                  key={session.sessionId} 
                  session={session} 
                  isActive={session.sessionId === currentSessionId} 
                  onDelete={handleDeleteSession}
                />
              ))}
            </List>
          </>
        )}
        
        {activeTab === 'documents' && (
          <DocumentLibrary />
        )}
        
        {activeTab === 'company' && settings.companyDocumentsEnabled && (
          <CompanyDocuments />
        )}
      </Box>
      
      {/* Settings button at bottom */}
      <Box sx={{
        padding: 2,
        borderTop: '1px solid',
        borderTopColor: 'divider',
        display: 'flex',
        justifyContent: 'flex-start' // Align to the left
      }}>
        <Tooltip title="Settings">
          <IconButton onClick={onOpenSettings} color="inherit" size="medium">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};