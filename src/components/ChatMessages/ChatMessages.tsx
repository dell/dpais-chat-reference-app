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

import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { useAppSelector } from '../../store/store';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import './ChatMessages.css';

export const ChatMessages: React.FC = () => {
  const { messages, isThinking, thinkingTokens } = useAppSelector(state => state.chat);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingTokens]);
  
  // Find the last message - if it's from the assistant, we'll show live thinking with it
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  
  // Modified logic: Show thinking when either actively thinking OR have thinking tokens
  const showLiveThinking = ((isThinking || thinkingTokens.length > 0) && 
                           lastMessage && lastMessage.sender === 'assistant');
//   console.log('showLiveThinking:', showLiveThinking, 'isThinking:', isThinking, 'tokens length:', thinkingTokens.length);
  
  return (
    <Box className="chat-messages">
      <Box className="messages-container">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              // Only pass live thinking content to the last assistant message
              thinkingContent={isLastMessage && showLiveThinking ? thinkingTokens : undefined}
              isThinking={isLastMessage && showLiveThinking!}
            />
          );
        })}
        
        {/* If we're thinking but don't have an assistant message yet, show standalone thinking */}
        {isThinking && (!lastMessage || lastMessage.sender !== 'assistant') && (
          <MessageBubble
            message={{
              id: 'thinking',
              text: '',
              sender: 'assistant',
              timestamp: Date.now()
            }}
            thinkingContent={thinkingTokens}
            isThinking={true}
          />
        )}
        
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};