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

import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';
import { MessageDocType } from '../../db/types';

interface ChatWindowProps {
  messages: MessageDocType[];
  isThinking: boolean;
  thinkingTokens: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isThinking, thinkingTokens }) => {
  return (
    <Box sx={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', p: 2 }}>
      <List>
        {messages.map((msg) => (
          <ListItem key={msg.id} sx={{ justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <ListItemText
              primary={
                <Box
                  sx={{
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.300',
                    color: msg.sender === 'user' ? 'primary.contrastText' : 'black',
                    borderRadius: 2,
                    p: 1,
                    maxWidth: '60%',
                    display: 'inline-block',
                  }}
                >
                  {msg.text}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      {isThinking && (
        <Box sx={{ mt: 'auto', borderTop: '1px solid #ccc', pt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Thinking...
          </Typography>
          <Box sx={{ backgroundColor: '#f0f0f0', p: 1, mt: 1 }}>
            {thinkingTokens}
          </Box>
        </Box>
      )}
    </Box>
  );
};