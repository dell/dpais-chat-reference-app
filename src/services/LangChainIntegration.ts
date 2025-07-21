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

import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { getDB } from '../db/db';
import { DocumentChunkDocType } from '../db/types';
import { createEmbedding, calculateCosineSimilarity } from '../db/vectorStore';
import { v4 as uuidv4 } from 'uuid';
import { OpenAIEmbeddings } from "@langchain/openai";

// Add this import to access the special interface for RxDBVectorStore
// and augment the VectorStore interface to include setFilterTags method
declare module '@langchain/core/vectorstores' {
  interface VectorStore {
    setFilterTags?: (tags: string[]) => void;
    setDocumentIds?: (documentIds: string[]) => void;
  }
}

// Fix the type errors in existing vector store code by expanding interface
interface ExtendedVectorStore extends VectorStore {
  setFilterTags(tags: string[]): void;
  setDocumentIds(documentIds: string[]): void;
}

/**
 * Utility function to add prefix for Nomic models if needed
 */
export function formatTextForEmbedding(text: string, type: 'query' | 'document' | 'clustering' | 'classification', modelName?: string): string {
  // If model name contains "nomic", add appropriate prefix
  if (modelName && modelName.toLowerCase().includes('nomic')) {
    switch (type) {
      case 'query':
        // Avoid double-prefixing
        if (text.startsWith('search_query:')) return text;
        return `search_query: ${text}`;
      case 'document':
        if (text.startsWith('search_document:')) return text;
        return `search_document: ${text}`;
      case 'clustering':
        if (text.startsWith('clustering:')) return text;
        return `clustering: ${text}`;
      case 'classification':
        if (text.startsWith('classification:')) return text;
        return `classification: ${text}`;
      default:
        return text;
    }
  }
  
  // For other models, return the original text
  return text;
}

/**
 * RxDB Vector Store implementation for LangChain
 */
export class RxDBVectorStore extends VectorStore {
  private filterTags: string[] = [];
  private documentIds: string[] = [];
  public embeddings: Embeddings;
  private modelName?: string;

  constructor(embeddings: Embeddings, options?: { tags?: string[], documentIds?: string[], modelName?: string }) {
    super(embeddings, {});
    this.embeddings = embeddings;
    this.modelName = options?.modelName;
    
    if (options?.tags) {
      this.filterTags = options.tags;
    }
    if (options?.documentIds) {
      this.documentIds = options.documentIds;
    }
    
    // Try to extract model name from OpenAIEmbeddings instance
    if (!this.modelName && 'modelName' in this.embeddings) {
      this.modelName = (this.embeddings as any).modelName;
    }
  }

  /**
   * Get relevant documents based on a query
   */
  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    // Generate query embedding with prefix for Nomic models
    const formattedQuery = formatTextForEmbedding(query, 'query', this.modelName);
    const queryEmbedding = await this.embeddings.embedQuery(formattedQuery);
    
    // Get document chunks from RxDB
    const db = await getDB();
    console.log('Executing similarity search against RxDB document chunks...');
    let chunks = await db.documentChunks.find().exec();
    console.log(`Found ${chunks.length} total chunks in database`);
    
    // Process filter tags to separate document IDs and regular tags
    const docIds: string[] = [];
    const regularTags: string[] = [];
    
    // Extract document IDs from tags that start with 'doc:'
    this.filterTags.forEach(tag => {
      if (tag.startsWith('doc:')) {
        const docId = tag.substring(4); // Remove 'doc:' prefix
        if (docId && docId.trim() !== '') {
          docIds.push(docId);
          console.log(`Extracted document ID from tag: ${docId}`);
        } else {
          console.warn(`⚠️ Found empty document ID in tag: ${tag}`);
        }
      } else {
        regularTags.push(tag);
      }
    });
    
    // Combine explicitly specified document IDs with those extracted from tags
    const allDocIds = [...this.documentIds, ...docIds];
    
    console.log(`Total document filter criteria: ${allDocIds.length} document IDs, ${regularTags.length} regular tags`);
    
    // Apply document ID filtering first (highest priority)
    if (allDocIds.length > 0) {
      console.log(`Filtering by ${allDocIds.length} document IDs: [${allDocIds.join(', ')}]`);
      
      // Log a sample of document metadata for debugging
      if (chunks.length > 0) {
        const sampleDoc = chunks[0].toJSON();
        console.log('Sample document structure:', {
          id: sampleDoc.id,
          documentId: sampleDoc.documentId,
          metadata: sampleDoc.metadata
        });
      }
      
      chunks = chunks.filter(doc => {
        const match = allDocIds.includes(doc.documentId);
        if (match && allDocIds.length < 5) {
          console.log(`  ✅ Matched document ${doc.documentId} with content length: ${doc.content.length}`);
        }
        return match;
      });
      console.log(`After document ID filtering: ${chunks.length} chunks`);
    } 
    // Then apply regular tag filtering if needed
    else if (regularTags.length > 0) {
      console.log(`Filtering by ${regularTags.length} regular tags: [${regularTags.join(', ')}]`);
      chunks = chunks.filter(doc => {
        const docTags = doc.metadata.tags || [];
        // A chunk matches if it has ANY of the filter tags
        return regularTags.some(tag => docTags.includes(tag));
      });
      console.log(`After tag filtering: ${chunks.length} chunks`);
    }
    
    if (chunks.length === 0) {
      console.warn('No chunks found after filtering');
      return [];
    }
    
    // Calculate similarity with enhanced metadata
    const chunksWithSimilarity = chunks.map(doc => {
      const chunk = doc.toJSON() as DocumentChunkDocType;
      const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      return { 
        chunk, 
        similarity,
        // Add document name and section for better reference tracking
        metadata: {
          ...chunk.metadata,
          similarity
        }
      };
    });
    
    // Sort by similarity and take top k
    const topChunks = chunksWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    console.log(`Returning top ${topChunks.length} chunks by similarity`);
    
    // Convert to LangChain Document format with similarity score
    return topChunks.map(({ chunk, similarity }) => {
      // Create a clean version of metadata without duplicate fields
      const metadata = {
        ...chunk.metadata,
        documentId: chunk.documentId,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        similarity: similarity  // Include similarity in metadata
      };
      
      return new Document({
        pageContent: chunk.content,
        metadata
      });
    });
  }

  /**
   * Store documents in the vector store
   */
  async addDocuments(documents: Document[]): Promise<void> {
    // Format texts with proper prefix for Nomic models
    const texts = documents.map(doc => 
      formatTextForEmbedding(doc.pageContent, 'document', this.modelName)
    );
    
    const embeddings = await this.embeddings.embedDocuments(texts);
    
    const db = await getDB();
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = embeddings[i];
      
      const documentId = doc.metadata.documentId || uuidv4();
      
      // Create chunk document
      const chunk: DocumentChunkDocType = {
        id: uuidv4(),
        documentId,
        content: doc.pageContent,
        embedding,
        chunkIndex: doc.metadata.chunkIndex || 0,
        metadata: {
          documentName: doc.metadata.documentName || 'Unknown',
          documentType: doc.metadata.documentType || 'text/plain',
          tags: doc.metadata.tags || [],
          pageNumber: doc.metadata.pageNumber,
          section: doc.metadata.section
        }
      };
      
      // Insert into RxDB
      await db.documentChunks.insert(chunk);
    }
  }

  /**
   * Create a vector store from texts
   */
  static async fromTexts(
    texts: string[],
    metadatas: Record<string, any>[],
    embeddings: Embeddings,
    options?: { tags?: string[], modelName?: string }
  ): Promise<RxDBVectorStore> {
    const store = new RxDBVectorStore(embeddings, options);
    
    const documents = texts.map((text, i) => {
      return new Document({
        pageContent: text,
        metadata: metadatas[i] || {}
      });
    });
    
    await store.addDocuments(documents);
    return store;
  }

  /**
   * Create a vector store from existing documents in the database
   */
  static async fromExistingDocuments(
    embeddings: Embeddings,
    options?: { tags?: string[], documentIds?: string[], modelName?: string }
  ): Promise<RxDBVectorStore> {
    const store = new RxDBVectorStore(embeddings, options);
    return store;
  }

  /**
   * Set the filter tags for the vector store
   */
  setFilterTags(tags: string[]): void {
    this.filterTags = tags;
    console.log(`Set filter tags: [${tags.join(', ')}]`);
  }

  /**
   * Set the document IDs for filtering
   */
  setDocumentIds(documentIds: string[]): void {
    this.documentIds = documentIds;
    console.log(`Set document IDs: [${documentIds.join(', ')}]`);
  }

  _vectorstoreType(): string { return "rxdb"; }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    return this.addDocuments(documents);
  }

  async similaritySearchVectorWithScore(vector: number[], k: number): Promise<[Document, number][]> {
    const db = await getDB();
    let chunks = await db.documentChunks.find().exec();
    
    // Apply document ID filtering first (highest priority)
    if (this.documentIds.length > 0) {
      chunks = chunks.filter(doc => this.documentIds.includes(doc.documentId));
    } 
    // Then apply tag filtering if needed
    else if (this.filterTags.length > 0) {
      chunks = chunks.filter(doc => {
        const tags = doc.metadata.tags;
        return this.filterTags.some(tag => tags.includes(tag));
      });
    }
    
    // Calculate similarity
    const results = chunks.map(doc => {
      const chunk = doc.toJSON() as DocumentChunkDocType;
      const similarity = calculateCosineSimilarity(vector, chunk.embedding);
      return { 
        document: new Document({
          pageContent: chunk.content,
          metadata: {
            documentId: chunk.documentId,
            chunkIndex: chunk.chunkIndex,
            ...chunk.metadata
          }
        }), 
        similarity 
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
    
    return results.map(result => [result.document, result.similarity]);
  }
}

// Helper function to create embeddings using settings from localStorage
export function createOpenAIEmbeddings(): OpenAIEmbeddings {
  // Get API settings from localStorage
  const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
  const apiBaseUrl = settings.apiBaseUrl || 'http://localhost:8553/v1';
  const apiKey = settings.apiKey || '';
  const embeddingsModel = settings.embeddingsModel || 'nomic-embed-text';
  
  // Create instance with API settings
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: embeddingsModel, // Use the model from settings
    configuration: {
      baseURL: apiBaseUrl
    }
  });
  
  // Add a custom embedQuery method that adds prefixes for Nomic models
  const originalEmbedQuery = embeddings.embedQuery.bind(embeddings);
  embeddings.embedQuery = async (text: string): Promise<number[]> => {
    const formattedText = formatTextForEmbedding(text, 'query', embeddingsModel);
    return originalEmbedQuery(formattedText);
  };
  
  // Add a custom embedDocuments method that adds prefixes for Nomic models
  const originalEmbedDocuments = embeddings.embedDocuments.bind(embeddings);
  embeddings.embedDocuments = async (texts: string[]): Promise<number[][]> => {
    const formattedTexts = texts.map(text => 
      formatTextForEmbedding(text, 'document', embeddingsModel)
    );
    return originalEmbedDocuments(formattedTexts);
  };
  
  return embeddings;
} 