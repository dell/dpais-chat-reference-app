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
    createRxDatabase,
    addRxPlugin as addRxDBPlugin
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateZSchemaStorage } from 'rxdb/plugins/validate-z-schema';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { ChatDB } from './types';
import { messageSchema, sessionSchema, documentSchema, documentChunkSchema } from './schemas';
import { store } from '../store/store';

// Somewhere near the top of the file, add a debug flag
const DEBUG_DB = true;

// Add needed plugins
const initializePlugins = () => {
  if (DEBUG_DB) console.log('=== DB: Initializing plugins...');
  addRxDBPlugin(RxDBDevModePlugin);
  addRxDBPlugin(RxDBQueryBuilderPlugin);
  addRxDBPlugin(RxDBUpdatePlugin);
  addRxDBPlugin(RxDBMigrationSchemaPlugin);
  if (DEBUG_DB) console.log('=== DB: All plugins initialized');
};

// Initialize plugins
initializePlugins();

// Define migrations
const migrations = {
    messages: {
        1: function(oldDoc: any) {
            // Add model field to existing documents if missing
            if (!oldDoc.model && oldDoc.sender === 'assistant') {
                oldDoc.model = 'deepseek-r1:7b'; // Default model as fallback
            }
            return oldDoc;
        }
    }
};

let dbPromise: Promise<ChatDB> | null = null;

export async function getDB(): Promise<ChatDB> {
    if (DEBUG_DB) console.log('=== DB: Getting database instance...');
    
    if (!dbPromise) {
        if (DEBUG_DB) console.log('=== DB: Creating new database connection...');
        dbPromise = createDB();
    }
    
    const db = await dbPromise;
    if (DEBUG_DB) console.log('=== DB: Database connection established');
    return db;
}

async function createDB() {
    if (DEBUG_DB) console.log('=== DB: Starting database creation process...');
    
    const storage = wrappedValidateZSchemaStorage({
        storage: getRxStorageDexie()
    });
    
    const db = await createRxDatabase<ChatDB>({
        name: 'chatdb',
        storage,
        multiInstance: true,
    });
    
    if (DEBUG_DB) console.log('=== DB: Database created, adding collections...');
    
    // Create collections, strongly typed with their doc definitions.
    await db.addCollections({
        messages: {
            schema: messageSchema,
            migrationStrategies: migrations.messages
        },
        sessions: {
            schema: sessionSchema,
        },
        documents: {
            schema: documentSchema,
        },
        documentChunks: {
            schema: documentChunkSchema,
        },
    });
    
    if (DEBUG_DB) console.log('=== DB: Database created successfully');
    return db;
}