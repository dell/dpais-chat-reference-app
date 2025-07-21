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
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Autocomplete,
  Menu,
  MenuItem,
  LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderIcon from '@mui/icons-material/Folder';
import ChatIcon from '@mui/icons-material/Chat';
import TagIcon from '@mui/icons-material/Tag';
import { DocumentManager } from '../../services/DocumentManager';
import { DocumentDocType } from '../../db/types';
import { getDB } from '../../db/db';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { startSession } from '../../store/store';
import { v4 as uuidv4 } from 'uuid';
import './DocumentLibrary.css';

// EmbeddingProgress interface similar to DocumentUpload
interface EmbeddingProgress {
  processedChunks: number;
  totalChunks: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  chunkProcessingRate: number;
  currentFile?: string;
}

// Add the formatTime function to format time display
const formatTime = (milliseconds: number): string => {
  if (!milliseconds || milliseconds <= 0) return '0s';
  
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export const DocumentLibrary: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentSessionId = useAppSelector(state => state.chat.currentSessionId);
  const [documents, setDocuments] = useState<DocumentDocType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewDocument, setViewDocument] = useState<DocumentDocType | null>(null);
  const [currentSessionTags, setCurrentSessionTags] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    docId: string | null;
  } | null>(null);
  const [tagContextMenu, setTagContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    tag: string;
  } | null>(null);
  
  // Add this constant for our special tag prefix
  const DOCUMENT_REF_PREFIX = "doc:";
  
  // Add the embeddingProgress state
  const [embeddingProgress, setEmbeddingProgress] = useState<EmbeddingProgress | null>(null);
  
  // Load documents and tags
  useEffect(() => {
    loadDocuments();
    loadAllTags();
    
    if (currentSessionId) {
      loadSessionTags(currentSessionId);
    }
  }, [currentSessionId]);
  
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const db = await getDB();
      const docs = await db.documents.find().exec();
      const docList = docs.map(doc => doc.toJSON() as DocumentDocType);
      
      // Filter by search term if any
      const filtered = searchTerm
        ? docList.filter(doc => 
            doc.metadata.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : docList;
        
      setDocuments(filtered);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadAllTags = async () => {
    try {
      const tags = await DocumentManager.getAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };
  
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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };
  
  const handleAddTag = () => {
    if (newTag && !uploadTags.includes(newTag)) {
      setUploadTags([...uploadTags, newTag]);
      setNewTag('');
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setUploadTags(uploadTags.filter(tag => tag !== tagToRemove));
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setEmbeddingProgress(null);
    
    try {
      // Update progress with file information
      setEmbeddingProgress({
        processedChunks: 0,
        totalChunks: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        chunkProcessingRate: 0,
        currentFile: selectedFile.name
      });
      
      // Pass the progress callback to uploadDocument
      await DocumentManager.uploadDocument(
        selectedFile, 
        uploadTags,
        (progress) => {
          setEmbeddingProgress({
            ...progress,
            currentFile: selectedFile.name
          });
        }
      );
      
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadTags([]);
      setEmbeddingProgress(null);
      
      // Refresh documents and tags
      await loadDocuments();
      await loadAllTags();
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploading(false);
    }
  };
  
  const handleDeleteDocument = async (id: string) => {
    try {
      await DocumentManager.deleteDocument(id);
      setConfirmDeleteId(null);
      await loadDocuments();
      await loadAllTags();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };
  
  const handleAddTagToSession = async (tag: string) => {
    if (!currentSessionId || currentSessionTags.includes(tag)) return;
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        const updatedTags = [...currentSessionTags, tag];
        await session.update({
          $set: { documentTags: updatedTags }
        });
        setCurrentSessionTags(updatedTags);
      }
    } catch (error) {
      console.error('Error adding tag to session:', error);
    }
  };
  
  const handleRemoveTagFromSession = async (tag: string) => {
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
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };
  
  const handleContextMenu = (event: React.MouseEvent, docId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      docId
    });
  };
  
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };
  
  const handleTagContextMenu = (event: React.MouseEvent, tag: string) => {
    event.preventDefault();
    event.stopPropagation();
    setTagContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      tag
    });
  };
  
  const handleCloseTagContextMenu = () => {
    setTagContextMenu(null);
  };
  
  // New functions to support chat with document/tag
  const startChatWithDocument = async (documentId: string) => {
    try {
      // Find the document
      const document = documents.find(doc => doc.id === documentId);
      if (!document) return;
      
      // Create a new chat session
      const newSessionId = uuidv4();
      dispatch(startSession(newSessionId));
      
      // Get tags from the document
      const docTags = document.metadata.tags;
      
      // Add document tags to the session
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: newSessionId }
      }).exec();
      
      if (session) {
        await session.update({
          $set: { 
            documentTags: docTags,
            title: `Chat about ${document.metadata.filename}`
          }
        });
      }
    } catch (error) {
      console.error('Error starting chat with document:', error);
    }
  };
  
  const startChatWithTag = async (tag: string) => {
    try {
      // Create a new chat session
      const newSessionId = uuidv4();
      dispatch(startSession(newSessionId));
      
      // Add the tag to the session
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: newSessionId }
      }).exec();
      
      if (session) {
        await session.update({
          $set: { 
            documentTags: [tag],
            title: `Chat about ${tag}`
          }
        });
      }
    } catch (error) {
      console.error('Error starting chat with tag:', error);
    }
  };
  
  // Update this function to create a special tag for the document
  const addDocumentToCurrentChat = async (documentId: string) => {
    if (!currentSessionId) return;
    
    try {
      // Find the document
      const document = documents.find(doc => doc.id === documentId);
      if (!document) return;
      
      // Create a special document reference tag
      const documentRefTag = `${DOCUMENT_REF_PREFIX}${documentId}`;
      
      // Get current session
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Check if document is already referenced
        const existingTags = currentSessionTags || [];
        if (existingTags.includes(documentRefTag)) {
          return; // Document already added
        }
        
        // Add the document reference tag
        const newTags = [...existingTags, documentRefTag];
        
        // Update session with new tags
        await session.update({
          $set: { documentTags: newTags }
        });
        
        // Update local state
        setCurrentSessionTags(newTags);
      }
    } catch (error) {
      console.error('Error adding document to current chat:', error);
    }
  };
  
  // Add this function to remove a document from the chat
  const removeDocumentFromChat = async (documentId: string) => {
    if (!currentSessionId) return;
    
    try {
      const documentRefTag = `${DOCUMENT_REF_PREFIX}${documentId}`;
      
      // Get current session
      const db = await getDB();
      const session = await db.sessions.findOne({
        selector: { sessionId: currentSessionId }
      }).exec();
      
      if (session) {
        // Remove the document reference tag
        const updatedTags = currentSessionTags.filter(tag => tag !== documentRefTag);
        
        // Update session
        await session.update({
          $set: { documentTags: updatedTags }
        });
        
        // Update local state
        setCurrentSessionTags(updatedTags);
      }
    } catch (error) {
      console.error('Error removing document from chat:', error);
    }
  };
  
  // Update this function to check for direct document references
  const isDocumentInCurrentChat = (doc: DocumentDocType): boolean => {
    if (!currentSessionId || !currentSessionTags.length) return false;
    
    // Check for direct document reference
    const documentRefTag = `${DOCUMENT_REF_PREFIX}${doc.id}`;
    if (currentSessionTags.includes(documentRefTag)) {
      return true;
    }
    
    // Fall back to checking if all document tags are included
    if (doc.metadata.tags.length === 0) return false;
    return doc.metadata.tags.every(tag => currentSessionTags.includes(tag));
  };
  
  // Add a helper to check if a document is directly referenced
  const isDocumentDirectlyReferenced = (docId: string): boolean => {
    if (!currentSessionId || !currentSessionTags.length) return false;
    const documentRefTag = `${DOCUMENT_REF_PREFIX}${docId}`;
    return currentSessionTags.includes(documentRefTag);
  };
  
  // Helper to get regular tags (not document references)
  const getRegularTags = (): string[] => {
    return currentSessionTags.filter(tag => !tag.startsWith(DOCUMENT_REF_PREFIX));
  };
  
  // Helper to get document IDs from tags
  const getReferencedDocumentIds = (): string[] => {
    return currentSessionTags
      .filter(tag => tag.startsWith(DOCUMENT_REF_PREFIX))
      .map(tag => tag.substring(DOCUMENT_REF_PREFIX.length));
  };
  
  // Get documents that are directly referenced
  const getReferencedDocuments = (): DocumentDocType[] => {
    const documentIds = getReferencedDocumentIds();
    return documents.filter(doc => documentIds.includes(doc.id));
  };
  
  return (
    <Box className="document-library" sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        marginBottom: 2,
        gap: 1
      }}>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          onClick={() => setUploadDialogOpen(true)}
          size="large"
        >
          Add Local Document
        </Button>
        
        <TextField
          placeholder="Search documents..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
          sx={{ flexGrow: 1 }}
        />
      </Box>
      
      {currentSessionId && (
        <Box className="session-tags">
          <Typography variant="subtitle2">
            Current Chat References:
          </Typography>
          
          {currentSessionTags.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No document references added
            </Typography>
          ) : (
            <>
              {/* Direct document references */}
              {getReferencedDocuments().length > 0 && (
                <Box className="referenced-documents">
                  <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                    Documents:
                  </Typography>
                  <Box className="tag-chips">
                    {getReferencedDocuments().map(doc => (
                      <Chip
                        key={`doc-${doc.id}`}
                        label={doc.metadata.filename}
                        onDelete={() => removeDocumentFromChat(doc.id)}
                        size="small"
                        color="secondary"
                        icon={<FolderIcon fontSize="small" />}
                        sx={{ fontWeight: 'medium' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Tags */}
              {getRegularTags().length > 0 && (
                <Box className="tag-references">
                  <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
                    Tags:
                  </Typography>
                  <Box className="tag-chips">
                    {getRegularTags().map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() => handleRemoveTagFromSession(tag)}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onContextMenu={(e) => handleTagContextMenu(e, tag)}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
          
          <Autocomplete
            size="small"
            options={allTags.filter(tag => !currentSessionTags.includes(tag))}
            renderInput={(params) => (
              <TextField 
                {...params} 
                placeholder="Add tag reference..." 
                size="small"
                variant="outlined"
              />
            )}
            onChange={(_, value) => value && handleAddTagToSession(value)}
            className="tag-autocomplete"
          />
        </Box>
      )}
      
      <Divider sx={{ my: 1 }} />
      
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Your Documents
      </Typography>
      
      {loading ? (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          padding: 2 
        }}>
          <CircularProgress size={24} />
        </Box>
      ) : documents.length === 0 ? (
        <Typography 
          variant="body2" 
          color="textSecondary" 
          sx={{ py: 2, textAlign: 'center' }}
        >
          No documents found
        </Typography>
      ) : (
        <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {documents.map(doc => (
            <ListItem
              key={doc.id}
              component="div"
              onClick={() => setViewDocument(doc)}
              onContextMenu={(e) => handleContextMenu(e, doc.id)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                transition: 'background-color 0.2s ease',
                position: 'relative',
                ...(isDocumentInCurrentChat(doc) && !isDocumentDirectlyReferenced(doc.id) && {
                  bgcolor: 'rgba(var(--primary-color-rgb), 0.08)',
                  borderLeft: '3px solid',
                  borderLeftColor: 'primary.main',
                }),
                ...(isDocumentDirectlyReferenced(doc.id) && {
                  bgcolor: 'rgba(var(--secondary-color-rgb), 0.08)',
                  borderLeft: '3px solid',
                  borderLeftColor: 'secondary.main',
                })
              }}
            >
              <FolderIcon sx={{ 
                mr: 1, 
                color: theme => theme.palette.mode === 'dark' ? '#999' : '#757575' 
              }} />
              <ListItemText
                primary={doc.metadata.filename}
                secondary={
                  <Box component="div">
                    <Typography variant="caption" component="span">
                      {formatDate(doc.metadata.uploadDate)} · {formatSize(doc.metadata.size)}
                      {isDocumentDirectlyReferenced(doc.id) && currentSessionId && (
                        <Typography 
                          component="span" 
                          variant="caption" 
                          color="secondary" 
                          sx={{ ml: 1, fontWeight: 'bold' }}
                        >
                          • Direct reference
                        </Typography>
                      )}
                      {isDocumentInCurrentChat(doc) && !isDocumentDirectlyReferenced(doc.id) && currentSessionId && (
                        <Typography 
                          component="span" 
                          variant="caption" 
                          color="primary" 
                          sx={{ ml: 1, fontWeight: 'bold' }}
                        >
                          • Via tags
                        </Typography>
                      )}
                    </Typography>
                    <Box className="document-item-tags">
                      {doc.metadata.tags.slice(0, 3).map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          className="document-tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentSessionId && !currentSessionTags.includes(tag)) {
                              handleAddTagToSession(tag);
                            }
                          }}
                          onContextMenu={(e) => handleTagContextMenu(e, tag)}
                        />
                      ))}
                      {doc.metadata.tags.length > 3 && (
                        <Chip
                          label={`+${doc.metadata.tags.length - 3}`}
                          size="small"
                          className="document-tag"
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
              {currentSessionId && (
                <Box className="document-actions" onClick={(e) => e.stopPropagation()}>
                  {isDocumentDirectlyReferenced(doc.id) ? (
                    <IconButton 
                      size="small" 
                      color="secondary"
                      onClick={() => removeDocumentFromChat(doc.id)}
                      title="Remove from chat"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => addDocumentToCurrentChat(doc.id)}
                      title="Add to current chat"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}
            </ListItem>
          ))}
        </List>
      )}
      
      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Local Document</DialogTitle>
        <DialogContent>
          <Box className="upload-content">
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              className="file-select-button"
            >
              Select File
              <input
                type="file"
                hidden
                onChange={handleFileChange}
                accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.md,.js,.ts,.py,.java,.html,.css,.json,.xml"
              />
            </Button>
            
            {selectedFile && (
              <Typography variant="body2" className="selected-file">
                Selected: {selectedFile.name} ({formatSize(selectedFile.size)})
              </Typography>
            )}
            
            <Typography variant="subtitle2" className="tags-heading">
              Add Tags
            </Typography>
            
            <Box className="tag-input">
              <TextField
                size="small"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Enter tag name"
                className="tag-field"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddTag}
                disabled={!newTag}
              >
                Add
              </Button>
            </Box>
            
            <Box className="upload-tags">
              {uploadTags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  size="small"
                  className="upload-tag"
                />
              ))}
            </Box>
            
            {/* Embedding Progress Section */}
            {embeddingProgress && (
              <Box className="embedding-progress-container">
                <Box className="progress-header">
                  <Typography variant="body2">
                    <span className="chunk-pulse"></span>
                    Processing {embeddingProgress.currentFile}
                  </Typography>
                  <Typography variant="body2">
                    {embeddingProgress.processedChunks}/{embeddingProgress.totalChunks} chunks
                  </Typography>
                </Box>
                
                <Box className="progress-bar-wrapper">
                  <Box 
                    className="progress-bar"
                    sx={{ 
                      width: embeddingProgress.totalChunks > 0 
                        ? `${(embeddingProgress.processedChunks / embeddingProgress.totalChunks) * 100}%` 
                        : '0%' 
                    }}
                  />
                </Box>
                
                <Box className="progress-stats">
                  <Typography variant="caption">
                    Time elapsed: {formatTime(embeddingProgress.elapsedTime)}
                  </Typography>
                  
                  <Typography variant="caption">
                    {embeddingProgress.chunkProcessingRate.toFixed(1)} chunks/sec
                  </Typography>
                  
                  <Typography variant="caption">
                    Est. remaining: {formatTime(embeddingProgress.estimatedTimeRemaining)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            startIcon={uploading && !embeddingProgress ? <CircularProgress size={20} /> : null}
          >
            {uploading ? 'Embedding Document...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* View Document Dialog */}
      <Dialog
        open={viewDocument !== null}
        onClose={() => setViewDocument(null)}
        maxWidth="md"
        fullWidth
      >
        {viewDocument && (
          <>
            <DialogTitle>
              {viewDocument.metadata.filename}
              <Typography variant="body2" color="textSecondary">
                {formatDate(viewDocument.metadata.uploadDate)} · {formatSize(viewDocument.metadata.size)}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Box className="document-tags-header">
                {viewDocument.metadata.tags.map(tag => (
                  <Tooltip 
                    title={currentSessionId ? (
                      currentSessionTags.includes(tag) 
                        ? "Remove from current chat" 
                        : "Add to current chat"
                    ) : "Right click to chat with this tag"}
                    key={tag}
                  >
                    <Chip
                      label={tag}
                      size="small"
                      className={`view-tag ${currentSessionTags.includes(tag) ? 'active-tag' : ''}`}
                      onClick={() => {
                        if (!currentSessionId) return;
                        
                        if (currentSessionTags.includes(tag)) {
                          handleRemoveTagFromSession(tag);
                        } else {
                          handleAddTagToSession(tag);
                        }
                      }}
                      onContextMenu={(e) => handleTagContextMenu(e, tag)}
                    />
                  </Tooltip>
                ))}
              </Box>
              <Box className="document-preview">
                <pre>{viewDocument.content}</pre>
              </Box>
            </DialogContent>
            <DialogActions>
              {currentSessionId && (
                isDocumentDirectlyReferenced(viewDocument.id) ? (
                  <Button
                    startIcon={<DeleteIcon />}
                    color="secondary"
                    onClick={() => {
                      removeDocumentFromChat(viewDocument.id);
                    }}
                  >
                    Remove from current chat
                  </Button>
                ) : (
                  <Button
                    startIcon={<AddIcon />}
                    color="primary"
                    onClick={() => {
                      addDocumentToCurrentChat(viewDocument.id);
                    }}
                  >
                    Add to current chat
                  </Button>
                )
              )}
              <Button 
                startIcon={<ChatIcon />}
                color="primary"
                onClick={() => {
                  startChatWithDocument(viewDocument.id);
                  setViewDocument(null);
                }}
              >
                Start new chat with document
              </Button>
              <Button onClick={() => setViewDocument(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Document Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {currentSessionId && contextMenu?.docId && (
          isDocumentDirectlyReferenced(contextMenu.docId) ? (
            <MenuItem 
              onClick={() => {
                removeDocumentFromChat(contextMenu.docId!);
                handleCloseContextMenu();
              }}
            >
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Remove from current chat
            </MenuItem>
          ) : (
            <MenuItem 
              onClick={() => {
                addDocumentToCurrentChat(contextMenu.docId!);
                handleCloseContextMenu();
              }}
            >
              <AddIcon fontSize="small" sx={{ mr: 1 }} />
              Add to current chat
            </MenuItem>
          )
        )}
        <MenuItem 
          onClick={() => {
            if (contextMenu?.docId) {
              startChatWithDocument(contextMenu.docId);
              handleCloseContextMenu();
            }
          }}
        >
          <ChatIcon fontSize="small" sx={{ mr: 1 }} />
          Start new chat with document
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (contextMenu?.docId) {
              setConfirmDeleteId(contextMenu.docId);
              handleCloseContextMenu();
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
      
      {/* Tag Context Menu */}
      <Menu
        open={tagContextMenu !== null}
        onClose={handleCloseTagContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          tagContextMenu !== null
            ? { top: tagContextMenu.mouseY, left: tagContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem 
          onClick={() => {
            if (tagContextMenu?.tag) {
              startChatWithTag(tagContextMenu.tag);
              handleCloseTagContextMenu();
            }
          }}
        >
          <ChatIcon fontSize="small" sx={{ mr: 1 }} />
          Start new chat with tag
        </MenuItem>
      </Menu>
      
      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this document? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button 
            onClick={() => confirmDeleteId && handleDeleteDocument(confirmDeleteId)}
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 