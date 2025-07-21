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

import { v4 as uuidv4 } from 'uuid';
import { MessageDocType } from '../db/types';

/**
 * Creates a message object with all required fields for the database
 */
export function createMessageObject(
  text: string, 
  sender: 'user' | 'assistant', 
  sessionId: string,
  additionalFields = {}
): MessageDocType {
  return {
    id: uuidv4(),
    text,
    sender,
    timestamp: Date.now(),
    conversationId: sessionId || '',
    thinkingContent: '',
    // Include default values for any potentially required fields
    metrics: {
      tokenCount: text.split(' ').length,
      timeToFirstToken: 0,
      totalTime: 0
    },
    ...additionalFields
  };
} 