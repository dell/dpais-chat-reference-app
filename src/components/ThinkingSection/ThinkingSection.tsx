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

import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ReactMarkdown from 'react-markdown';
import { useAppSelector } from '../../store/store';

interface ThinkingSectionProps {
  content: string;
  messageId?: string; // Optional, for saved messages
  isStreaming?: boolean; // Flag for active thinking
}

export const ThinkingSection: React.FC<ThinkingSectionProps> = ({ 
  content, 
  messageId,
  isStreaming = false
}) => {
  // Get display state from Redux store
  const displayThinking = useAppSelector(state => state.chat.displayThinking);
  
  // Local expanded state - default to true or get from Redux store if messageId exists
  const [expanded, setExpanded] = useState(
    messageId ? (displayThinking[messageId] !== false) : true
  );
  
  // Keep local state in sync with Redux store when display settings change
  useEffect(() => {
    if (messageId && displayThinking[messageId] !== undefined) {
      setExpanded(displayThinking[messageId]);
    }
  }, [messageId, displayThinking]);

  const handleToggle = () => {
    setExpanded(!expanded);
  };
  
  return (
    <Paper 
      sx={{
        p: 1.5,
        my: 0.75,
        mx: 0,
        bgcolor: 'background.paper',
        borderLeft: '4px solid',
        borderLeftColor: 'secondary.main',
        borderRadius: '6px'
      }}
    >
      <Box 
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 1,
          cursor: 'pointer',
          p: 0.5,
          borderRadius: 0.5,
          '&:hover': {
            bgcolor: theme => `rgba(${theme.palette.secondary.main.replace('#', '').match(/../g)?.map(hex => parseInt(hex, 16)).join(', ') || '0, 0, 0'}, 0.1)`
          }
        }} 
        onClick={handleToggle}
      >
        <PsychologyIcon 
          sx={{ 
            color: 'secondary.main',
            mr: 1
          }} 
        />
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: 'secondary.main',
            fontWeight: 600
          }}
        >
          {isStreaming ? "Thinking..." : "Thinking Process"}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton 
          size="small" 
          sx={{ color: 'secondary.main' }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      {expanded && (
        <Box 
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: '"Consolas", "Monaco", monospace',
            fontSize: '0.85rem',
            maxHeight: 300,
            overflowY: 'auto',
            bgcolor: 'background.default',
            p: 1.5,
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <ReactMarkdown>{content || 'Processing your request...'}</ReactMarkdown>
        </Box>
      )}
    </Paper>
  );
};