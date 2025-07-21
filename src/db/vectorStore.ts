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

import { getDB } from './db';
import { MessageDocType } from './types';

/**
 * Add a vectorized message to the database (using upsert pattern)
 * @param message The message document to vectorize
 * @param embedding The pre-generated embedding vector
 * @returns The inserted or updated message document
 */
export async function addVectorizedMessage(
  message: MessageDocType,
  embedding: number[]
) {
  const db = await getDB();
  const messageWithEmbedding: MessageDocType = {
    ...message,
    embedding
  };
  
  try {
    // First try inserting the document
    return await db.messages.insert(messageWithEmbedding);
  } catch (error: any) {
    // If document already exists (CONFLICT error), update it instead
    if (error.code === 'CONFLICT') {
      console.log(`Message ${message.id} already exists, updating with embedding`);
      const existingDoc = await db.messages.findOne({
        selector: { id: message.id }
      }).exec();
      
      if (existingDoc) {
        // Update the existing document with embedding
        await existingDoc.update({
          $set: {
            embedding: embedding
          }
        });
        return existingDoc;
      }
    }
    
    // For other errors, rethrow
    throw error;
  }
}

/**
 * Perform vector similarity search on messages
 * @param queryEmbedding The embedding vector for the query
 * @param limit Maximum number of results to return
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns Array of similar messages with similarity scores
 */
export async function findSimilarMessages(
  queryEmbedding: number[],
  limit = 5,
  minSimilarity = 0.7
): Promise<Array<{message: MessageDocType, similarity: number}>> {
  const db = await getDB();
  
  // Get all messages with embeddings
  const messages = await db.messages
    .find({
      selector: {
        embedding: { $exists: true }
      }
    })
    .exec();
  
  // Calculate cosine similarity for each message
  const messagesWithSimilarity = messages.map(doc => {
    const message = doc.toJSON() as MessageDocType;
    if (!message.embedding) return { message, similarity: 0 };
    
    const similarity = calculateCosineSimilarity(queryEmbedding, message.embedding);
    return { message, similarity };
  });
  
  // Filter by minimum similarity and sort by descending similarity
  return messagesWithSimilarity
    .filter(item => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA First vector
 * @param vecB Second vector
 * @returns Cosine similarity (0-1, higher is more similar)
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += Math.pow(vecA[i], 2);
    normB += Math.pow(vecB[i], 2);
  }
  
  // Avoid division by zero
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Create an embedding from text using an embedding API
 * @param texts Text or array of texts to embed
 * @returns Promise resolving to the embedding vector(s)
 */
export async function createEmbedding(texts: string | string[]): Promise<number[] | number[][]> {
  try {
    const textsArray = Array.isArray(texts) ? texts : [texts];
    const isBatch = textsArray.length > 1;
    
    const settings = localStorage.getItem('chatAppSettings') 
      ? JSON.parse(localStorage.getItem('chatAppSettings') || '{}')
      : {};
    
    const apiBaseUrl = settings.apiBaseUrl || 'http://localhost:8553/v1';
    const apiKey = settings.apiKey || '';
    const embeddingsModel = settings.embeddingsModel || 'nomic-embed-text';
    
    if (apiBaseUrl) {
      try {
        const response = await fetch(`${apiBaseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: textsArray.map(text => `search_query: ${text}`),  // Always use search_query prefix for standalone queries
            model: embeddingsModel,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // If it was a batch request, return all embeddings as array of arrays
          if (isBatch && data.data && Array.isArray(data.data)) {
            return data.data.map((item: any) => item.embedding);
          }
          // Otherwise return just the first embedding
          return data.data[0].embedding;
        }
      } catch (error) {
        console.warn('Error calling embedding API, falling back to mock embeddings:', error);
      }
    }
    
    // Fallback to mock embeddings if API call fails
    const mockEmbedding = createMockEmbedding(textsArray[0]);
    return isBatch ? textsArray.map(() => createMockEmbedding(textsArray[0])) : mockEmbedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    const mockEmbedding = createMockEmbedding(Array.isArray(texts) ? texts[0] : texts);
    return Array.isArray(texts) && texts.length > 1 
      ? texts.map(() => createMockEmbedding(texts[0])) 
      : mockEmbedding;
  }
}

/**
 * Generate a mock embedding for testing purposes
 * @param text The text to create a mock embedding for
 * @returns A normalized mock embedding vector
 */
function createMockEmbedding(text: string): number[] {
  // Create a simple hash-based vector (128 dimensions) for testing
  const vector = new Array(128).fill(0);
  
  // Simple hash function to generate a pseudo-embedding
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vector[i % vector.length] += code / 100;
  }
  
  // Normalize the vector
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / norm);
}

/**
 * Vectorize and store a new message
 * @param message The message to vectorize and store
 * @returns The stored message with its embedding
 */
export async function vectorizeAndStoreMessage(message: MessageDocType): Promise<MessageDocType> {
  try {
    // Only vectorize text messages that don't already have embeddings
    if (message.text && !message.embedding) {
      const embeddingResult = await createEmbedding(message.text);
      // Ensure we have a single embedding array
      const embedding = Array.isArray(embeddingResult[0]) 
        ? (embeddingResult as number[][])[0] 
        : embeddingResult as number[];
      
      return await addVectorizedMessage(message, embedding);
    }
    return message;
  } catch (error) {
    console.error('Error vectorizing message:', error);
    return message;
  }
}

/**
 * Find semantically similar messages to a query
 * @param query The text query to search for
 * @param limit Maximum number of results to return
 * @returns Array of similar messages
 */
export async function semanticSearch(query: string, limit = 5): Promise<MessageDocType[]> {
  try {
    const embeddingResult = await createEmbedding(query);
    // Ensure we have a single embedding array
    const queryEmbedding = Array.isArray(embeddingResult[0]) 
      ? (embeddingResult as number[][])[0] 
      : embeddingResult as number[];
      
    const results = await findSimilarMessages(queryEmbedding, limit);
    console.log('--------------------------------');
    console.log('Semantic Search Results:', results);
    console.log('--------------------------------');
    return results.map(r => r.message);
  } catch (error) {
    console.error('Error performing semantic search:', error);
    return [];
  }
}