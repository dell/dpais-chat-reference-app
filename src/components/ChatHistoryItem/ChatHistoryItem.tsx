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
import { ListItem, ListItemButton, ListItemText, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppDispatch, loadSession } from '../../store/store';
import { getDB } from '../../db/db';
import type { SessionDocType, MessageDocType } from '../../db/types';

interface ChatHistoryItemProps {
  session: SessionDocType;
  isActive: boolean;
  onDelete: (sessionId: string) => void;
}

export const ChatHistoryItem: React.FC<ChatHistoryItemProps> = ({
  session,
  isActive,
  onDelete
}) => {
  const dispatch = useAppDispatch();

  const handleSelectSession = async () => {
    const db = await getDB();
    // Fetch all messages for this session
    const messagePromises = session.messages.map(msgId =>
      db.messages.findOne(msgId).exec()
    );

    const messageResults = await Promise.all(messagePromises);
    const messages = messageResults
      .filter(Boolean)
      .map(doc => doc!.toJSON() as MessageDocType);

    // Load the selected session into Redux
    dispatch(loadSession({
      sessionId: session.sessionId,
      messages
    }));
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.sessionId);
  };

  // Format dates
  const formattedDate = new Date(session.createdAt).toLocaleDateString();
  const formattedTime = new Date(session.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <ListItem
      disablePadding
      sx={{ position: 'relative' }}
    >
      <ListItemButton
        onClick={handleSelectSession}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          px: 1.5,
          py: 1,
          transition: 'background-color 0.2s ease',
          ...(isActive && {
            bgcolor: 'action.selected',
          }),
          '&:hover': {
            bgcolor: 'action.hover',
          }
        }}
      >
        <ListItemText
          primary={session.title}
          secondary={`${formattedDate}, ${formattedTime}`}
          primaryTypographyProps={{
            noWrap: true,
            sx: { 
              fontWeight: 500,
              color: 'text.primary'
            }
          }}
          secondaryTypographyProps={{
            noWrap: true,
            sx: {
              fontSize: '0.75rem',
              color: 'text.secondary'
            }
          }}
        />
        <IconButton
          aria-label="delete"
          onClick={handleDelete}
          size="small"
          sx={{ 
            position: 'absolute', 
            right: 8, 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'error.light'
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </ListItemButton>
    </ListItem>
  );
};