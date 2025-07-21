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

// Set up global localStorage mock first
global.localStorage = {
  getItem: (key: string) => {
    if (key === 'chatAppSettings') return '{}';
    if (key === 'vectorDbConfigs') return '[]';
    return null;
  },
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0
};

// Make sure fetch is defined
if (!global.fetch) {
  global.fetch = (() => {
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not implemented'),
      json: () => Promise.resolve({ error: 'Not implemented' })
    }) as any;
  }) as typeof fetch;
}

// Now import modules
import { MultiVectorRAG } from './multiVectorRag';

/**
 * Helper to set up a test session with specified tags
 */
async function setupTestSession(sessionId: string, tags: string[]) {
  // Mock the session database lookup
  const originalGetDB = require('../db/db').getDB;
  
  // Replace with mock implementation
  require('../db/db').getDB = async () => {
    return {
      sessions: {
        findOne: () => ({
          exec: async () => ({
            sessionId,
            documentTags: tags,
            title: 'Test Session',
            messages: []
          })
        })
      }
    };
  };
  
  // Return cleanup function
  return () => {
    require('../db/db').getDB = originalGetDB;
  };
}

/**
 * Mock fetch for backend API requests
 */
async function setupFetchMock(mockResponse: any) {
  const originalFetch = global.fetch;
  
  // Create a mock fetch that returns our test data
  global.fetch = async () => {
    return {
      ok: true,
      json: async () => mockResponse
    } as Response;
  };
  
  // Return cleanup function
  return () => {
    global.fetch = originalFetch;
  };
}

/**
 * Test with company documents (backend/collection tags)
 */
async function testCompanyDocuments() {
  console.log('\n===== TESTING COMPANY DOCUMENTS FLOW =====');
  
  // Set up mock session with backend and collection tags
  const sessionId = 'test-session-company';
  const tags = [
    'backend:test-backend-1',
    'collection:test-collection-1',
    'some-regular-tag'
  ];
  
  // Set up mock fetch responses
  const mockDocuments = [
    {
      content: 'This is a test document from the backend API',
      metadata: {
        documentId: 'doc-1',
        documentName: 'Test Document 1',
        chunkId: 'chunk-1'
      },
      source_id: 'test-backend-1',
      source_name: 'Test Backend',
      source_type: 'backend',
      similarity: 0.95
    }
  ];
  
  // Set up mocks
  const cleanupSession = await setupTestSession(sessionId, tags);
  const cleanupFetch = await setupFetchMock(mockDocuments);
  
  try {
    // Run the test
    const query = 'test query';
    const docs = await MultiVectorRAG.getRelevantDocuments(query, sessionId);
    
    // Log results
    console.log(`\nRetrieved ${docs.length} documents`);
    if (docs.length > 0) {
      console.log('First document:', {
        content: docs[0].pageContent,
        metadata: docs[0].metadata
      });
    }
    
    // Assert expectations
    if (docs.length === 0) {
      console.error('❌ Test failed: No documents returned');
    } else if (docs[0].metadata.sourceType !== 'backend') {
      console.error('❌ Test failed: Document not from backend source');
    } else {
      console.log('✅ Company documents test passed');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up mocks
    cleanupSession();
    cleanupFetch();
  }
}

/**
 * Test with local documents (plain tags only)
 */
async function testLocalDocuments() {
  console.log('\n===== TESTING LOCAL DOCUMENTS FLOW =====');
  
  // Set up mock session with only regular tags
  const sessionId = 'test-session-local';
  const tags = ['tag1', 'tag2'];
  
  // Set up mocks
  const cleanupSession = await setupTestSession(sessionId, tags);
  
  // Mock vectorDbService
  const originalVectorDbService = require('../services/VectorDbService').vectorDbService;
  require('../services/VectorDbService').vectorDbService = {
    similaritySearch: async (query: string, options: any) => {
      console.log('Mock vectorDbService.similaritySearch called with:', { query, options });
      return [
        {
          pageContent: 'This is a test document from the local vector store',
          metadata: {
            documentId: 'local-doc-1',
            documentName: 'Local Test Document',
            chunkId: 'local-chunk-1',
            similarity: 0.85
          }
        }
      ];
    }
  };
  
  try {
    // Run the test
    const query = 'test query';
    const docs = await MultiVectorRAG.getRelevantDocuments(query, sessionId);
    
    // Log results
    console.log(`\nRetrieved ${docs.length} documents`);
    if (docs.length > 0) {
      console.log('First document:', {
        content: docs[0].pageContent,
        metadata: docs[0].metadata
      });
    }
    
    // Assert expectations
    if (docs.length === 0) {
      console.error('❌ Test failed: No documents returned');
    } else if (!docs[0].metadata.documentId.startsWith('local-')) {
      console.error('❌ Test failed: Document not from local source');
    } else {
      console.log('✅ Local documents test passed');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up mocks
    cleanupSession();
    // Restore original vectorDbService
    require('../services/VectorDbService').vectorDbService = originalVectorDbService;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('===== MULTI-VECTOR RAG TESTS =====');
  
  try {
    await testCompanyDocuments();
    await testLocalDocuments();
    console.log('\n===== ALL TESTS COMPLETED =====');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests(); 