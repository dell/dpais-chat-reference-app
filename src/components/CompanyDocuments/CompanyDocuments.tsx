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

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  IconButton,
  Tooltip,
  Divider,
  FormControlLabel,
  Switch,
  Badge,
  Alert,
  Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Dataset as DatabaseIcon,
  FilterAlt as FilterAltIcon,
  FilterAltOff as FilterAltOffIcon,
  Chat as ChatIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  SyncAlt as SyncAltIcon,
  LocalOffer as LocalOfferIcon,
  CloudOff as CloudOffIcon
} from '@mui/icons-material';
import { vectorDbService } from '../../services/VectorDbService';
import { VectorDbConfig } from '../../types/vectorDb';
import { useAppDispatch, useAppSelector, startSession } from '../../store/store';
import { getDB } from '../../db/db';
import { v4 as uuidv4 } from 'uuid';
import { backendApiService } from '../../services/BackendApiService';
import { Document } from '@langchain/core/documents';
import { useOffline } from '../../context/OfflineContext';

// Helper function to get icon for vector DB type
const getDbTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'milvus':
      return <DatabaseIcon />;
    case 'qdrant':
      return <StorageIcon />;
    case 'weaviate':
      return <CloudIcon />;
    case 'pgvector':
      return <DatabaseIcon />;
    case 'pinecone':
      return <CloudIcon />;
    default:
      return <StorageIcon />;
  }
};

// After the imports but before the CompanyDocuments component
// Add the database item component
interface DbItemProps {
  config: VectorDbConfig;
  onAddToChat: (dbId: string, tags: string[]) => void;
  isAdded: boolean;
  onToggleSelection: (dbId: string) => void;
  isSelected: boolean;
}

const DatabaseItem: React.FC<DbItemProps> = ({ 
  config, 
  onAddToChat, 
  isAdded, 
  onToggleSelection,
  isSelected
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  
  // Add to current chat with selected tags
  const handleAddToChat = () => {
    onAddToChat(config.id, selectedTags);
  };
  
  // Toggle expand/collapse for tag selection
  const toggleExpand = () => {
    setExpanded(!expanded);
    if (!expanded) {
      onToggleSelection(config.id);
    }
  };
  
  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <ListItem
        secondaryAction={
          <Tooltip title={isAdded ? "Already added to chat" : "Add to current chat"}>
            <span>
              <IconButton 
                edge="end" 
                onClick={handleAddToChat}
                disabled={isAdded}
                color={isAdded ? "success" : "primary"}
              >
                {isAdded ? <CheckCircleIcon /> : <ChatIcon />}
              </IconButton>
            </span>
          </Tooltip>
        }
        sx={{ bgcolor: isSelected ? 'action.selected' : 'background.paper' }}
      >
        <ListItemIcon>
          {getDbTypeIcon(config.type)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle1">{config.name}</Typography>
              {!config.enabled && <Chip size="small" label="Disabled" color="error" sx={{ ml: 1 }} />}
            </Box>
          }
          secondary={
            <React.Fragment>
              <Typography variant="body2" color="text.secondary">
                {config.description || `${config.type} vector database`}
              </Typography>
              
              {config.tags && config.tags.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {config.tags.slice(0, 3).map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSelectedTags(prev => 
                          prev.includes(tag) 
                            ? prev.filter(t => t !== tag) 
                            : [...prev, tag]
                        );
                        if (!expanded) {
                          setExpanded(true);
                        }
                      }}
                    />
                  ))}
                  {config.tags.length > 3 && (
                    <Chip
                      label={`+${config.tags.length - 3}`}
                      size="small"
                      variant="outlined"
                      onClick={toggleExpand}
                    />
                  )}
                </Box>
              )}
            </React.Fragment>
          }
          onClick={() => onToggleSelection(config.id)}
          sx={{ cursor: 'pointer' }}
        />
      </ListItem>
      
      {expanded && config.tags && config.tags.length > 0 && (
        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" gutterBottom>
            Select Tags for Filtering:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {config.tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                color={selectedTags.includes(tag) ? "primary" : "default"}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) 
                      ? prev.filter(t => t !== tag) 
                      : [...prev, tag]
                  );
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button 
              variant="contained" 
              size="small"
              disabled={selectedTags.length === 0 || isAdded}
              onClick={handleAddToChat}
              startIcon={<ChatIcon />}
            >
              Chat with Selected Tags
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export const CompanyDocuments: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentSessionId = useAppSelector(state => state.chat.currentSessionId);
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [backendStores, setBackendStores] = useState<any[]>([]);
  const [backendCollections, setBackendCollections] = useState<any[]>([]);
  const [selectedBackendIds, setSelectedBackendIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Document[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentSessionTags, setCurrentSessionTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean, message: string } | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [apiErrorDetails, setApiErrorDetails] = useState<string | null>(null);

  // Load data on component mount
  useEffect(() => {
    if (isOnline) {
      loadBackendData();
    }
    if (currentSessionId) {
      loadSessionTags(currentSessionId);
    }
  }, [currentSessionId, isOnline]);

  // Load backend API data
  const loadBackendData = async () => {
    setLoadingBackend(true);
    setApiErrorDetails(null);
    
    try {
      // First, test the connection
      const status = await backendApiService.testConnection();
      setConnectionStatus(status);
      
      if (status.success) {
        try {
          // Load vector stores
          console.log('Fetching vector stores...');
          const stores = await backendApiService.getVectorStores();
          console.log('Vector stores received:', stores);
          setBackendStores(stores);
          
          // Set initial backend selection
          if (stores.length > 0) {
            setSelectedBackendIds(stores.map(store => store.id));
          }
        } catch (error) {
          console.error('Error fetching vector stores:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setApiErrorDetails(`Vector stores error: ${errorMsg}`);
        }
        
        try {
          // Load collections
          console.log('Fetching collections...');
          const collections = await backendApiService.getCollections();
          console.log('Collections received:', collections);
          setBackendCollections(collections);
          
          // Set initial collection selection
          if (collections.length > 0) {
            setSelectedCollectionIds(collections.map(collection => collection.id));
          }
          
          // Extract all available tags from collections
          const allTags = new Set<string>();
          collections.forEach(collection => {
            collection.tags.forEach((tag: string) => allTags.add(tag));
          });
          
          setAvailableTags(Array.from(allTags));
        } catch (error) {
          console.error('Error fetching collections:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setApiErrorDetails(`Collections error: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Error loading backend data:', error);
      // Don't show connection error on initial load - user can click refresh if needed
      if (connectionStatus !== null) {
        setConnectionStatus({
          success: false,
          message: `Error connecting to backend: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } finally {
      setLoadingBackend(false);
    }
  };

  // Load tags associated with the current session
  const loadSessionTags = async (sessionId: string) => {
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId }
      }).exec();
      
      if (session) {
        setCurrentSessionTags(session.documentTags || []);
      }
    } catch (error) {
      console.error('Error loading session tags:', error);
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setSearchResults([]);
    setHasSearched(true);
    
    try {
      // Search using backend API
      const results = await backendApiService.searchDocuments(
        searchTerm,
        {
          k: 10,
          backendIds: selectedBackendIds,
          collectionIds: selectedCollectionIds,
          tags: tagFilters
        }
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add a tag to the current session for RAG
  const addTagToSession = async (tag: string) => {
    if (!currentSessionId) {
      alert("Please select a chat session first");
      return;
    }
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Add tag if not already present
        if (!currentSessionTags.includes(tag)) {
          const updatedTags = [...currentSessionTags, tag];
          await session.update({
            $set: { documentTags: updatedTags }
          });
          setCurrentSessionTags(updatedTags);
        } else {
          alert("This tag is already added to the current chat");
        }
      }
    } catch (error) {
      console.error('Error adding tag to session:', error);
      alert("Error adding tag to chat");
    }
  };

  // Add a backend store to the current session
  const addBackendStoreToSession = async (backendId: string) => {
    if (!currentSessionId) {
      alert("Please select a chat session first");
      return;
    }
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Create backend store tag
        const backendTag = `backend:${backendId}`;
        
        // Add tag if not already present
        if (!currentSessionTags.includes(backendTag)) {
          const updatedTags = [...currentSessionTags, backendTag];
          await session.update({
            $set: { documentTags: updatedTags }
          });
          setCurrentSessionTags(updatedTags);
        } else {
          alert("This backend store is already added to the current chat");
        }
      }
    } catch (error) {
      console.error('Error adding backend store to session:', error);
      alert("Error adding backend store to chat");
    }
  };

  // Add a backend store with specific tags to the current session
  const addBackendStoreWithTagsToSession = async (backendId: string, tags: string[]) => {
    if (!currentSessionId) {
      alert("Please select a chat session first");
      return;
    }
    
    if (!tags || tags.length === 0) {
      // If no tags selected, add the entire backend store
      return addBackendStoreToSession(backendId);
    }
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Create backend store tag with tags filter
        // Format: backend:backendId:tag1,tag2,tag3
        const backendTag = `backend:${backendId}:${tags.join(',')}`;
        
        // Add tag if not already present
        if (!currentSessionTags.some(tag => tag.startsWith(`backend:${backendId}:`))) {
          const updatedTags = [...currentSessionTags, backendTag];
          await session.update({
            $set: { documentTags: updatedTags }
          });
          setCurrentSessionTags(updatedTags);
        } else {
          alert("This backend store with tags is already added to the current chat");
        }
      }
    } catch (error) {
      console.error('Error adding backend store with tags to session:', error);
      alert("Error adding backend store to chat");
    }
  };

  // Remove a tag from the current session
  const removeTagFromSession = async (tag: string) => {
    if (!currentSessionId) return;
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        const updatedTags = currentSessionTags.filter(t => t !== tag);
        await session.update({
          $set: { documentTags: updatedTags }
        });
        setCurrentSessionTags(updatedTags);
      }
    } catch (error) {
      console.error('Error removing tag from session:', error);
    }
  };

  // Create a new chat with selected backend store and tags
  const startChatWithBackendStore = async (backendId: string, selectedTags: string[] = []) => {
    try {
      const backendStore = backendStores.find(store => store.id === backendId);
      if (!backendStore) return;
      
      // Create a unique tag for this backend store, including optional tag filters
      let backendTag = `backend:${backendStore.id}`;
      if (selectedTags && selectedTags.length > 0) {
        // Format: backend:backendId:tag1,tag2,tag3
        backendTag = `backend:${backendStore.id}:${selectedTags.join(',')}`;
      }
      
      // Create a new session
      const newSessionId = uuidv4();
      
      // Add to RxDB first
      const db = await getDB();
      await db.sessions.insert({
        sessionId: newSessionId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        title: `Chat with ${backendStore.name}${selectedTags.length > 0 ? ` (${selectedTags.length} tags)` : ''}`,
        messages: [],
        documentTags: [backendTag]
      });
      
      // Navigate to the new session
      dispatch(startSession(newSessionId));
    } catch (error) {
      console.error('Error starting chat with backend store:', error);
    }
  };

  // Toggle backend store selection for filtering
  const toggleBackendSelection = (backendId: string) => {
    if (selectedBackendIds.includes(backendId)) {
      setSelectedBackendIds(selectedBackendIds.filter(id => id !== backendId));
    } else {
      setSelectedBackendIds([...selectedBackendIds, backendId]);
    }
  };

  // Add a collection to the current session
  const addCollectionToSession = async (collectionId: string) => {
    if (!currentSessionId) {
      alert("Please select a chat session first");
      return;
    }
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Create collection tag
        const collectionTag = `collection:${collectionId}`;
        
        // Add tag if not already present
        if (!currentSessionTags.includes(collectionTag)) {
          const updatedTags = [...currentSessionTags, collectionTag];
          await session.update({
            $set: { documentTags: updatedTags }
          });
          setCurrentSessionTags(updatedTags);
        } else {
          alert("This collection is already added to the current chat");
        }
      }
    } catch (error) {
      console.error('Error adding collection to session:', error);
      alert("Error adding collection to chat");
    }
  };

  // Create a new chat with selected collection
  const startChatWithCollection = async (collectionId: string, selectedTags: string[] = []) => {
    try {
      const collection = backendCollections.find(c => c.id === collectionId);
      if (!collection) return;
      
      // Create a unique tag for this collection, including optional tag filters
      let collectionTag = `collection:${collection.id}`;
      if (selectedTags && selectedTags.length > 0) {
        // Format: collection:collectionId:tag1,tag2,tag3
        collectionTag = `collection:${collection.id}:${selectedTags.join(',')}`;
      }
      
      // Create a new session
      const newSessionId = uuidv4();
      
      // Add to RxDB first
      const db = await getDB();
      await db.sessions.insert({
        sessionId: newSessionId,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        title: `Chat with ${collection.name}${selectedTags.length > 0 ? ` (${selectedTags.length} tags)` : ''}`,
        messages: [],
        documentTags: [collectionTag]
      });
      
      // Navigate to the new session
      dispatch(startSession(newSessionId));
    } catch (error) {
      console.error('Error starting chat with collection:', error);
    }
  };

  // Toggle collection selection for filtering
  const toggleCollectionSelection = (collectionId: string) => {
    if (selectedCollectionIds.includes(collectionId)) {
      setSelectedCollectionIds(selectedCollectionIds.filter(id => id !== collectionId));
    } else {
      setSelectedCollectionIds([...selectedCollectionIds, collectionId]);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header Section */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Company Documents
          <Tooltip title="Search across backend vector databases">
            <IconButton size="small" sx={{ ml: 1 }}>
              <CloudIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isOnline && connectionStatus === null && !loadingBackend && (
            <Button
              size="small"
              startIcon={<SyncAltIcon />}
              onClick={loadBackendData}
              sx={{ ml: 2 }}
              variant="outlined"
            >
              Connect
            </Button>
          )}
        </Typography>
        
        {/* Offline Alert */}
        {!isOnline && (
          <Alert 
            severity="info" 
            icon={<CloudOffIcon />}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2">Offline Mode</Typography>
            <Typography variant="body2">
              Company documents require an internet connection. This feature is temporarily unavailable.
            </Typography>
          </Alert>
        )}
        
        {/* Connection Status */}
        {connectionStatus && isOnline && (
          <Alert 
            severity={connectionStatus.success ? "success" : "error"}
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={loadBackendData}
                disabled={loadingBackend}
              >
                {loadingBackend ? <CircularProgress size={16} /> : "Refresh"}
              </Button>
            }
          >
            {connectionStatus.message}
            {apiErrorDetails && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {apiErrorDetails}
              </Typography>
            )}
          </Alert>
        )}
        
        {/* Search Bar */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <IconButton
            color="primary"
            onClick={handleSearch}
            disabled={loading || !searchTerm.trim() || !connectionStatus?.success || !isOnline}
            size="small"
          >
            {loading ? <CircularProgress size={20} /> : <SearchIcon />}
          </IconButton>
          <IconButton
            color="default"
            onClick={() => setShowFilters(!showFilters)}
            disabled={!isOnline}
            size="small"
          >
            {showFilters ? <FilterAltOffIcon /> : <FilterAltIcon />}
          </IconButton>
        </Box>

        {/* Filters Section */}
        {showFilters && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Backend Vector Stores
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {backendStores.map(store => (
                <Chip
                  key={store.id}
                  label={store.name}
                  color={selectedBackendIds.includes(store.id) ? 'primary' : 'default'}
                  onClick={() => toggleBackendSelection(store.id)}
                  variant={selectedBackendIds.includes(store.id) ? 'filled' : 'outlined'}
                />
              ))}
              {backendStores.length === 0 && !loadingBackend && (
                <Typography variant="body2" color="text.secondary">
                  {!isOnline ? 'Offline - cannot load vector stores' : 'No backend vector stores available.'}
                </Typography>
              )}
              {loadingBackend && isOnline && (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              )}
            </Box>
            
            <Typography variant="subtitle2" gutterBottom>
              Collections
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {backendCollections.map(collection => (
                <Chip
                  key={collection.id}
                  label={collection.name}
                  color={selectedCollectionIds.includes(collection.id) ? 'primary' : 'default'}
                  onClick={() => toggleCollectionSelection(collection.id)}
                  variant={selectedCollectionIds.includes(collection.id) ? 'filled' : 'outlined'}
                />
              ))}
              {backendCollections.length === 0 && !loadingBackend && (
                <Typography variant="body2" color="text.secondary">
                  {!isOnline ? 'Offline - cannot load collections' : 'No collections available.'}
                </Typography>
              )}
              {loadingBackend && isOnline && (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              )}
            </Box>
            
            <Typography variant="subtitle2" gutterBottom>
              Tags
            </Typography>
            <Autocomplete
              multiple
              options={availableTags}
              value={tagFilters}
              onChange={(_, newValue) => setTagFilters(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  placeholder="Filter by tags..."
                  size="small"
                />
              )}
              size="small"
              sx={{ mb: 2 }}
            />
          </Paper>
        )}
        
        {/* Current Session Tags */}
        {currentSessionId && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Active Sources for Current Chat
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {currentSessionTags.length > 0 ? (
                currentSessionTags.map((tag) => {
                  // Check if this is a backend store tag
                  const isBackendTag = tag.startsWith('backend:');
                  const isCollectionTag = tag.startsWith('collection:');
                  
                  let tagParts, displayName, icon;
                  
                  if (isBackendTag) {
                    tagParts = tag.split(':');
                    const backendId = tagParts.length > 1 ? tagParts[1] : '';
                    const backendStore = backendStores.find(s => s.id === backendId);
                    
                    // Check if this is a tag with filters
                    const hasTags = tagParts.length > 2;
                    let tagList: string[] = [];
                    if (hasTags) {
                      tagList = tagParts[2].split(',');
                    }
                    
                    displayName = backendStore 
                      ? `${backendStore.name}${hasTags ? ` (${tagList.length} tags)` : ''}` 
                      : tag;
                    
                    icon = <CloudIcon />;
                  } else if (isCollectionTag) {
                    tagParts = tag.split(':');
                    const collectionId = tagParts.length > 1 ? tagParts[1] : '';
                    const collection = backendCollections.find(c => c.id === collectionId);
                    
                    // Check if this is a tag with filters
                    const hasTags = tagParts.length > 2;
                    let tagList: string[] = [];
                    if (hasTags) {
                      tagList = tagParts[2].split(',');
                    }
                    
                    displayName = collection 
                      ? `${collection.name}${hasTags ? ` (${tagList.length} tags)` : ''}` 
                      : tag;
                    
                    icon = <DatabaseIcon />;
                  } else {
                    displayName = tag;
                    icon = <LocalOfferIcon />;
                  }
                  
                  return (
                    <Chip
                      key={tag}
                      label={displayName}
                      onDelete={() => removeTagFromSession(tag)}
                      color="primary"
                      variant="outlined"
                      icon={icon}
                    />
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No vector databases enabled for this chat.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>
      
      {/* Search Results */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {!isOnline ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CloudOffIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Offline Mode
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={400}>
              Company documents require an internet connection to access vector databases. 
              Please connect to the internet to use this feature.
            </Typography>
          </Box>
        ) : loadingBackend && !hasSearched ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Loading vector databases...
            </Typography>
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : hasSearched ? (
          searchResults.length > 0 ? (
            <List>
              {searchResults.map((result, index) => {
                const sourceId = result.metadata.sourceId as string;
                const sourceName = result.metadata.sourceName as string;
                const tags = result.metadata.tags as string[] || [];
                
                return (
                  <Paper key={`result-${index}`} sx={{ mb: 2, overflow: 'hidden' }}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {/* Add source to chat */}
                          <Tooltip title="Use this source for current chat">
                            <IconButton
                              edge="end"
                              onClick={() => addBackendStoreToSession(sourceId)}
                              disabled={!currentSessionId || currentSessionTags.includes(`backend:${sourceId}`)}
                            >
                              <ChatIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {/* Add tag to chat */}
                          {tags.length > 0 && (
                            <Tooltip title="Add a tag from this document">
                              <IconButton
                                edge="end" 
                                onClick={() => {
                                  // If only one tag, add it directly
                                  if (tags.length === 1) {
                                    addTagToSession(tags[0]);
                                  } else {
                                    // TODO: Show tag selection dialog
                                    alert(`Available tags: ${tags.join(', ')}`);
                                  }
                                }}
                                disabled={!currentSessionId}
                              >
                                <LocalOfferIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      }
                      sx={{ bgcolor: 'background.paper' }}
                    >
                      <ListItemIcon>
                        <CloudIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="subtitle1">
                              {result.metadata.documentName || "Unnamed Document"}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={sourceName} 
                              sx={{ ml: 1 }} 
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {result.pageContent}
                            </Typography>
                            
                            {tags && tags.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {tags.map(tag => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      if (currentSessionId) {
                                        addTagToSession(tag);
                                      }
                                    }}
                                    clickable={!!currentSessionId}
                                    className="document-tag"
                                  />
                                ))}
                              </Box>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  </Paper>
                );
              })}
            </List>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No results found. Try a different search term or adjust your filters.
              </Typography>
            </Box>
          )
        ) : (
          // Initial state - show available backend stores and collections
          (connectionStatus?.success && (backendStores.length > 0 || backendCollections.length > 0)) ? (
            <Box>
              {/* Vector Stores Section */}
              {backendStores.length > 0 && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Available Vector Databases
                  </Typography>
                  <List>
                    {backendStores.map((store) => (
                      <Paper key={store.id} sx={{ mb: 2, overflow: 'hidden' }}>
                        <ListItem
                          secondaryAction={
                            <Tooltip title={
                              currentSessionId
                                ? "Add to current chat"
                                : "Create new chat with this database"
                            }>
                              <IconButton
                                edge="end"
                                onClick={() => currentSessionId
                                  ? addBackendStoreToSession(store.id)
                                  : startChatWithBackendStore(store.id)
                                }
                                disabled={Boolean(currentSessionId && currentSessionTags.includes(`backend:${store.id}`))}
                                color={currentSessionId && currentSessionTags.includes(`backend:${store.id}`) ? "success" : "primary"}
                              >
                                {currentSessionId && currentSessionTags.includes(`backend:${store.id}`)
                                  ? <CheckCircleIcon />
                                  : <ChatIcon />
                                }
                              </IconButton>
                            </Tooltip>
                          }
                          sx={{ bgcolor: 'background.paper' }}
                        >
                          <ListItemIcon>
                            <CloudIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1">
                                {store.name}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary">
                                {store.description || `${store.type} vector database`}
                              </Typography>
                            }
                          />
                        </ListItem>
                      </Paper>
                    ))}
                  </List>
                </>
              )}
              
              {/* Collections Section */}
              {backendCollections.length > 0 && (
                <>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                    Available Collections
                  </Typography>
                  <List>
                    {backendCollections.map((collection) => (
                      <Paper key={collection.id} sx={{ mb: 2, overflow: 'hidden' }}>
                        <ListItem
                          secondaryAction={
                            <Tooltip title={
                              currentSessionId
                                ? "Add to current chat"
                                : "Create new chat with this collection"
                            }>
                              <IconButton
                                edge="end"
                                onClick={() => currentSessionId
                                  ? addCollectionToSession(collection.id)
                                  : startChatWithCollection(collection.id)
                                }
                                disabled={Boolean(currentSessionId && currentSessionTags.includes(`collection:${collection.id}`))}
                                color={currentSessionId && currentSessionTags.includes(`collection:${collection.id}`) ? "success" : "primary"}
                              >
                                {currentSessionId && currentSessionTags.includes(`collection:${collection.id}`)
                                  ? <CheckCircleIcon />
                                  : <ChatIcon />
                                }
                              </IconButton>
                            </Tooltip>
                          }
                          sx={{ bgcolor: 'background.paper' }}
                        >
                          <ListItemIcon>
                            <DatabaseIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1">
                                {collection.name}
                              </Typography>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  {collection.description || "Document collection"}
                                </Typography>
                                {collection.tags && collection.tags.length > 0 && (
                                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {collection.tags.map((tag: string) => (
                                      <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          if (currentSessionId) {
                                            addTagToSession(tag);
                                          }
                                        }}
                                        clickable={!!currentSessionId}
                                      />
                                    ))}
                                  </Box>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      </Paper>
                    ))}
                  </List>
                </>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {!isOnline 
                  ? 'Connect to the internet to access company documents from vector databases.'
                  : connectionStatus === null
                    ? 'Click the refresh button above to connect to the backend API and load available vector databases.'
                    : 'Enter a search term to find relevant documents from the vector database.'}
              </Typography>
              {!connectionStatus?.success && !loadingBackend && isOnline && (
                <Button
                  variant="outlined"
                  startIcon={<SyncAltIcon />}
                  onClick={loadBackendData}
                  sx={{ mt: 2 }}
                >
                  Connect to Backend
                </Button>
              )}
            </Box>
          )
        )}
      </Box>
    </Box>
  );
}; 