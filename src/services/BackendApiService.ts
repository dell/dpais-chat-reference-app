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

// Types for the backend API responses
interface VectorStore {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  tags: string[];
}

interface DocumentMetadata {
  documentId: string;
  documentName: string;
  chunkId: string;
  chunkIndex?: number;
  tags?: string[];
}

interface DocumentResponse {
  content: string;
  metadata: DocumentMetadata;
  source_id: string;
  source_name: string;
  source_type: string;
  similarity: number;
}

// BackendApiService class for interacting with the backend vector store API
export class BackendApiService {
  private baseUrl: string;
  
  constructor() {
    // Get settings from localStorage
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    this.baseUrl = settings.backendApiUrl || 'http://localhost:8000';
    console.log(`Backend API Service initialized with URL: ${this.baseUrl}`);
  }
  
  // Update the base URL when settings change
  updateBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
    console.log(`Backend API URL updated to: ${this.baseUrl}`);
  }
  
  // Check connection to the backend API
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to backend API v${data.version}`
        };
      } else {
        return {
          success: false,
          message: `Backend API error: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      console.error('Error connecting to backend API:', error);
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  // Get list of available vector stores
  async getVectorStores(): Promise<VectorStore[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vector-stores`);
      
      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching vector stores:', error);
      return [];
    }
  }
  
  // Get list of available collections
  async getCollections(): Promise<Collection[]> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`);
      
      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  }
  
  // Search for documents
  async searchDocuments(
    query: string,
    options?: {
      k?: number;
      backendIds?: string[];
      collectionIds?: string[];
      tags?: string[];
    }
  ): Promise<Document[]> {
    try {
      const { k = 5, backendIds = [], collectionIds = [], tags = [] } = options || {};
      
      // Build URL with query parameters
      let url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&k=${k}`;
      
      // Add backend IDs
      backendIds.forEach(id => {
        url += `&backend_id=${encodeURIComponent(id)}`;
      });
      
      // Add collection IDs
      collectionIds.forEach(id => {
        url += `&collection_id=${encodeURIComponent(id)}`;
      });
      
      // Add tags
      tags.forEach(tag => {
        url += `&tag=${encodeURIComponent(tag)}`;
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Search API error: ${response.status} ${response.statusText}`);
      }
      
      const results: DocumentResponse[] = await response.json();
      
      // Convert to LangChain Document format
      return results.map(result => new Document({
        pageContent: result.content,
        metadata: {
          ...result.metadata,
          sourceId: result.source_id,
          sourceName: result.source_name,
          sourceType: result.source_type,
          similarity: result.similarity
        }
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }
  
  // Get available tags (unique across all collections)
  async getAvailableTags(): Promise<string[]> {
    try {
      const collections = await this.getCollections();
      
      // Extract unique tags from all collections
      const allTags = new Set<string>();
      collections.forEach(collection => {
        collection.tags.forEach(tag => allTags.add(tag));
      });
      
      return Array.from(allTags);
    } catch (error) {
      console.error('Error fetching available tags:', error);
      return [];
    }
  }
}

// Create a singleton instance
export const backendApiService = new BackendApiService(); 