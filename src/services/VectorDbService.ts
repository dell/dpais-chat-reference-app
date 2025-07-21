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

import { 
  VectorDbConfig, 
  VectorDbConnection,
  MilvusConfig,
  QdrantConfig,
  WeaviateConfig, 
  ChromaConfig,
  PGVectorConfig,
  PineconeConfig
} from '../types/vectorDb';
import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { v4 as uuidv4 } from 'uuid';
import { createOpenAIEmbeddings, formatTextForEmbedding, RxDBVectorStore } from '../services/LangChainIntegration';

// LangChain vector store types
interface MilvusStoreType {
  new(embeddings: Embeddings, options: {
    url?: string;
    port?: number;
    username?: string;
    password?: string;
    collectionName: string;
    [key: string]: any;
  }): VectorStore;
}

interface QdrantStoreType {
  new(embeddings: Embeddings, options: {
    url: string;
    apiKey?: string;
    collectionName: string;
    [key: string]: any;
  }): VectorStore;
  fromExistingCollection(
    embeddings: Embeddings,
    options: { 
      url: string;
      apiKey?: string;
      collectionName: string;
      [key: string]: any;
    }
  ): Promise<VectorStore>;
}

interface WeaviateStoreType {
  fromExistingIndex(
    embeddings: Embeddings, 
    options: {
      client: any;
      indexName: string;
      textKey: string;
      [key: string]: any;
    }
  ): VectorStore;
}

interface ChromaStoreType {
  new(embeddings: Embeddings, options: {
    url: string;
    collectionName: string;
    [key: string]: any;
  }): VectorStore;
}

interface PGVectorStoreType {
  initialize(
    embeddings: Embeddings,
    options: {
      postgresConnectionOptions: {
        connectionString: string;
        [key: string]: any;
      };
      tableName: string;
      queryName?: string;
      [key: string]: any;
    }
  ): Promise<VectorStore>;
}

interface PineconeStoreType {
  fromExistingIndex(
    embeddings: Embeddings,
    options: {
      pineconeIndex: any;
      namespace?: string;
      [key: string]: any;
    }
  ): VectorStore;
}

// Vector store module references
let MilvusStore: MilvusStoreType | null = null;
let QdrantVectorStore: QdrantStoreType | null = null;
let WeaviateStore: WeaviateStoreType | null = null;
let ChromaStore: ChromaStoreType | null = null;
let PGVectorStore: PGVectorStoreType | null = null;
let PineconeStore: PineconeStoreType | null = null;

// Lazy load the vector stores to avoid bundling all at once
async function importVectorStores() {
  // Only import what we need when we need it
  try {
    try {
      // Milvus integration
      const milvus = await import('@langchain/community/vectorstores/milvus');
      MilvusStore = milvus.Milvus as unknown as MilvusStoreType;
      console.log('Milvus module loaded successfully');
    } catch (e) {
      console.warn('Failed to import Milvus:', e);
    }

    try {
      // Qdrant integration
      const qdrant = await import('@langchain/community/vectorstores/qdrant');
      QdrantVectorStore = qdrant.QdrantVectorStore as unknown as QdrantStoreType;
      console.log('Qdrant module loaded successfully');
    } catch (e) {
      console.warn('Failed to import Qdrant:', e);
    }

    try {
      // Weaviate integration
      const weaviate = await import('@langchain/weaviate');
      WeaviateStore = weaviate.WeaviateStore as unknown as WeaviateStoreType;
      console.log('Weaviate module loaded successfully');
    } catch (e) {
      console.warn('Failed to import Weaviate:', e);
    }

    // Chroma integration is disabled due to compatibility issues
    console.warn('Chroma integration is disabled due to compatibility issues');
    ChromaStore = null;

    try {
      // PGVector integration
      const pgvector = await import("@langchain/community/vectorstores/pgvector");
      PGVectorStore = pgvector.PGVectorStore as unknown as PGVectorStoreType;
      console.log('PGVector module loaded successfully');
    } catch (e) {
      console.warn('Failed to import PGVector:', e);
    }

    try {
      // Pinecone integration
      const pinecone = await import('@langchain/pinecone');
      PineconeStore = pinecone.PineconeStore as unknown as PineconeStoreType;
      console.log('Pinecone module loaded successfully');
    } catch (e) {
      console.warn('Failed to import Pinecone:', e);
    }
    
    console.log('Vector store modules imported successfully');
  } catch (error) {
    console.error('Error importing vector store modules:', error);
  }
}

// Add this import to access the special interface for RxDBVectorStore
// and augment the VectorStore interface to include setFilterTags method
declare module '@langchain/core/vectorstores' {
  interface VectorStore {
    setFilterTags?: (tags: string[]) => void;
  }
}

// Fix the type errors in existing vector store code by expanding interface
interface ExtendedVectorStore extends VectorStore {
  setFilterTags?: (tags: string[]) => void;
}

class VectorDbService {
  private connections: VectorDbConnection[] = [];
  private isInitialized = false;
  private embeddings: Embeddings | null = null;
  private localVectorStore: VectorStore | null = null;

  constructor() {
    this.loadConfigurations();
  }

  /**
   * Initialize the service by loading vector store modules
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await importVectorStores();
      this.embeddings = createOpenAIEmbeddings();
      this.isInitialized = true;
    }
  }

  /**
   * Load vector database configurations from localStorage
   */
  private loadConfigurations(): void {
    const savedConfigs = localStorage.getItem('vectorDbConfigs');
    
    if (savedConfigs) {
      try {
        const configs = JSON.parse(savedConfigs) as VectorDbConfig[];
        this.connections = configs.map(config => ({ config }));
      } catch (error) {
        console.error('Error loading vector database configurations:', error);
      }
    }
  }
  
  /**
   * Save vector database configurations to localStorage
   */
  private saveConfigurations(): void {
    const configs = this.connections.map(conn => conn.config);
    localStorage.setItem('vectorDbConfigs', JSON.stringify(configs));
  }

  /**
   * Get all vector database configurations
   */
  getConfigurations(): VectorDbConfig[] {
    return this.connections.map(conn => conn.config);
  }

  /**
   * Add a new vector database configuration
   */
  addConfiguration<T extends VectorDbConfig>(config: Omit<T, 'id'>): T {
    const newConfig = {
      ...config,
      id: uuidv4()
    } as T;
    
    this.connections.push({
      config: newConfig
    });
    
    this.saveConfigurations();
    return newConfig;
  }

  /**
   * Update an existing vector database configuration
   */
  updateConfiguration(id: string, updates: Partial<VectorDbConfig>): boolean {
    const index = this.connections.findIndex(conn => conn.config.id === id);
    
    if (index !== -1) {
      // Create a type-safe update based on the current configuration type
      const currentConfig = this.connections[index].config;
      const updatedConfig = {
        ...currentConfig,
        ...updates
      } as VectorDbConfig;
      
      this.connections[index].config = updatedConfig;
      
      // Clear the vector store instance if we're updating the configuration
      if (this.connections[index].vectorStore) {
        this.connections[index].vectorStore = undefined;
      }
      
      this.saveConfigurations();
      return true;
    }
    
    return false;
  }

  /**
   * Delete a vector database configuration
   */
  deleteConfiguration(id: string): boolean {
    const initialLength = this.connections.length;
    this.connections = this.connections.filter(conn => conn.config.id !== id);
    
    if (this.connections.length !== initialLength) {
      this.saveConfigurations();
      return true;
    }
    
    return false;
  }

  /**
   * Get a vector store instance for a specific configuration
   */
  async getVectorStore(configId: string): Promise<VectorStore | null> {
    const connection = this.connections.find(conn => conn.config.id === configId);
    
    if (!connection) {
      return null;
    }
    
    // If we already have an instantiated vector store, return it
    if (connection.vectorStore) {
      return connection.vectorStore;
    }
    
    // Otherwise, create a new vector store based on the configuration
    try {
      // Make sure we have initialized
      await this.initialize();
      
      if (!this.embeddings) {
        this.embeddings = createOpenAIEmbeddings();
      }
      
      const config = connection.config;
      let vectorStore: VectorStore | null = null;
      
      switch (config.type) {
        case 'milvus':
          vectorStore = await this.createMilvusStore(config as MilvusConfig, this.embeddings);
          break;
        case 'qdrant':
          vectorStore = await this.createQdrantStore(config as QdrantConfig, this.embeddings);
          break;
        case 'weaviate':
          vectorStore = await this.createWeaviateStore(config as WeaviateConfig, this.embeddings);
          break;
        case 'chroma':
          vectorStore = await this.createChromaStore(config as ChromaConfig, this.embeddings);
          break;
        case 'pgvector':
          vectorStore = await this.createPGVectorStore(config as PGVectorConfig, this.embeddings);
          break;
        case 'pinecone':
          vectorStore = await this.createPineconeStore(config as PineconeConfig, this.embeddings);
          break;
        default:
          throw new Error(`Unsupported vector store type: ${config.type}`);
      }
      
      // Store the vector store in the connection for future use
      if (vectorStore) {
        connection.vectorStore = vectorStore;
      }
      
      return vectorStore;
    } catch (error) {
      console.error(`Error creating vector store for ${connection.config.name}:`, error);
      return null;
    }
  }

  /**
   * Perform a similarity search across all enabled vector stores
   */
  async similaritySearchAcross(
    query: string, 
    filter?: { configIds?: string[], tags?: string[] },
    k: number = 5
  ): Promise<Document[]> {
    // Make sure we've initialized
    await this.initialize();
    
    // Get settings to check for Nomic model
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    const embeddingsModel = settings.embeddingsModel || 'nomic-embed-text';
    
    // Filter connections based on provided filter, or use all enabled connections
    let filteredConnections = this.connections.filter(conn => conn.config.enabled);
    
    // Filter by config IDs if provided
    if (filter?.configIds && filter.configIds.length > 0) {
      filteredConnections = filteredConnections.filter(conn => 
        filter.configIds!.includes(conn.config.id)
      );
    }
    
    // Parse session tags to find vector DB specific filters
    // Format: vdb:dbId:tag1,tag2,tag3
    if (filter?.configIds) {
      const dbWithTags: Record<string, string[]> = {};
      
      // Check if any of the configIds are actually in the format dbId:tag1,tag2
      const updatedConfigIds: string[] = [];
      
      filter.configIds.forEach(id => {
        if (id.includes(':')) {
          // This is a vector DB with tag filter
          const [dbId, tagList] = id.split(':');
          const tags = tagList.split(',');
          dbWithTags[dbId] = tags;
          updatedConfigIds.push(dbId);
        } else {
          updatedConfigIds.push(id);
        }
      });
      
      // Update the filter with the cleaned IDs
      filter.configIds = updatedConfigIds;
      
      // Apply per-database tag filtering
      filteredConnections = filteredConnections.filter(conn => {
        // If this DB has specific tag filters, apply them
        if (dbWithTags[conn.config.id]) {
          const connTags = conn.config.tags || [];
          const requiredTags = dbWithTags[conn.config.id];
          
          // Must have at least one of the specified tags
          return requiredTags.some(tag => connTags.includes(tag));
        }
        
        // Otherwise, include if it matches the config ID
        return filter.configIds!.includes(conn.config.id);
      });
    }
    
    // Apply global tag filtering if provided
    if (filter?.tags && filter.tags.length > 0) {
      filteredConnections = filteredConnections.filter(conn => {
        const connTags = conn.config.tags || [];
        return filter.tags!.some(tag => connTags.includes(tag));
      });
    }
    
    // No enabled connections found
    if (filteredConnections.length === 0) {
      return [];
    }
    
    // Perform similarity search on each connection
    const searchPromises = filteredConnections.map(async (conn) => {
      try {
        // Get or create the vector store
        const vectorStore = await this.getVectorStore(conn.config.id);
        
        if (!vectorStore) {
          return [] as Document[];
        }
        
        // Perform similarity search
        // Note: vectorStore.similaritySearch will handle formatting for Nomic models
        // because we patched the embeddings instance in createOpenAIEmbeddings
        const docs = await vectorStore.similaritySearch(query, k);
        
        // Add source info to each document
        return docs.map(doc => {
          // Include the connection info in metadata
          const docWithSource = new Document({
            pageContent: doc.pageContent,
            metadata: {
              ...doc.metadata,
              sourceId: conn.config.id,
              sourceName: conn.config.name,
              sourceType: conn.config.type,
              // If there's a similarity score, preserve it
              similarity: doc.metadata.similarity || 0
            }
          });
          
          return docWithSource;
        });
      } catch (error) {
        console.error(`Error searching ${conn.config.name}:`, error);
        return [] as Document[];
      }
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Combine results from all sources
    const allDocs = results.flat();
    
    // Sort by similarity if available and take top k
    return allDocs.sort((a, b) => {
      const simA = a.metadata.similarity as number || 0;
      const simB = b.metadata.similarity as number || 0;
      return simB - simA;
    }).slice(0, k);
  }

  /**
   * Test a connection to a vector database
   */
  async testConnection(config: VectorDbConfig): Promise<{ success: boolean, message: string }> {
    try {
      await this.initialize();
      
      if (!this.embeddings) {
        this.embeddings = createOpenAIEmbeddings();
      }
      
      // Get settings to check for Nomic model
      const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
      const embeddingsModel = settings.embeddingsModel || 'nomic-embed-text';
      
      // Create a temporary vector store to test the connection
      let vectorStore: VectorStore | null = null;
      
      switch (config.type) {
        case 'milvus':
          vectorStore = await this.createMilvusStore(config as MilvusConfig, this.embeddings);
          break;
        case 'qdrant':
          vectorStore = await this.createQdrantStore(config as QdrantConfig, this.embeddings);
          break;
        case 'weaviate':
          vectorStore = await this.createWeaviateStore(config as WeaviateConfig, this.embeddings);
          break;
        case 'chroma':
          vectorStore = await this.createChromaStore(config as ChromaConfig, this.embeddings);
          break;
        case 'pgvector':
          vectorStore = await this.createPGVectorStore(config as PGVectorConfig, this.embeddings);
          break;
        case 'pinecone':
          vectorStore = await this.createPineconeStore(config as PineconeConfig, this.embeddings);
          break;
        default:
          throw new Error(`Unsupported vector store type: ${config.type}`);
      }
      
      // Perform a simple search to test the connection
      if (vectorStore) {
        // Use a test query with appropriate prefix for Nomic models
        const testQuery = 'test connection';
        await vectorStore.similaritySearch(testQuery, 1);
        return { success: true, message: 'Connection successful!' };
      } else {
        return { success: false, message: 'Failed to create vector store.' };
      }
    } catch (error) {
      console.error(`Error testing connection to ${config.name}:`, error);
      return { 
        success: false, 
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Helper methods to create specific vector stores
  
  private async createMilvusStore(config: MilvusConfig, embeddings: Embeddings): Promise<VectorStore> {
    if (!MilvusStore) {
      throw new Error('Milvus module not loaded');
    }
    
    // Create Milvus store with proper configuration
    return new MilvusStore(embeddings, {
      url: config.url,
      port: config.port,
      username: config.username,
      password: config.password,
      collectionName: config.collection
    });
  }
  
  private async createQdrantStore(config: QdrantConfig, embeddings: Embeddings): Promise<VectorStore> {
    if (!QdrantVectorStore) {
      throw new Error('Qdrant module not loaded');
    }
    
    // Use fromExistingCollection to connect to an existing collection
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: config.url,
      apiKey: config.apiKey,
      collectionName: config.collection
    });
  }
  
  private async createWeaviateStore(config: WeaviateConfig, embeddings: Embeddings): Promise<VectorStore> {
    if (!WeaviateStore) {
      throw new Error('Weaviate module not loaded');
    }
    
    // Import weaviate-ts-client dynamically
    const { default: weaviate } = await import('weaviate-ts-client');
    
    // Create Weaviate client
    const client = weaviate.client({
      scheme: config.url.startsWith('https') ? 'https' : 'http',
      host: config.url.replace(/^https?:\/\//, ''),
      apiKey: config.apiKey ? { value: config.apiKey } : undefined
    });
    
    // Create Weaviate store from existing index
    return WeaviateStore.fromExistingIndex(embeddings, {
      client,
      indexName: config.className,
      textKey: 'text'
    });
  }
  
  private async createChromaStore(config: ChromaConfig, embeddings: Embeddings): Promise<VectorStore> {
    // Chroma is disabled due to compatibility issues
    throw new Error('Chroma DB is disabled due to compatibility issues. Please use a different vector database.');
  }
  
  private async createPGVectorStore(config: PGVectorConfig, embeddings: Embeddings): Promise<VectorStore> {
    // In browser environments, we need special handling for pg which is not fully browser-compatible
    const isBrowser = typeof window !== 'undefined';
    
    if (!PGVectorStore) {
      // Try to import again if not loaded previously
      try {
        // Use dynamic import with a more specific error handler for browser environments
        const pgvector = await import("@langchain/community/vectorstores/pgvector");
        PGVectorStore = pgvector.PGVectorStore as unknown as PGVectorStoreType;
      } catch (e) {
        console.error("Failed to import PGVector on demand:", e);
        if (isBrowser) {
          console.warn("PGVector has limited browser support due to Node.js dependencies. Consider using a different vector store for browser environments.");
        }
        throw new Error('PGVector module not loaded: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
    
    // Initialize PGVector with connection string and table name
    try {
      return await PGVectorStore.initialize(embeddings, {
        postgresConnectionOptions: {
          connectionString: config.connectionString
        },
        tableName: config.tableName,
        queryName: config.queryName
      });
    } catch (error) {
      console.error("Error initializing PGVector:", error);
      throw new Error('Failed to initialize PGVector: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  private async createPineconeStore(config: PineconeConfig, embeddings: Embeddings): Promise<VectorStore> {
    if (!PineconeStore) {
      throw new Error('Pinecone module not loaded');
    }
    
    // Import Pinecone client dynamically
    const { Pinecone } = await import('@pinecone-database/pinecone');
    
    // Create Pinecone client instance
    const pinecone = new Pinecone({
      apiKey: config.apiKey,
      environment: config.environment
    });
    
    // Get Pinecone index
    const pineconeIndex = pinecone.Index(config.index);
    
    // Create Pinecone store from existing index
    return PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: config.namespace
    });
  }

  /**
   * Perform similarity search on the local vector store
   */
  async similaritySearch(
    query: string, 
    options?: { tags?: string[], k?: number }
  ): Promise<Document[]> {
    try {
      console.log('Performing local similarity search with options:', options);
      
      if (!this.localVectorStore) {
        console.log('Local vector store not initialized yet, initializing now...');
        await this.ensureLocalVectorStore();
      }
      
      if (!this.localVectorStore) {
        console.error('❌ Failed to initialize local vector store for search');
        return [];
      }
      
      // Check if any tags are document IDs (doc:xxx format)
      const tags = options?.tags || [];
      const documentIds: string[] = [];
      const regularTags: string[] = [];
      
      // Process tags to extract document IDs
      tags.forEach(tag => {
        if (tag.startsWith('doc:')) {
          const docId = tag.substring(4);
          if (docId && docId.trim()) {
            documentIds.push(docId);
            console.log(`Extracted document ID from tag: ${docId}`);
          }
        } else {
          regularTags.push(tag);
        }
      });
      
      // Set filter tags on the RxDBVectorStore if provided
      if (regularTags.length > 0 || documentIds.length > 0) {
        console.log(`Setting filter criteria: ${documentIds.length} document IDs, ${regularTags.length} regular tags`);
        
        if (typeof this.localVectorStore.setFilterTags === 'function') {
          // Pass regular tags for tag filtering
          this.localVectorStore.setFilterTags(regularTags);
        } else {
          console.warn('⚠️ Vector store does not support tag filtering');
        }
        
        // If we have a RxDBVectorStore, we can also set document IDs
        if (this.localVectorStore instanceof RxDBVectorStore) {
          (this.localVectorStore as RxDBVectorStore).setDocumentIds(documentIds);
          console.log(`Set document IDs filter on RxDBVectorStore: [${documentIds.join(', ')}]`);
        }
      }
      
      // Perform the search
      const k = options?.k || 5;
      console.log(`Executing search with k=${k}...`);
      
      // If using RxDBVectorStore and we have document IDs but no instance of RxDBVectorStore,
      // try to recreate it with the proper methods
      if (documentIds.length > 0 && !this.isRxDBVectorStore()) {
        console.log('Recreating local vector store to support document ID filtering');
        await this.ensureLocalVectorStore(true); // Force recreation
      }
      
      const docs = await this.localVectorStore.similaritySearch(query, k);
      
      console.log(`✅ Search complete. Found ${docs.length} documents`);
      return docs;
    } catch (error) {
      console.error('❌ Error in local similarity search:', error);
      return [];
    }
  }

  // Helper to check if the current vector store is an RxDBVectorStore
  private isRxDBVectorStore(): boolean {
    return this.localVectorStore instanceof RxDBVectorStore;
  }

  // This was missing before, add the method to ensure local vector store is initialized
  private async ensureLocalVectorStore(forceRecreation: boolean = false): Promise<void> {
    if (this.localVectorStore && !forceRecreation) {
      return;
    }
    
    try {
      console.log('Initializing local RxDB vector store...');
      
      // Initialize embeddings if needed
      if (!this.embeddings) {
        console.log('Creating OpenAI embeddings for local vector store...');
        this.embeddings = createOpenAIEmbeddings();
      }
      
      // Create the RxDB store for local storage
      console.log('Creating RxDBVectorStore from existing documents...');
      this.localVectorStore = await RxDBVectorStore.fromExistingDocuments(
        this.embeddings,
        { modelName: (this.embeddings as any).modelName }
      );
      
      console.log('✅ Local RxDB vector store initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize local vector store:', error);
      this.localVectorStore = null;
    }
  }
}

// Export a singleton instance
export const vectorDbService = new VectorDbService(); 