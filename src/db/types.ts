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

/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
    RxDocument,
    RxCollection,
    RxDatabase,
  } from 'rxdb';
  
  /**
   * Interface for message metrics
   */
  export interface MessageMetrics {
    processingTimeMs?: number;
    tokensGenerated?: number;
    wordsGenerated?: number;
    tokensPerSecond?: number;
    startTime?: number;
    endTime?: number;
  }
  
  /**
   * Interface representing a single chat Message.
   */
  export interface DocumentReference {
    documentId: string;     // ID of the document
    documentName: string;   // Name for display
    chunkId: string;        // ID to look up the chunk in the document-chunk db
    chunkIndex?: number;    // Index of the chunk in the document (for UI reference)
    similarity?: number;     // Similarity score
    sourceType?: string;    // Type of source (local or vdb)
    content?: string;        // Document content
  }
  
  export interface MessageDocType {
    id: string;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: number;
    thinkingContent?: string;
    embedding?: number[];
    metrics?: MessageMetrics;
    documentReferences?: DocumentReference[]; // References for RAG
    model?: string; // Model used to generate this message (for assistant messages)
  }
  
  /**
   * RxDocument for messages.
   */
  export type MessageDocument = RxDocument<MessageDocType>;
  
  /**
   * Optional custom methods for the messages collection.
   */
  export interface MessageCollectionMethods {
    // e.g., getVector(): number[];
  }
  
  /**
   * Interface representing a chat session doc.
   */
  export interface SessionDocType {
    sessionId: string;
    createdAt: number;
    lastUpdated: number;
    title: string;
    messages: string[]; // store IDs referencing the messages collection
    documentTags?: string[]; // Tags for document references
  }
  
  /**
   * RxDocument for a session.
   */
  export type SessionDocument = RxDocument<SessionDocType>;
  
  /**
   * Optional custom methods for the sessions collection.
   */
  export interface SessionCollectionMethods {
    // e.g., addMessageId(msgId: string): void;
  }
  
  /**
   * Interface for document metadata
   */
  export interface DocumentMetadata {
    filename: string;
    mimetype: string;
    size: number;
    uploadDate: number;
    tags: string[];
    chunkCount: number;
  }
  
  /**
   * Interface for a document
   */
  export interface DocumentDocType {
    id: string;
    content: string;
    metadata: DocumentMetadata;
  }
  
  /**
   * RxDocument for documents
   */
  export type DocumentDocument = RxDocument<DocumentDocType>;
  
  /**
   * Interface for document methods
   */
  export interface DocumentCollectionMethods {
    // Future methods
  }
  
  /**
   * Interface for document chunk metadata
   */
  export interface DocumentChunkMetadata {
    documentName: string;
    documentType: string;
    tags: string[];
    pageNumber?: number;
    section?: string;
  }
  
  /**
   * Interface for a document chunk with vector embedding
   */
  export interface DocumentChunkDocType {
    id: string;
    documentId: string;
    content: string;
    embedding: number[];
    chunkIndex: number;
    metadata: DocumentChunkMetadata;
  }
  
  /**
   * RxDocument for document chunks
   */
  export type DocumentChunkDocument = RxDocument<DocumentChunkDocType>;
  
  /**
   * Interface for document chunk methods
   */
  export interface DocumentChunkCollectionMethods {
    // Future methods
  }
  
  /**
   * Our database collections.
   */
  export interface ChatDatabaseCollections {
    messages: RxCollection<MessageDocType, MessageCollectionMethods>;
    sessions: RxCollection<SessionDocType, SessionCollectionMethods>;
    documents: RxCollection<DocumentDocType, DocumentCollectionMethods>;
    documentChunks: RxCollection<DocumentChunkDocType, DocumentChunkCollectionMethods>;
  }
  
  /**
   * The main ChatDB type.
   */
  export type ChatDB = RxDatabase<ChatDatabaseCollections>;