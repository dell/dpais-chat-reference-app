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
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Link,
  Divider,
  useTheme,
} from '@mui/material';
import ComputerIcon from '@mui/icons-material/Computer';
import DownloadIcon from '@mui/icons-material/Download';
import BusinessIcon from '@mui/icons-material/Business';

export const MobileLanding: React.FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
          : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
        display: 'flex',
        alignItems: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 3,
            background: theme.palette.background.paper,
            animation: 'fadeInUp 0.6s ease-out',
            '@keyframes fadeInUp': {
              '0%': {
                opacity: 0,
                transform: 'translateY(20px)',
              },
              '100%': {
                opacity: 1,
                transform: 'translateY(0)',
              },
            },
          }}
        >
          {/* Logo/Icon */}
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              }
            }}
          >
            <Typography 
              variant="h3" 
              sx={{ 
                color: 'white', 
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              AI
            </Typography>
          </Box>

          {/* Title */}
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Welcome to Dell Pro AI Studio Chat
          </Typography>

          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
            A place to test out your AI PCs powered by Dell Pro AI Studio
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Main message */}
          <Typography variant="body1" paragraph sx={{ textAlign: 'left' }}>
            In order to use Dell Pro AI Studio Chat, you need to be on a Dell AI PC.
          </Typography>

          {/* Purchase AI PC Section */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
            }}
          >
            <ComputerIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Get a Dell AI PC
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Experience the power of on-device AI with Dell's latest AI-powered PCs
            </Typography>
            <Button
              variant="contained"
              color="primary"
              href="https://www.dell.com/en-us/lp/learn-about-ai-pcs"
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<ComputerIcon />}
              fullWidth
            >
              Shop Dell AI PCs
            </Button>
          </Paper>

          {/* Download Dell Pro AI Studio Section */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
            }}
          >
            <DownloadIcon sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Download Dell Pro AI Studio
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Get the runtime and management layer for AI on your Dell device
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              href="https://dell.com/DellProAIStudio"
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<DownloadIcon />}
              fullWidth
            >
              Download Dell Pro AI Studio
            </Button>
          </Paper>

          <Divider sx={{ my: 3 }} />

          {/* About Dell Pro AI Studio */}
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              What is Dell Pro AI Studio?
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Dell Pro AI Studio is the on-device runtime and management layer that enables 
              organizations to deploy, execute, and manage AI models directly on Dell client 
              devices. It provides centralized control for IT teams to configure, monitor, 
              and update AI workloads, while ensuring models are optimized for the device's 
              hardware (CPU, GPU, NPU).
            </Typography>
            <Typography variant="body2" color="text.secondary">
              With support for policy-based deployment, version control, and runtime plugin 
              management, it simplifies the operational side of running AI locally to empower 
              scalable, secure, and efficient on-client AI execution.
            </Typography>
          </Box>

          {/* Enterprise Link */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: theme.palette.action.hover,
            }}
          >
            <BusinessIcon sx={{ fontSize: 30, color: 'info.main', mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Enterprise Deployment
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              For more information on deployment of Dell Pro AI Studio within an 
              enterprise environment:
            </Typography>
            <Link
              href="https://dell.com/DellManagementPortal"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              Dell Management Portal - Dell Pro AI Studio
            </Link>
          </Paper>
        </Paper>
      </Container>
    </Box>
  );
}; 