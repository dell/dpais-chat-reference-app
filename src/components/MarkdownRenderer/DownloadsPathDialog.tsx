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

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WindowsIcon from '@mui/icons-material/Computer';
import AppleIcon from '@mui/icons-material/Apple';
import LinuxIcon from '@mui/icons-material/Terminal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getSettings, saveSettings } from '../../utils/settings';

interface DownloadsPathDialogProps {
  open: boolean;
  onClose: (path?: string) => void;
}

interface PlatformInstructions {
  icon: React.ReactNode;
  name: string;
  example: string;
  steps: string[];
}

export const DownloadsPathDialog: React.FC<DownloadsPathDialogProps> = ({ open, onClose }) => {
  const [path, setPath] = useState('');
  const [error, setError] = useState('');

  const platforms: PlatformInstructions[] = [
    {
      icon: <WindowsIcon />,
      name: 'Windows',
      example: 'C:\\Users\\YourUsername\\Downloads',
      steps: [
        'Open File Explorer',
        'Navigate to your Downloads folder',
        'Click in the address bar at the top',
        'Copy the full path (e.g., C:\\Users\\YourUsername\\Downloads)',
        'Paste it in the field below'
      ]
    },
    {
      icon: <AppleIcon />,
      name: 'macOS',
      example: '/Users/YourUsername/Downloads',
      steps: [
        'Open Finder',
        'Navigate to Downloads folder',
        'Right-click on Downloads in the sidebar',
        'Hold Option key and select "Copy Downloads as Pathname"',
        'Or in Terminal, type: echo ~/Downloads | pbcopy'
      ]
    },
    {
      icon: <LinuxIcon />,
      name: 'Linux',
      example: '/home/YourUsername/Downloads',
      steps: [
        'Open Terminal',
        'Type: echo ~/Downloads',
        'Copy the output path',
        'Or type: pwd after navigating to Downloads folder',
        'Paste the path in the field below'
      ]
    }
  ];

  const handleCopyExample = (example: string) => {
    // Replace YourUsername with actual username if possible
    const username = (window as any).username || 'YourUsername';
    const actualPath = example.replace('YourUsername', username);
    navigator.clipboard.writeText(actualPath);
  };

  const handleSave = () => {
    if (!path.trim()) {
      setError('Please enter a path');
      return;
    }

    // Basic path validation
    const isWindowsPath = /^[A-Za-z]:\\/.test(path);
    const isUnixPath = path.startsWith('/') || path.startsWith('~');
    
    if (!isWindowsPath && !isUnixPath) {
      setError('Please enter a valid absolute path');
      return;
    }

    // Save to settings
    const settings = getSettings();
    saveSettings({
      ...settings,
      downloadsPath: path.trim()
    });

    onClose(path.trim());
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Configure Downloads Folder Path</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          To open files directly in VS Code, we need to know where your Downloads folder is located.
          This is a one-time setup.
        </Alert>

        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Select your operating system for instructions:
        </Typography>

        {platforms.map((platform) => (
          <Accordion key={platform.name}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {platform.icon}
                <Typography>{platform.name}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Example path:</strong>
              </Typography>
              <Paper
                sx={{
                  p: 1,
                  mb: 2,
                  bgcolor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <code>{platform.example}</code>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyExample(platform.example)}
                >
                  Copy
                </Button>
              </Paper>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Steps to get your path:</strong>
              </Typography>
              <Box component="ol" sx={{ pl: 3, mb: 0 }}>
                {platform.steps.map((step, index) => (
                  <li key={index}>
                    <Typography variant="body2">{step}</Typography>
                  </li>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}

        <TextField
          fullWidth
          label="Downloads Folder Path"
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setError('');
          }}
          error={!!error}
          helperText={error || 'Paste your Downloads folder path here'}
          placeholder="e.g., C:\\Users\\YourName\\Downloads or /Users/YourName/Downloads"
          sx={{ mt: 3 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Path
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 