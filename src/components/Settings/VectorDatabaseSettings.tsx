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
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  Autocomplete,
  Alert,
  Link
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudIcon from '@mui/icons-material/Cloud';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import RefreshIcon from '@mui/icons-material/Refresh';
import { 
  VectorDbConfig, 
  VectorDbType,
  MilvusConfig,
  QdrantConfig,
  WeaviateConfig,
  ChromaConfig,
  PGVectorConfig,
  PineconeConfig
} from '../../types/vectorDb';
import { vectorDbService } from '../../services/VectorDbService';

interface VectorDatabaseSettingsProps {
  onConfigurationChange?: () => void;
}

// Default Docker configuration function
const createDefaultDockerConfigurations = (
  notifyChange?: () => void
): void => {
  // Check if any configurations already exist
  const existingConfigs = vectorDbService.getConfigurations();
  
  // Define default Docker configurations
  const defaultConfigs = [
    {
      type: 'milvus',
      name: 'Local Milvus',
      description: 'Docker localhost Milvus instance',
      enabled: true,
      tags: ['local', 'docker'],
      url: 'http://localhost:19530',
      collection: 'documents'
    },
    
    {
      type: 'qdrant',
      name: 'Local Qdrant',
      description: 'Docker localhost Qdrant instance',
      enabled: true,
      tags: ['local', 'docker'],
      url: 'http://localhost:6333',
      collection: 'documents'
    },
    
    {
      type: 'weaviate',
      name: 'Local Weaviate',
      description: 'Docker localhost Weaviate instance',
      enabled: true,
      tags: ['local', 'docker'],
      url: 'http://localhost:8080',
      className: 'Document'
    },
    
    {
      type: 'pgvector',
      name: 'Local PGVector',
      description: 'Docker localhost PostgreSQL with pgvector',
      enabled: true,
      tags: ['local', 'docker'],
      connectionString: 'postgresql://postgres:postgres@localhost:5432/vectordb',
      tableName: 'documents'
    }
  ];
  
  // Add each default configuration if it doesn't already exist (check by name)
  defaultConfigs.forEach(config => {
    const exists = existingConfigs.some(
      existing => existing.name === config.name && existing.type === config.type
    );
    
    if (!exists) {
      vectorDbService.addConfiguration(config as any);
    }
  });
  
  // Notify parent component about the change
  if (notifyChange) {
    notifyChange();
  }
};

export const VectorDatabaseSettings: React.FC<VectorDatabaseSettingsProps> = ({ 
  onConfigurationChange 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backends, setBackends] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [collections, setCollections] = useState<Array<{id: string, name: string, tags: string[]}>>([]);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{success: boolean, message: string} | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');

  // Load configuration on mount
  useEffect(() => {
    // Get settings from localStorage
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    setApiEndpoint(settings.backendApiUrl || 'http://localhost:8000');
    
    loadBackendData();
  }, []);

  // Load backend data from API
  const loadBackendData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if we can connect to backend
      const response = await fetch(`${apiEndpoint}/health`, {
        method: 'GET',
      });
      
      const connectionStatus = {
        success: response.ok,
        message: response.ok ? 'Backend API connection successful' : `Backend API error: ${response.status} ${response.statusText}`
      };
      
      setConnectionStatus(connectionStatus);
      
      if (connectionStatus.success) {
        // For now, we'll just set placeholder data
        // In a real implementation, these would come from API calls
        setBackends([
          { id: 'backend', name: 'Vector DB Backend', type: 'api' }
        ]);
        setCollections([
          { id: 'docs', name: 'Documents Collection', tags: ['documents', 'text'] }
        ]);
      } else {
        setError('Cannot connect to backend API. Please check your Backend API URL settings.');
      }
    } catch (err) {
      setError(`Error loading vector database configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnectionStatus({
        success: false,
        message: 'Failed to connect to backend API'
      });
    } finally {
      setLoading(false);
    }
  };

  // Test backend connection
  const testBackendConnection = async () => {
    setIsTestingConnection(true);
    
    try {
      // Simple health check
      const response = await fetch(`${apiEndpoint}/health`, {
        method: 'GET',
      });
      
      const result = {
        success: response.ok,
        message: response.ok ? 'Backend API connection successful' : `Backend API error: ${response.status} ${response.statusText}`
      };
      
      setConnectionStatus(result);
      
      if (result.success) {
        // Reload data if connection is successful
        loadBackendData();
      }
    } catch (err) {
      setConnectionStatus({
        success: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Get icon for backend type
  const getBackendIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pinecone':
      case 'openai':
      case 'azure':
        return <CloudIcon />;
      default:
        return <StorageIcon />;
    }
  };

  // Render list of available backends
  const renderBackends = () => {
    if (backends.length === 0) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No vector database backends available from the API.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Make sure your backend API is running and properly configured.
          </Typography>
        </Paper>
      );
    }

    return (
      <List>
        {backends.map((backend) => (
          <Paper key={backend.id} sx={{ mb: 2, overflow: 'hidden' }}>
            <ListItem>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getBackendIcon(backend.type)}
                    <Typography variant="subtitle1" sx={{ ml: 1 }}>
                      {backend.name}
                    </Typography>
                    <Chip 
                      label="Active" 
                      size="small" 
                      color="success" 
                      sx={{ ml: 1 }} 
                    />
                  </Box>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    Type: {backend.type}
                  </Typography>
                }
              />
            </ListItem>
          </Paper>
        ))}
      </List>
    );
  };

  // Render list of available collections
  const renderCollections = () => {
    if (collections.length === 0) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No document collections available from the API.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Upload documents to your backend service to make them available for queries.
          </Typography>
        </Paper>
      );
    }

    return (
      <List>
        {collections.map((collection) => (
          <Paper key={collection.id} sx={{ mb: 2, overflow: 'hidden' }}>
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="subtitle1">
                    {collection.name}
                  </Typography>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    {collection.tags && collection.tags.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {collection.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                }
              />
            </ListItem>
          </Paper>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Vector Database Configuration
          <Tooltip title="Configure connection to the backend API for vector search">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={loadBackendData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowConnectionDialog(true)}
          >
            Test Connection
          </Button>
        </Box>
      </Box>

      {/* Backend API connection status */}
      {connectionStatus && (
        <Alert 
          severity={connectionStatus.success ? "success" : "error"}
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={testBackendConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? <CircularProgress size={16} /> : "Retry"}
            </Button>
          }
        >
          {connectionStatus.message}
        </Alert>
      )}

      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error message */}
      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* API configuration info */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1">Backend API Configuration</Typography>
        <Typography variant="body2">
          Backend API Endpoint: {apiEndpoint}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          To change the backend API endpoint, update the "Backend API URL" in the API Configuration settings.
        </Typography>
      </Paper>

      {/* Vector database backends */}
      {!loading && !error && (
        <>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Available Vector Databases
          </Typography>
          {renderBackends()}
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Available Document Collections
          </Typography>
          {renderCollections()}
        </>
      )}

      {/* Connection test dialog */}
      <Dialog open={showConnectionDialog} onClose={() => setShowConnectionDialog(false)}>
        <DialogTitle>Backend API Connection</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: 300, py: 1 }}>
            {isTestingConnection ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={40} />
                <Typography sx={{ ml: 2 }}>Testing connection...</Typography>
              </Box>
            ) : (
              <>
                {connectionStatus && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    p: 2, 
                    bgcolor: connectionStatus.success ? 'success.light' : 'error.light', 
                    borderRadius: 1,
                    color: connectionStatus.success ? 'success.dark' : 'error.dark'
                  }}>
                    {connectionStatus.success ? (
                      <CheckCircleIcon sx={{ mr: 1 }} />
                    ) : (
                      <ErrorIcon sx={{ mr: 1 }} />
                    )}
                    <Typography>
                      {connectionStatus.message}
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" sx={{ mt: 2 }}>
                  Backend API Endpoint: {apiEndpoint}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  You can change the backend API endpoint in the API Configuration settings.
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={testBackendConnection} 
            variant="outlined"
            disabled={isTestingConnection}
          >
            Retry Test
          </Button>
          <Button onClick={() => setShowConnectionDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 