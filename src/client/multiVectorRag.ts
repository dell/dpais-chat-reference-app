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

import { Document } from '@langchain/core/documents';
import { DocumentReference } from '../db/types';
import { vectorDbService } from '../services/VectorDbService';
import { getDB } from '../db/db';
import { getSettings } from '../utils/settings';

// API endpoint for the backend server
const API_BASE_URL = 'http://localhost:8000';

/**
 * MultiVectorRAG provides methods for retrieving and formatting documents
 * from multiple vector stores for RAG applications.
 */
export class MultiVectorRAG {
  /**
   * Get relevant documents from multiple vector stores based on a query
   */
  static async getRelevantDocuments(
    query: string,
    sessionId: string,
    maxDocuments: number = 5
  ): Promise<Document[]> {
    console.log('===== MULTIVECTOR RAG - GET RELEVANT DOCUMENTS =====');
    console.log(`Query: "${query}"`);
    console.log(`Session ID: "${sessionId}"`);
    console.log(`Max documents: ${maxDocuments}`);
    
    try {
      const db = await getDB();
      const session = await db.sessions.findOne({ selector: { sessionId } }).exec();
      
      if (!session) {
        console.log('Session not found');
        return [];
      }
      
      const documentTags = session.documentTags || [];
      if (documentTags.length === 0) {
        console.log('No document tags in session');
        return [];
      }
      
      // Get settings
      const settings = getSettings();
      const backendApiUrl = settings.backendApiUrl || 'http://localhost:8000';
      
      console.log('Getting relevant documents with settings:', {
        backendApiUrl,
        query,
        sessionId,
        documentTags,
        maxDocuments
      });
      
      // Process the tags - extract plain tags, backend IDs, and collection IDs
      const plainTags: string[] = [];
      const backendIds: string[] = [];
      const collectionIds: string[] = [];
      const documentIdTags: string[] = [];
      
      // Track if we have any company document sources (backend/collection tags)
      let hasCompanyDocumentSources = false;
      
      console.log('Processing tags...');
      // Reset hasCompanyDocumentSources flag - will be set to true only if we find actual backend/collection tags
      hasCompanyDocumentSources = false;
      
      documentTags.forEach(tag => {
        console.log(`Processing tag: "${tag}"`);
        
        if (tag.startsWith('backend:')) {
          // Format: backend:backendId or backend:backendId:tag1,tag2,tag3
          const parts = tag.split(':');
          console.log(`Backend tag parts:`, parts);
          
          if (parts.length > 1) {
            backendIds.push(parts[1]);
            console.log(`Added backend ID: ${parts[1]}`);
            hasCompanyDocumentSources = true;
            
            // If there are specified tags, add them
            if (parts.length > 2 && parts[2]) {
              const tagsList = parts[2].split(',');
              console.log(`Found nested tags in backend: ${tagsList}`);
              plainTags.push(...tagsList);
            }
          }
        } else if (tag.startsWith('collection:')) {
          // Format: collection:collectionId or collection:collectionId:tag1,tag2,tag3
          const parts = tag.split(':');
          console.log(`Collection tag parts:`, parts);
          
          if (parts.length > 1) {
            collectionIds.push(parts[1]);
            console.log(`Added collection ID: ${parts[1]}`);
            hasCompanyDocumentSources = true;
            
            // If there are specified tags, add them
            if (parts.length > 2 && parts[2]) {
              const tagsList = parts[2].split(',');
              console.log(`Found nested tags in collection: ${tagsList}`);
              plainTags.push(...tagsList);
            }
          }
        } else if (tag.startsWith('doc:')) {
          // This is a document ID tag
          console.log(`Found document ID tag: ${tag}`);
          documentIdTags.push(tag);
          plainTags.push(tag); // Include with plain tags for local vector search
        } else {
          // Plain tag - only used for local vector store
          console.log(`Added plain tag: ${tag}`);
          plainTags.push(tag);
        }
      });
      
      console.log('===== TAG PROCESSING RESULTS =====');
      console.log('Plain tags:', plainTags);
      console.log('Document ID tags:', documentIdTags);
      console.log('Backend IDs:', backendIds);
      console.log('Collection IDs:', collectionIds);
      console.log('Has company document sources:', hasCompanyDocumentSources);
      
      // COMPANY DOCUMENTS FLOW - Use backend API
      if (hasCompanyDocumentSources && (backendIds.length > 0 || collectionIds.length > 0)) {
        console.log('===== USING COMPANY DOCUMENTS FLOW (BACKEND API) =====');
        
        try {
          console.log('Creating backend search request...');
          const backendDocs = await this.getDocumentsFromBackend(
            query, 
            maxDocuments, 
            {
              backendIds,
              collectionIds,
              tags: plainTags
            }
          );
          
          if (backendDocs.length > 0) {
            console.log(`✅ SUCCESS: Found ${backendDocs.length} documents from backend API`);
            
            // Log preview of first document
            if (backendDocs.length > 0) {
              const firstDoc = backendDocs[0];
              console.log('First document preview:', {
                content: firstDoc.pageContent.substring(0, 100) + '...',
                metadata: firstDoc.metadata
              });
            }
            
            return backendDocs;
          } else {
            console.warn('⚠️ Backend API returned no documents');
            // Do NOT fall back to local vector store for company documents
            // Instead, return empty results
            return [];
          }
        } catch (error) {
          console.error('⚠️ Error fetching from backend API:', error);
          // Do NOT fall back to local vector store for company documents
          return [];
        }
      } 
      // LOCAL DOCUMENTS FLOW - Use local vector store
      else if (plainTags.length > 0) {
        console.log('===== USING LOCAL DOCUMENTS FLOW (RXDB VECTOR STORE) =====');
        console.log(`Using ${plainTags.length} plain tags for local vector store search:`);
        console.log('Tags:', plainTags);
        
        try {
          console.log('Searching local vector store with tags:', plainTags);
          const localDocs = await vectorDbService.similaritySearch(query, { tags: plainTags, k: maxDocuments });
          console.log(`Found ${localDocs.length} documents from local vector store`);
          
          if (localDocs.length > 0) {
            // Log preview of first document
            const firstDoc = localDocs[0];
            console.log('First document preview:', {
              content: firstDoc.pageContent.substring(0, 100) + '...',
              metadata: firstDoc.metadata
            });
          } else {
            console.warn('⚠️ No documents found in local vector store with tags:', plainTags);
          }
          
          return localDocs;
        } catch (error) {
          console.error('⚠️ Error searching local vector store:', error);
          return [];
        }
      } else {
        console.warn('⚠️ No valid tags available for vector search');
        return [];
      }
    } catch (error) {
      console.error('⚠️ Error in getRelevantDocuments:', error);
      return [];
    }
  }
  
  /**
   * Get documents from the backend API
   */
  public static async getDocumentsFromBackend(
    query: string,
    k: number,
    filters: {
      backendIds?: string[],
      collectionIds?: string[],
      tags?: string[]
    }
  ): Promise<Document[]> {
    console.log('===== GET DOCUMENTS FROM BACKEND =====');
    
    // Get settings to check if we have a custom API URL
    const settings = getSettings();
    const backendApiUrl = settings.backendApiUrl || API_BASE_URL;
    
    console.log('Using backend API URL:', backendApiUrl);
    
    // Build the search URL with query parameters
    let searchUrl = `${backendApiUrl}/search?query=${encodeURIComponent(query)}&k=${k}`;
    
    // Add backend IDs if available
    if (filters.backendIds && filters.backendIds.length > 0) {
      filters.backendIds.forEach(id => {
        searchUrl += `&backend_id=${encodeURIComponent(id)}`;
      });
      console.log(`Added ${filters.backendIds.length} backend IDs to query`);
    }
    
    // Add collection IDs if available
    if (filters.collectionIds && filters.collectionIds.length > 0) {
      filters.collectionIds.forEach(id => {
        searchUrl += `&collection_id=${encodeURIComponent(id)}`;
      });
      console.log(`Added ${filters.collectionIds.length} collection IDs to query`);
    }
    
    // Add tags if available
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => {
        searchUrl += `&tag=${encodeURIComponent(tag)}`;
      });
      console.log(`Added ${filters.tags.length} tags to query`);
    }
    
    console.log('Making API request to:', searchUrl);
    
    try {
      // Fetch documents from the backend
      console.log('Sending fetch request...');
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend API error response:', errorText);
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }
      
      console.log('Got successful response from backend API');
      const results = await response.json();
      console.log(`Received ${results.length} results from backend`);
      
      if (results.length > 0) {
        // Log first result for debugging
        console.log('First result preview:', {
          content: results[0].content.substring(0, 100) + '...',
          metadata: results[0].metadata,
          source: results[0].source_name
        });
      }
      
      // Convert API results to LangChain Document format
      return results.map((result: any) => {
        return new Document({
          pageContent: result.content,
          metadata: {
            ...result.metadata,
            sourceId: result.source_id,
            sourceName: result.source_name,
            sourceType: result.source_type,
            similarity: result.similarity
          }
        });
      });
    } catch (error) {
      console.error('⚠️ Error in backend API request:', error);
      throw error;
    }
  }
  
  /**
   * Test method for verification of the API search implementation
   * This can be run from browser environment to ensure proper functionality
   */
  public static async testBackendSearch(
    query: string = 'test query',
    backendIds: string[] = [],
    collectionIds: string[] = [],
    tags: string[] = []
  ): Promise<Document[]> {
    console.log('===== TEST BACKEND SEARCH =====');
    console.log(`Query: "${query}"`);
    console.log('Backend IDs:', backendIds);
    console.log('Collection IDs:', collectionIds);
    console.log('Tags:', tags);
    
    try {
      const results = await this.getDocumentsFromBackend(query, 5, {
        backendIds,
        collectionIds,
        tags
      });
      
      console.log(`Retrieved ${results.length} documents from backend`);
      if (results.length > 0) {
        console.log('First document:', {
          content: results[0].pageContent.substring(0, 100) + '...',
          metadata: results[0].metadata
        });
      }
      
      return results;
    } catch (error) {
      console.error('Test failed with error:', error);
      return [];
    }
  }
  
  /**
   * Create document references for UI display from retrieved documents
   */
  static createDocumentReferences(docs: Document[]): DocumentReference[] {
    return docs.map(doc => {
      const metadata = doc.metadata;
      return {
        documentId: metadata.documentId || 'unknown',
        documentName: metadata.documentName || 'Unknown Document',
        chunkId: metadata.chunkId || 'unknown',
        similarity: metadata.similarity || 0,
        sourceType: metadata.sourceType || metadata.sourceId,
        chunkIndex: metadata.chunkIndex,
        content: doc.pageContent
      };
    });
  }

  /**
   * Format documents for inclusion in the prompt
   */
  static formatDocumentsForPrompt(docs: Document[]): string {
    return docs.map((doc, index) => {
      const metadata = doc.metadata;
      const documentName = metadata.documentName || 'Unknown Document';
      const pageInfo = metadata.pageNumber ? `[Page ${metadata.pageNumber}]` : '';
      const sectionInfo = metadata.section ? `[Section: ${metadata.section}]` : '';
      const infoText = [pageInfo, sectionInfo].filter(Boolean).join(' ');
      
      return `=== DOCUMENT ${index + 1}: ${documentName} ${infoText} ===\n${doc.pageContent}\n`;
    }).join('\n\n');
  }
  
  /**
   * Generate a system message with document context
   */
  static generateSystemMessage(
    baseSystemPrompt: string,
    documentText: string,
    strictMode: boolean = false,
    showSources: boolean = true
  ): { role: string, content: string } {
    let systemMessage = `${baseSystemPrompt}\n\n`;
    
    if (strictMode) {
      systemMessage += 'IMPORTANT: Only use the information from the provided documents to answer the question. If the documents do not contain the answer, say "I don\'t have enough information to answer this question."\n\n';
    }
    
    systemMessage += 'Here are the relevant documents to help answer the user\'s question:\n\n';
    systemMessage += documentText;
    
    if (showSources) {
      // Try to extract a real document name from the document text
      let exampleDocName = "Document Name";
      try {
        // Look for the first document header pattern in the text
        const docMatch = documentText.match(/===\s*DOCUMENT\s+1:\s+([^[]+)/i);
        if (docMatch && docMatch[1]) {
          exampleDocName = docMatch[1].trim();
        }
      } catch (e) {
        // If there's any error, fall back to the generic name
        console.log("Error extracting document name for example:", e);
      }
      
      systemMessage += `\n\nWhen answering, always cite the document source you used (e.g., "According to the Document [${exampleDocName}]..."). Include both the document number and name in your citations. Your answer should synthesize information from the provided documents.`;
    }

    // Normalize systemMessage to UTF-8
    // The TextEncoder ensures proper UTF-8 encoding, then we decode it back to a string
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const encodedMessage = encoder.encode(systemMessage);
    const normalizedMessage = decoder.decode(encodedMessage);
    // Print each character's hex value
    console.log('=== Normalized Message Hex Values ===');
    for (let i = 0; i < normalizedMessage.length; i++) {
      const char = normalizedMessage.charAt(i);
      const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
      console.log(`Character '${char}' -> 0x${hex}`);
    }
    
    return { role: 'system', content: normalizedMessage };
  }
} 