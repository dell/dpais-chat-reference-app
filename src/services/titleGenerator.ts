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

import OpenAI from 'openai';
import { MessageDocType } from '../db/types';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { getDB } from '../db/db';
import { store } from '../store/store';

// Get settings from localStorage or use defaults
const getApiSettings = () => {
  const savedSettings = localStorage.getItem('chatAppSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    return {
      apiKey: settings.apiKey || 'dpais',
      baseURL: settings.apiBaseUrl || 'http://localhost:8553/v1/openai'
    };
  }
  return {
    apiKey: 'dpais',
    baseURL: 'http://localhost:8553/v1/openai'
  };
};

// Create OpenAI client with settings
const createClient = () => {
  const settings = getApiSettings();
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    dangerouslyAllowBrowser: true,
  });
};

/**
 * Generates a concise title for a chat based on the first user question and first assistant response
 */
export async function generateChatTitle(messages: MessageDocType[]): Promise<string> {
  try {
    if (messages.length < 2) {
      return 'New Chat';
    }
    
    // Find the first user message and the first assistant response
    const firstUserMsg = messages.find(msg => msg.sender === 'user');
    const firstAssistantMsg = messages.find(msg => msg.sender === 'assistant');
    
    // Make sure we have both messages to generate a meaningful title
    if (!firstUserMsg || !firstAssistantMsg) {
      return 'New Chat';
    }
    
    // Create client with current settings
    const openai = createClient();
    
    // Use just the first exchange for title generation
    const formattedMessages = [
      {
        role: 'user',
        content: firstUserMsg.text
      },
      {
        role: 'assistant',
        content: firstAssistantMsg.text.slice(0, 200) // Limit assistant message length
      }
    ];
    
    console.log('Generating title from messages:', formattedMessages);
    
    // Get the current model from Redux store
    const currentModel = store.getState().chat.currentModel;
    console.log('Using model for title generation:', currentModel);

    const messagesAppended = [
      {
        role: 'system',
        content: 'You are a title generator that creates concise, descriptive titles. Analyze the conversation and extract its key theme. Focus on what makes this conversation unique. You will use the generate_title function to return your answer.'
      },
      ...formattedMessages
    ] as ChatCompletionMessageParam[];
    
    // Create prompt for generating a title
    const response = await openai.chat.completions.create({
      model: currentModel, // Use the currently selected model instead of hardcoded one
      messages: messagesAppended,
      temperature: 0.7,
      max_tokens: 20,
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_title',
            description: 'Generate a short, concise title (ONLY 2-3 words) that captures the essence of this conversation. No markdown or fomatting is allowed. Respond with just the title, no quotes or additional text.',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The generated title (ONLY 2-3 words)'
                }
              },
              required: ['title']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'generate_title' } }
    });
    
    // Extract and clean the title from function call
    let title = 'New Chat';
    const toolCalls = response.choices[0]?.message.tool_calls;
    console.log('Tool calls:', toolCalls);
    if (toolCalls && toolCalls.length > 0) {
      try {
        const functionArgs = JSON.parse(toolCalls[0].function.arguments);
        title = functionArgs.title;
        console.log('Generated title from function call:', title);
      } catch (error) {
        console.error('Error parsing function arguments:', error);
      }
    } else {
      // Fallback to content if tool wasn't used
      title = response.choices[0]?.message.content?.trim() || 'New Chat';
      console.log('Generated title from content:', title);
    }
    
    // If title is too long, truncate it
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  } catch (error) {
    console.error('Error generating chat title:', error);
    
    // Fallback: Use the first user message as title
    const firstUserMsg = messages.find(msg => msg.sender === 'user');
    if (firstUserMsg) {
      const title = firstUserMsg.text.slice(0, 30);
      return title.length < firstUserMsg.text.length ? title + '...' : title;
    }
    
    return 'New Chat';
  }
}

/**
 * Interface for a document chunk with vector embedding
 */
export interface DocumentChunkDocType {
  id: string;
  documentId: string;  // Reference to parent document
  content: string;     // The chunk text
  embedding: number[]; // Vector embedding
  chunkIndex: number;  // Position in the document
  metadata: {
    documentName: string;
    documentType: string;
    tags: string[];
    pageNumber?: number;
    section?: string;
  };
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
  chunkCount: number;  // Number of chunks
}

/**
 * Interface for a document with vector embedding
 */
export interface DocumentDocType {
  id: string;
  content: string;     // Full document content
  metadata: DocumentMetadata;
}

/**
 * Create an embedding from text using OpenAI API
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    // Get API settings from localStorage
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    const apiBaseUrl = settings.apiBaseUrl || 'http://localhost:8553/v1';
    const apiKey = settings.apiKey || '';
    const embeddingsModel = settings.embeddingsModel || 'nomic-embed-text';
    
    // Call the embeddings API
    const response = await fetch(`${apiBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: `search_query: ${text}`,
        model: embeddingsModel, // Use embeddings model from settings
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding, falling back to mock:', error);
    throw error;
  }
}

/**
 * Find semantically similar document chunks
 */
export async function searchDocumentChunks(query: string, options: {
  limit?: number;
  minSimilarity?: number;
  tags?: string[];
}) {
  const { limit = 5, minSimilarity = 0.7, tags = [] } = options;
  
  try {
    const queryEmbedding = await createEmbedding(query);
    const db = await getDB();
    
    // Get chunks, filtering by tags if provided
    let chunks = await db.documentChunks.find().exec();
    
    if (tags.length > 0) {
      chunks = chunks.filter(doc => {
        const docTags = doc.metadata.tags;
        return tags.every(tag => docTags.includes(tag));
      });
    }
    
    // Calculate similarity for each chunk
    const chunksWithSimilarity = chunks.map(doc => {
      const chunk = doc.toJSON() as DocumentChunkDocType;
      const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, similarity };
    });
    
    // Filter and sort results
    return chunksWithSimilarity
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    console.error('Error searching document chunks:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
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