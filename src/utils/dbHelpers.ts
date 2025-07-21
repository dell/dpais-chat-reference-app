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

import { MessageDocType } from '../db/types';

export function ensureMessageSchema(message: Partial<MessageDocType>): MessageDocType {
  return {
    id: message.id || uuidv4(),
    text: message.text || '',
    sender: message.sender || 'user',
    timestamp: message.timestamp || Date.now(),
    documentReferences: message.documentReferences || [],
    // Add other required fields with defaults
  };
} 