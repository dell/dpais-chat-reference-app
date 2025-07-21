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

import type { RxJsonSchema } from 'rxdb';
import type { MessageDocType, SessionDocType, DocumentDocType, DocumentChunkDocType } from './types';

export const messageSchema: RxJsonSchema<MessageDocType> = {
  title: 'message schema',
  description: 'Stores individual messages with optional embeddings and thinking content.',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36,
    },
    text: {
      type: 'string',
    },
    sender: {
      type: 'string',
      enum: ['user', 'assistant'],
    },
    timestamp: {
      type: 'number',
    },
    thinkingContent: {
      type: 'string',
      // optional field
    },
    embedding: {
      type: 'array',
      items: {
        type: 'number',
      },
      // optional
    },
    metrics: {
      type: 'object',
      properties: {
        processingTimeMs: {
          type: 'number',
        },
        tokensGenerated: {
          type: 'number',
        },
        wordsGenerated: {
          type: 'number',
        },
        tokensPerSecond: {
          type: 'number',
        },
        startTime: {
          type: 'number',
        },
        endTime: {
          type: 'number',
        }
      }
    },
    documentReferences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string'
          },
          documentName: {
            type: 'string'
          },
          chunkId: {
            type: 'string'
          },
          similarity: {
            type: 'number'
          },
          content: {
            type: 'string'
          }
        },
        required: ['documentId', 'documentName']
      }
    },
    model: {
      type: 'string'
      // optional field
    }
  },
  required: ['id', 'text', 'sender'],
};

export const sessionSchema: RxJsonSchema<SessionDocType> = {
  title: 'chat session schema',
  description: 'Stores references to messages by ID.',
  version: 0,
  primaryKey: 'sessionId',
  type: 'object',
  properties: {
    sessionId: {
      type: 'string',
      maxLength: 36,
    },
    createdAt: {
      type: 'number',
    },
    lastUpdated: {
      type: 'number',
    },
    title: {
      type: 'string',
    },
    messages: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    documentTags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['sessionId', 'createdAt', 'lastUpdated', 'title', 'messages'],
};

export const documentSchema: RxJsonSchema<DocumentDocType> = {
  title: 'document schema',
  description: 'Stores documents with metadata',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36,
    },
    content: {
      type: 'string',
    },
    metadata: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
        },
        mimetype: {
          type: 'string',
        },
        size: {
          type: 'number',
        },
        uploadDate: {
          type: 'number',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        chunkCount: {
          type: 'number',
        },
      },
      required: ['filename', 'mimetype', 'size', 'uploadDate', 'tags', 'chunkCount'],
    },
  },
  required: ['id', 'content', 'metadata'],
};

export const documentChunkSchema: RxJsonSchema<DocumentChunkDocType> = {
  title: 'document chunk schema',
  description: 'Stores document chunks with vector embeddings',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36,
    },
    documentId: {
      type: 'string',
      maxLength: 36,
    },
    content: {
      type: 'string',
    },
    embedding: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
    chunkIndex: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 1000000
    },
    metadata: {
      type: 'object',
      properties: {
        documentName: {
          type: 'string',
        },
        documentType: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        pageNumber: {
          type: 'number',
        },
        section: {
          type: 'string',
        },
      },
      required: ['documentName', 'documentType', 'tags'],
    },
  },
  required: ['id', 'documentId', 'content', 'embedding', 'chunkIndex', 'metadata'],
  indexes: [
    'documentId',
    'chunkIndex'
  ]
};