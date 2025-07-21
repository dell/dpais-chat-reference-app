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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Paper,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import './DocumentReferences.css';
import { getDB } from '../../db/db';

export interface DocumentChunk {
  content?: string;
  documentName: string;
  similarity: number;
  documentId?: string;
  chunkId?: string;
  chunkIndex?: number;
}

interface DocumentReferencesProps {
  references: DocumentChunk[];
}

export const DocumentReferences: React.FC<DocumentReferencesProps> = ({ references }) => {
  const [expanded, setExpanded] = useState<number | false>(false);
  const [referencesWithContent, setReferences] = useState<DocumentChunk[]>(references);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadedChunks, setLoadedChunks] = useState<Set<string>>(new Set());

  const handleChange = (panel: number) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Load content for all chunks when the component mounts or references change
  useEffect(() => {
    const loadAllContent = async () => {
      setIsLoading(true);
      
      try {
        const db = await getDB();
        const updatedRefs = [...referencesWithContent];
        let hasUpdates = false;
        
        for (let i = 0; i < updatedRefs.length; i++) {
          const ref = updatedRefs[i];
          // Skip if content is already present
          if (ref.content) {
            continue;
          }
          
          if (ref.chunkId) {
            // console.log(`Loading content for chunk ${i+1}/${updatedRefs.length}: ${ref.chunkId} (index: ${ref.chunkIndex})`);
            
            // Use chunkId for exact lookup
            const chunk = await db.documentChunks.findOne({
              selector: { id: { $eq: ref.chunkId } }
            }).exec();
            
            if (chunk) {
              updatedRefs[i] = { ...ref, content: chunk.content };
              hasUpdates = true;
              // console.log(`Content loaded successfully for chunk ${ref.chunkId}`);
            } else {
              console.warn(`Chunk not found: ${ref.chunkId}, trying alternate lookup`);
              
              // Fallback if needed
              if (ref.documentId) {
                // Try to find chunks by documentId and chunkIndex if available
                const selector = ref.chunkIndex !== undefined 
                  ? { documentId: ref.documentId, chunkIndex: ref.chunkIndex }
                  : { documentId: ref.documentId };
                  
                const altChunk = await db.documentChunks.findOne({ selector }).exec();
                
                if (altChunk) {
                  updatedRefs[i] = { ...ref, content: altChunk.content };
                  hasUpdates = true;
                  console.log(`Content loaded via alternate lookup`);
                }
              }
            }
          }
        }
        
        if (hasUpdates) {
          setReferences(updatedRefs);
        }
      } catch (error) {
        console.error("Error loading chunk contents:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only load if we have references with chunkIds and no content
    if (referencesWithContent.some(ref => !ref.content && ref.chunkId)) {
      loadAllContent();
    } else {
      // No loading needed, all content is already available
      setIsLoading(false);
    }
  }, [references]);

  useEffect(() => {
    // Initialize state with references that may already have content
    if (references !== referencesWithContent) {
      console.log('References changed, updating state...');
      
      // Check if any references already have content
      const hasUpdates = references.some((ref, idx) => 
        ref.content !== referencesWithContent[idx]?.content
      );
      
      if (hasUpdates || references.length !== referencesWithContent.length) {
        console.log('Updated references with new content');
        setReferences(references);
      }
      
      // If any reference is missing content, set loading state
      setIsLoading(references.some(ref => !ref.content && ref.chunkId));
    }
  }, [references]);

  if (!references || references.length === 0) {
    return null;
  }

  // Group references by document name
  const documentGroups = referencesWithContent.reduce((groups, ref) => {
    if (!groups[ref.documentName]) {
      groups[ref.documentName] = [];
    }
    groups[ref.documentName].push(ref);
    return groups;
  }, {} as Record<string, DocumentChunk[]>);
  
  // console.log("Document groups:", Object.keys(documentGroups).map(name => ({
  //   name,
  //   chunks: documentGroups[name].map(c => ({
  //     chunkId: c.chunkId,
  //     chunkIndex: c.chunkIndex,
  //     hasContent: !!c.content,
  //     contentLength: c.content?.length || 0
  //   }))
  // })));

  // console.log("documentGroups", documentGroups)

  return (
    <Paper sx={{ 
      mt: 2, 
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'divider'
    }} elevation={0}>
      <Box sx={{ p: 1.5, pb: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          References
        </Typography>
        {isLoading && (
          <CircularProgress size={16} sx={{ ml: 1 }} />
        )}
      </Box>
      <Divider />
      
      {Object.entries(documentGroups).map(([docName, chunks], docIndex) => (
        <Accordion 
          key={docIndex} 
          expanded={expanded === docIndex}
          onChange={handleChange(docIndex)}
          sx={{ 
            '&:not(:last-child)': {
              borderBottom: '1px solid',
              borderBottomColor: 'divider'
            }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box className="document-header">
              <ArticleIcon fontSize="small" className="doc-icon" />
              <Typography variant="body2" className="doc-name">
                {docName}
              </Typography>
              <Chip 
                label={`${chunks.length} ${chunks.length === 1 ? 'chunk' : 'chunks'}`} 
                size="small" 
                className="chunk-count"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {chunks.map((chunk, chunkIndex) => (
              <Box key={chunkIndex} className="chunk-container">
                <Box className="chunk-header">
                  <Typography variant="caption" color="textSecondary" style={{ display: "inline-block", whiteSpace: "pre-line", wordBreak: "break-word" }}>
                    {chunk.chunkIndex !== undefined 
                      ? `Chunk ${chunk.chunkIndex + 1}` 
                      : `Chunk ${chunkIndex + 1}`} • Similarity: {(chunk.similarity * 100).toFixed(1)}%
                  </Typography>
                </Box>
                <Box className="chunk-content">
                  {!chunk.content && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {isLoading ? "Loading content..." : "Content not available"}
                    </Typography>
                  )}
                  {chunk.content && (
                    <Typography variant="body2">
                      {chunk.content}
                    </Typography>
                  )}
                </Box>
                <Box className="chunk-relevance">
                  <Typography variant="caption" color="textSecondary">
                    Relevance: {chunk.similarity > 0.9 ? 'Very High' : 
                               chunk.similarity > 0.8 ? 'High' : 
                               chunk.similarity > 0.7 ? 'Medium' : 'Low'}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={chunk.similarity * 100} 
                    sx={{ 
                      height: 4, 
                      width: '100px', 
                      borderRadius: 2,
                      bgcolor: 'rgba(0,0,0,0.1)'
                    }}
                  />
                </Box>
                {chunkIndex < chunks.length - 1 && <Divider className="chunk-divider" />}
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}; 