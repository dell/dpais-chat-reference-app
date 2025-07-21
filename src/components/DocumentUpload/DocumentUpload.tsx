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
  Button,
  TextField,
  Typography,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { DocumentManager } from '../../services/DocumentManager';
import { DocumentDocType, DocumentChunkDocType } from '../../db/types';
import { getDB } from '../../db/db';
import './DocumentUpload.css';

// Define interfaces for different document types in search results
interface DocumentSearchResult {
  document: DocumentDocType;
  similarity: number;
}

interface ChunkSearchResult {
  document: DocumentChunkDocType;
  similarity: number;
}

// Use a type that can be either document or chunk search results
type SearchResult = DocumentSearchResult | ChunkSearchResult;

interface EmbeddingProgress {
  processedChunks: number;
  totalChunks: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  chunkProcessingRate: number;
  currentFile?: string;
  fileIndex?: number;
  totalFiles?: number;
}

export const DocumentUpload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [documents, setDocuments] = useState<DocumentDocType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewDocument, setViewDocument] = useState<DocumentDocType | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // New state for tracking embedding progress
  const [embeddingProgress, setEmbeddingProgress] = useState<EmbeddingProgress | null>(null);
  
  // Format time helper function
  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || milliseconds <= 0) return '0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Function to determine if a search result is a document or a chunk
  const isDocumentResult = (result: SearchResult): result is DocumentSearchResult => {
    return 'uploadDate' in result.document.metadata;
  };

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const db = await getDB();
      const docs = await db.documents.find().exec();
      setDocuments(docs.map(doc => doc.toJSON() as DocumentDocType));
      
      // Load all tags
      const allTags = await DocumentManager.getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setEmbeddingProgress(null);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress with file information
        setEmbeddingProgress({
          processedChunks: 0,
          totalChunks: 0,
          elapsedTime: 0,
          estimatedTimeRemaining: 0,
          chunkProcessingRate: 0,
          currentFile: file.name,
          fileIndex: i,
          totalFiles: files.length
        });
        
        // Process document with progress tracking
        await DocumentManager.uploadDocument(
          file, 
          tags, 
          (progress) => {
            setEmbeddingProgress({
              ...progress,
              currentFile: file.name,
              fileIndex: i,
              totalFiles: files.length
            });
          }
        );
      }
      
      // Reset form
      setFiles([]);
      setTags([]);
      setEmbeddingProgress(null);
      
      // Reload documents
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading documents:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    setSearching(true);
    try {
      const results = await DocumentManager.searchDocuments(searchQuery);
      setSearchResults(results as SearchResult[]);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await DocumentManager.deleteDocument(id);
      await loadDocuments();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatSearchResultSecondary = (result: SearchResult): string => {
    if (isDocumentResult(result)) {
      return `Similarity: ${(result.similarity * 100).toFixed(1)}% • ${formatSize(result.document.metadata.size)} • ${formatDate(result.document.metadata.uploadDate)}`;
    } else {
      return `Similarity: ${(result.similarity * 100).toFixed(1)}% • Chunk ${result.document.chunkIndex + 1}`;
    }
  };

  return (
    <Box className="document-upload-container">
      <Typography variant="h5" gutterBottom>
        Document Library
      </Typography>

      <Paper className="upload-section">
        <Typography variant="h6" gutterBottom>
          Upload Documents
        </Typography>
        
        <Box className="file-input-container">
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            className="upload-button"
          >
            Select Files
            <input
              type="file"
              hidden
              multiple
              onChange={handleFileChange}
            />
          </Button>
          
          {files.length > 0 && (
            <Typography variant="body2">
              {files.length} file(s) selected
            </Typography>
          )}
        </Box>
        
        <Box className="tags-section">
          <Typography variant="subtitle2" gutterBottom>
            Add Tags
          </Typography>
          
          <Box className="tag-input">
            <TextField
              size="small"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag"
              variant="outlined"
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
          
          <Box className="tags-list">
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => handleRemoveTag(tag)}
                size="small"
                className="tag-chip"
              />
            ))}
          </Box>
        </Box>
        
        {/* Embedding Progress Section */}
        {embeddingProgress && (
          <Box className="embedding-progress-container">
            <Box className="progress-header">
              <Typography variant="body2">
                <span className="chunk-pulse"></span>
                Processing {embeddingProgress.currentFile}
                {embeddingProgress.totalFiles && embeddingProgress.totalFiles > 1 && 
                  ` (${embeddingProgress.fileIndex! + 1}/${embeddingProgress.totalFiles})`}
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
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          startIcon={uploading && !embeddingProgress ? <CircularProgress size={20} /> : null}
          className="submit-button"
        >
          {uploading ? 'Embedding Documents...' : 'Add Documents'}
        </Button>
      </Paper>

      <Paper className="search-section">
        <Typography variant="h6" gutterBottom>
          Search Documents
        </Typography>
        
        <Box className="search-input-container">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSearch}
            disabled={!searchQuery || searching}
            startIcon={searching ? <CircularProgress size={20} /> : <SearchIcon />}
          >
            Search
          </Button>
        </Box>
        
        {searchResults.length > 0 && (
          <Box className="search-results">
            <Typography variant="subtitle2" gutterBottom>
              Search Results
            </Typography>
            
            <List>
              {searchResults.map((result, index) => {
                const isDoc = isDocumentResult(result);
                const displayName = isDoc 
                  ? result.document.metadata.filename 
                  : `${result.document.metadata.documentName} (Chunk ${result.document.chunkIndex + 1})`;
                  
                return (
                  <ListItem
                    key={index}
                    button
                    onClick={() => {
                      if (isDoc) {
                        setViewDocument(result.document);
                      } else {
                        console.log("Viewing chunk:", result.document);
                      }
                    }}
                  >
                    <ListItemText
                      primary={displayName}
                      secondary={formatSearchResultSecondary(result)}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </Paper>

      <Paper className="documents-section">
        <Typography variant="h6" gutterBottom>
          Your Documents
        </Typography>
        
        {loading ? (
          <Box className="loading-container">
            <CircularProgress />
          </Box>
        ) : documents.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No documents uploaded yet.
          </Typography>
        ) : (
          <List>
            {documents.map(doc => (
              <ListItem
                key={doc.id}
                button
                onClick={() => setViewDocument(doc)}
              >
                <ListItemText
                  primary={doc.metadata.filename}
                  secondary={
                    <>
                      <Typography variant="body2" component="span">
                        {formatDate(doc.metadata.uploadDate)} • {formatSize(doc.metadata.size)}
                      </Typography>
                      <Box className="document-tags">
                        {doc.metadata.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            className="tag-chip-small"
                          />
                        ))}
                      </Box>
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => setConfirmDeleteId(doc.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Document Viewer Dialog */}
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
                {formatDate(viewDocument.metadata.uploadDate)} • {formatSize(viewDocument.metadata.size)}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Box className="document-tags-header">
                {viewDocument.metadata.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    className="tag-chip"
                  />
                ))}
              </Box>
              <Paper className="document-content">
                <pre>{viewDocument.content}</pre>
              </Paper>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDocument(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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