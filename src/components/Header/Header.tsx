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
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Chip, 
  Tooltip, 
  Divider, 
  Badge,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ArticleIcon from '@mui/icons-material/Article';
import LabelIcon from '@mui/icons-material/Label';
import CloudIcon from '@mui/icons-material/Cloud';
import DatabaseIcon from '@mui/icons-material/Storage';
import { useAppSelector } from '../../store/store';
import { getDB } from '../../db/db';
import { ModelSelector } from '../ModelSelector/ModelSelector';
import './Header.css';

interface DocumentInfo {
  id: string;
  name: string;
  type: 'local' | 'backend' | 'collection';
}

export const Header: React.FC = () => {
  const { messages, currentSessionId } = useAppSelector(state => state.chat);
  const [sessionTitle, setSessionTitle] = useState<string>('New Chat');
  const [documentTags, setDocumentTags] = useState<string[]>([]);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo[]>([]);
  const [regularTags, setRegularTags] = useState<string[]>([]);

  // Get title from session in database
  useEffect(() => {
    const fetchSessionData = async () => {
      if (!currentSessionId) return;

      try {
        const db = await getDB();
        const session = await db.sessions.findOne({
          selector: { sessionId: currentSessionId }
        }).exec();

        if (session) {
          setSessionTitle(session.title);
          
          // Get RAG information
          if (session.documentTags && session.documentTags.length > 0) {
            setDocumentTags(session.documentTags);
            
            // Separate document IDs, backend sources, collection sources and regular tags
            const docIds = new Set<string>();
            const regTags: string[] = [];
            const docInfos: DocumentInfo[] = [];
            
            session.documentTags.forEach(tag => {
              if (tag.startsWith('doc:')) {
                const docId = tag.substring(4);
                docIds.add(docId);
                docInfos.push({
                  id: docId,
                  name: docId.substring(0, 8) + '...',
                  type: 'local'
                });
              } else if (tag.startsWith('backend:')) {
                const parts = tag.split(':');
                const backendId = parts.length > 1 ? parts[1] : '';
                
                if (backendId) {
                  docIds.add(`backend-${backendId}`);
                  
                  // Add with format "Backend Store" or "Backend Store (n tags)"
                  const hasTags = parts.length > 2;
                  let tagList: string[] = [];
                  if (hasTags) {
                    tagList = parts[2].split(',');
                  }
                  
                  docInfos.push({
                    id: `backend-${backendId}`,
                    name: `Company Source${hasTags ? ` (${tagList.length} tags)` : ''}`,
                    type: 'backend'
                  });
                }
              } else if (tag.startsWith('collection:')) {
                const parts = tag.split(':');
                const collectionId = parts.length > 1 ? parts[1] : '';
                
                if (collectionId) {
                  docIds.add(`collection-${collectionId}`);
                  
                  // Add with format "Collection" or "Collection (n tags)"
                  const hasTags = parts.length > 2;
                  let tagList: string[] = [];
                  if (hasTags) {
                    tagList = parts[2].split(',');
                  }
                  
                  docInfos.push({
                    id: `collection-${collectionId}`,
                    name: `Company Collection${hasTags ? ` (${tagList.length} tags)` : ''}`,
                    type: 'collection'
                  });
                }
              } else {
                regTags.push(tag);
              }
            });
            
            setDocsCount(docIds.size);
            setRegularTags(regTags);
            
            // Fetch document names for local documents
            const localDocIds = Array.from(docIds).filter(id => 
              !id.startsWith('backend-') && !id.startsWith('collection-')
            );
            
            if (localDocIds.length > 0) {
              const docs = await db.documents.find({
                selector: {
                  id: {
                    $in: localDocIds
                  }
                }
              }).exec();
              
              // Update names for local documents
              const localDocInfoMap = new Map<string, string>();
              docs.forEach(doc => {
                localDocInfoMap.set(doc.id, doc.metadata.filename);
              });
              
              // Replace placeholder names with actual document names for local docs
              docInfos.forEach(info => {
                if (info.type === 'local' && localDocInfoMap.has(info.id)) {
                  info.name = localDocInfoMap.get(info.id) || info.name;
                }
              });
            }
            
            setDocumentInfo(docInfos);
          } else {
            setDocumentTags([]);
            setDocsCount(0);
            setDocumentInfo([]);
            setRegularTags([]);
          }
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      }
    };

    fetchSessionData();
  }, [currentSessionId, messages.length]); // Re-fetch when messages change, in case title was updated

  // Format date/time for display
  const firstMessage = messages[0];
  const startTime = firstMessage ? new Date(firstMessage.timestamp) : new Date();
  const formattedDate = startTime.toLocaleDateString();
  const formattedTime = startTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Custom tooltip content for documents
  const DocsTooltipContent = () => (
    <Paper sx={{ 
      p: 0.75, 
      maxWidth: 240, 
      backgroundColor: 'background.default',
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'divider'
    }}>

      {documentInfo.length > 0 ? (
        <List dense disablePadding sx={{ maxHeight: '180px', overflow: 'auto' }}>
          {documentInfo.map((doc) => (
            <ListItem key={doc.id} sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                {doc.type === 'local' ? (
                  <ArticleIcon fontSize="small" color="primary" />
                ) : doc.type === 'backend' ? (
                  <CloudIcon fontSize="small" color="secondary" />
                ) : (
                  <DatabaseIcon fontSize="small" color="secondary" />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={doc.name} 
                primaryTypographyProps={{ 
                  variant: 'body2',
                  noWrap: true,
                  title: doc.name, // Full name on hover
                  color: 'text.primary'
                }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          No document info available
        </Typography>
      )}
    </Paper>
  );

  // Custom tooltip content for tags
  const TagsTooltipContent = () => (
    <Paper sx={{ 
      p: 0.75, 
      maxWidth: 240,
      backgroundColor: 'background.default',
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'divider'
    }}>
      {regularTags.length > 0 ? (
        <List dense disablePadding sx={{ maxHeight: '150px', overflow: 'auto' }}>
          {regularTags.map((tag, index) => (
            <ListItem key={index} sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <LabelIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText 
                primary={tag} 
                primaryTypographyProps={{ 
                  variant: 'body2',
                  color: 'text.primary'
                }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          No tags available
        </Typography>
      )}
    </Paper>
  );

  return (
    <AppBar position="static" color="default" elevation={0} className="header">
      <Toolbar className="header-toolbar">
        <Box className="header-title-container">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ModelSelector />
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            {messages.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box className="header-metadata" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Date Created">
                    <Chip
                      icon={<CalendarTodayIcon fontSize="small" />}
                      label={formattedDate}
                      size="small"
                      variant="outlined"
                      className="header-chip"
                    />
                  </Tooltip>

                  <Tooltip title="Time Created">
                    <Chip
                      icon={<AccessTimeIcon fontSize="small" />}
                      label={formattedTime}
                      size="small"
                      variant="outlined"
                      className="header-chip"
                    />
                  </Tooltip>

                  <Chip
                    label={`${messages.length} messages`}
                    size="small"
                    variant="outlined"
                    className="header-chip"
                  />
                  
                  {/* Show RAG information when available */}
                  {documentTags.length > 0 && (
                    <>
                      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                      <Tooltip 
                        title={<DocsTooltipContent />}
                        placement="bottom"
                        arrow
                        sx={{
                          backgroundColor: 'background.default',
                          '& .MuiTooltip-tooltip': {
                            backgroundColor: 'background.default',
                            color: 'text.primary',
                            border: '1px solid',
                            borderColor: 'divider'
                          }
                        }}
                      >
                        <Chip
                          icon={<DescriptionIcon fontSize="small" />}
                          label={`${docsCount} document${docsCount !== 1 ? 's' : ''}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          className="header-chip"
                        />
                      </Tooltip>
                      
                      <Tooltip 
                        title={<TagsTooltipContent />}
                        placement="bottom"
                        arrow
                      >
                        <Chip
                          icon={<LocalOfferIcon fontSize="small" />}
                          label={regularTags.length || 'Tags'}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          className="header-chip"
                        />
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};