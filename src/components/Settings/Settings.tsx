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
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Grid,
  Paper,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Slider,
  FormHelperText,
  Alert,
  Chip
} from '@mui/material';
import { ThemeConfig, DEFAULT_THEMES } from '../../theme/themeConfig';
import { DocumentUpload } from '../DocumentUpload/DocumentUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloudIcon from '@mui/icons-material/Cloud';
import DatabaseIcon from '@mui/icons-material/Storage';
import { DocumentLibrary } from '../DocumentLibrary/DocumentLibrary';
import { VectorDatabaseSettings } from './VectorDatabaseSettings';
import { vectorDbService } from '../../services/VectorDbService';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { ModelService } from '../../services/ModelService';

// Custom color picker component
const ColorPickerInput: React.FC<{
  label: string;
  color: string;
  onChange: (color: string) => void;
}> = ({ label, color, onChange }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box 
          sx={{ 
            width: 36, 
            height: 36, 
            borderRadius: 1, 
            bgcolor: color,
            border: '1px solid',
            borderColor: theme => theme.palette.divider
          }} 
        />
        <TextField
          type="text"
          size="small"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 120 }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 40, height: 40, padding: 0, border: 'none' }}
        />
      </Box>
    </Box>
  );
};

// Interfaces
interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export interface AppSettings {
  apiBaseUrl: string;
  backendApiUrl: string;
  apiKey: string;
  selectedTheme: string;
  customTheme?: ThemeConfig;
  availableModels: string[];
  systemMessage: string;
  documentChunkSize: number;
  documentOverlap: number;
  maxDocumentsRetrieved: number;
  embeddingsModel?: string;
  strictRagMode?: boolean;
  showDocumentSources?: boolean;
  enabledModels?: Record<string, boolean>;
  defaultModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
  vectorDbConfigs?: any[];
  modelTags?: Record<string, string>;
  modelCapabilities?: Record<string, string>;
  downloadsPath?: string;
  companyDocumentsEnabled?: boolean;
  streamEnabled?: boolean;
  documentProcessingBatchSize?: number;
}

export const Settings: React.FC<SettingsProps> = ({ 
  open, 
  onClose, 
  onSave,
  currentSettings
}) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [activeTab, setActiveTab] = useState('api');
  const [systemMessage, setSystemMessage] = useState('');
  const [documentChunkSize, setDocumentChunkSize] = useState(1000);
  const [documentOverlap, setDocumentOverlap] = useState(200);
  const [maxDocumentsRetrieved, setMaxDocumentsRetrieved] = useState(5);
  const [vectorDbCount, setVectorDbCount] = useState(0);

  // Effect to reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSettings(currentSettings);
      setTestResult(null);
      
      // Initialize custom theme if not present
      if (currentSettings.selectedTheme === 'custom' && !currentSettings.customTheme) {
        setSettings({
          ...currentSettings,
          customTheme: { ...DEFAULT_THEMES.dark } // Start with dark theme as base
        });
      }
      
      // Load vector database counts
      const configs = vectorDbService.getConfigurations();
      setVectorDbCount(configs.length);
    }
  }, [open, currentSettings]);

  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    
    // Load existing settings
    setSettings(prev => ({
      ...prev,
      apiBaseUrl: savedSettings.apiBaseUrl || '',
      apiKey: savedSettings.apiKey || '',
      systemMessage: savedSettings.systemMessage || '',
      documentChunkSize: savedSettings.documentChunkSize || 1000,
      documentOverlap: savedSettings.documentOverlap || 200,
      maxDocumentsRetrieved: savedSettings.maxDocumentsRetrieved || 5,
      embeddingsModel: savedSettings.embeddingsModel || 'nomic-embed-text-v1.5',
      enabledModels: savedSettings.enabledModels || {},
      defaultModel: savedSettings.defaultModel || 'phi3:phi3-mini-4k',
      availableModels: savedSettings.availableModels || [],
      ttsModel: savedSettings.ttsModel || 'kokoro',
      ttsVoice: savedSettings.ttsVoice || 'af_jessic',
      strictRagMode: savedSettings.strictRagMode || false,
      showDocumentSources: savedSettings.showDocumentSources !== false,
      modelTags: savedSettings.modelTags || {},
      modelCapabilities: savedSettings.modelCapabilities || {},
      downloadsPath: savedSettings.downloadsPath || '',
      companyDocumentsEnabled: savedSettings.companyDocumentsEnabled || false,
      streamEnabled: savedSettings.streamEnabled !== false,
      documentProcessingBatchSize: savedSettings.documentProcessingBatchSize || 20
    }));
    
    // Set system message
    setSystemMessage(savedSettings.systemMessage || '');
    
    // Set document settings
    setDocumentChunkSize(savedSettings.documentChunkSize || 1000);
    setDocumentOverlap(savedSettings.documentOverlap || 200);
    setMaxDocumentsRetrieved(savedSettings.maxDocumentsRetrieved || 5);
    
    // Also set available models from cached settings
    if (savedSettings.availableModels) {
      setAvailableModels(savedSettings.availableModels);
    }
    
    // If we have API settings, try to fetch fresh models
    if (savedSettings.apiBaseUrl && savedSettings.apiKey) {
      // Use setTimeout to ensure this runs after the component is fully mounted
      setTimeout(() => {
        fetchModels(true);
      }, 500);
    }
  }, []);

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    
    // If changing theme type to custom, initialize customTheme if not present
    if (field === 'selectedTheme' && value === 'custom' && !settings.customTheme) {
      setSettings(prev => ({ 
        ...prev, 
        [field]: value, 
        customTheme: { ...DEFAULT_THEMES.dark } 
      }));
    }
    
    setTestResult(null); // Clear test results on change
  };

  const handleCustomThemeChange = (property: keyof ThemeConfig, value: string) => {
    setSettings(prev => ({
      ...prev,
      customTheme: {
        ...(prev.customTheme || DEFAULT_THEMES.dark),
        [property]: value
      }
    }));
  };

  const handlePreviewTheme = (preset: keyof typeof DEFAULT_THEMES) => {
    setSettings(prev => ({
      ...prev,
      customTheme: { ...DEFAULT_THEMES[preset] }
    }));
  };

  const fetchModels = async (silent = false) => {
    if (!settings.apiBaseUrl || !settings.apiKey) return;
    
    if (!silent) setIsTesting(true);
    if (!silent) setTestResult(null);
    
    try {
      const result = await ModelService.fetchModels(settings.apiBaseUrl, settings.apiKey, silent);
      
      if (result.success && result.models) {
        // Store models in local state
        setAvailableModels(result.models);
        
        if (!silent) {
          setTestResult({
            success: true,
            message: result.message
          });
        }
        
        // Update settings with fetched data
        const updatedSettings = { 
          ...settings,
          availableModels: result.models,
          modelTags: result.modelTags || {},
          modelCapabilities: result.modelCapabilities || {},
          enabledModels: result.updatedEnabledModels || {}
        };
        
        setSettings(updatedSettings);
        
        // Save to localStorage immediately so ModelSelector can access it
        const savedSettings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
        localStorage.setItem('chatAppSettings', JSON.stringify({
          ...savedSettings,
          availableModels: updatedSettings.availableModels,
          modelTags: result.modelTags || {},
          modelCapabilities: result.modelCapabilities || {},
          enabledModels: result.updatedEnabledModels || {}
        }));
        
        // Dispatch event to notify components about settings change
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } else {
        if (!silent) {
          setTestResult({
            success: false,
            message: result.message
          });
        }
      }
    } catch (error) {
      if (!silent) {
        setTestResult({
          success: false,
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } finally {
      if (!silent) setIsTesting(false);
    }
  };

  const handleTestConnection = () => {
    fetchModels(false);
  };

  const handleSave = () => {
    const updatedSettings = {
      ...settings,
      systemMessage,
      documentChunkSize,
      documentOverlap,
      maxDocumentsRetrieved,
      strictRagMode: settings.strictRagMode || false,
      showDocumentSources: settings.showDocumentSources !== false,
      modelTags: settings.modelTags || {},
      modelCapabilities: settings.modelCapabilities || {},
      companyDocumentsEnabled: settings.companyDocumentsEnabled || false,
      streamEnabled: settings.streamEnabled !== false,
      documentProcessingBatchSize: settings.documentProcessingBatchSize || 20
    };
    
    localStorage.setItem('chatAppSettings', JSON.stringify(updatedSettings));
    
    // Dispatch a custom event to notify components about settings changes
    window.dispatchEvent(new CustomEvent('settings-updated'));
    
    onSave(updatedSettings);
    onClose();
  };

  // Preview of the custom theme
  const renderThemePreview = () => {
    const theme = settings.customTheme || DEFAULT_THEMES.light;
    
    return (
      <Paper
        sx={{
          p: 2,
          backgroundColor: theme.paper,
          color: theme.text,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Typography variant="h6" sx={{ color: theme.text, mb: 1 }}>
          Theme Preview
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button
            size="small"
            sx={{ backgroundColor: theme.primary, color: '#fff' }}
          >
            Primary Button
          </Button>
          <Button
            size="small"
            sx={{ backgroundColor: theme.secondary, color: '#fff' }}
          >
            Secondary
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ borderColor: theme.accent, color: theme.accent }}
          >
            Accent
          </Button>
        </Box>
        <Box 
          sx={{ 
            backgroundColor: theme.background, 
            p: 1, 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'rgba(0,0,0,0.1)',
          }}
        >
          <Typography variant="body2" sx={{ color: theme.text }}>
            Sample text on background
          </Typography>
        </Box>
      </Paper>
    );
  };

  // Handle vector database configuration changes
  const handleVectorDbConfigChange = () => {
    // Update the vector database count
    const configs = vectorDbService.getConfigurations();
    setVectorDbCount(configs.length);
  };

  // Add effect to load models when dialog opens or tab changes
  useEffect(() => {
    if (open && activeTab === 'api' && settings.apiBaseUrl && settings.apiKey) {
      fetchModels(true); // Silent fetch on load
    }
  }, [open, activeTab, settings.apiBaseUrl, settings.apiKey]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh', // Fixed height as 80% of viewport height
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>Settings</DialogTitle>
      <DialogContent 
        dividers
        sx={{ 
          flex: 1,
          overflow: 'auto', // Enable scrolling
          padding: 2
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="API Configuration" value="api" />
            <Tab label="Appearance" value="appearance" />
            <Tab label="Assistant" value="assistant" />
            <Tab label="Documents" value="documents" />
            <Tab 
              label="Vector Databases" 
              value="vectorDb" 
              icon={vectorDbCount > 0 ? <CloudIcon fontSize="small" /> : undefined}
              iconPosition="end"
            />
          </Tabs>
        </Box>

        {activeTab === 'api' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* API Configuration Section */}
            <Typography variant="h6" gutterBottom>
              API Configuration
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Configure your API settings here. The system uses two separate API endpoints: one for AI generation (LLM API) and one for document retrieval (Backend API).
            </Alert>
            
            {/* LLM API Section */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              LLM API Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              These settings control where chat messages and completions are sent for AI text generation.
            </Typography>
            
            <TextField
              label="LLM API Base URL"
              value={settings.apiBaseUrl}
              onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              helperText="The URL for LLM text generation (e.g., http://localhost:8553/v1/openai for Dell Pro AI Studio)"
            />
            
            <TextField
              label="API Key"
              value={settings.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              type="password"
              helperText="API key for authentication (use 'dpais' for Dell Pro AI Studio)"
            />
            
            {/* Backend API Section */}
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Backend API Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              These settings control document retrieval, embeddings, and other vector database operations.
            </Typography>
            
            <TextField
              label="Backend API URL"
              value={settings.backendApiUrl || 'http://localhost:8000'}
              onChange={(e) => handleChange('backendApiUrl', e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              helperText="URL for the document retrieval backend API (e.g., http://localhost:8000)"
            />
            
            <TextField
              label="Embeddings Model"
              value={settings.embeddingsModel || 'nomic-embed-text'}
              onChange={(e) => handleChange('embeddingsModel', e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              helperText="Model to use for embeddings (e.g., nomic-embed-text, nomic-embed-text-v1.5)"
            />
            
            {/* Company Documents Toggle */}
            <Box sx={{ mt: 2, mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.companyDocumentsEnabled || false}
                    onChange={(e) => handleChange('companyDocumentsEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Company Documents"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 7 }}>
                Show the Company Documents tab for accessing backend vector databases
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button 
                variant="outlined" 
                onClick={handleTestConnection}
                disabled={isTesting || !settings.apiBaseUrl}
                startIcon={isTesting ? <CircularProgress size={20} /> : null}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              
              {testResult && (
                <Typography 
                  variant="body2" 
                  color={testResult.success ? 'success.main' : 'error.main'}
                >
                  {testResult.message}
                </Typography>
              )}
            </Box>
            
            {/* Available Models Section */}
            {(availableModels.length > 0 || settings.availableModels?.length > 0) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Available Models
                  {isTesting && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </Typography>
                
                <Paper variant="outlined" sx={{ maxHeight: '300px', overflow: 'auto', p: 1 }}>
                  <List dense sx={{ width: '100%' }}>
                    {(availableModels.length > 0 ? availableModels : (settings.availableModels || [])).map((modelId) => {
                      // Get display name without compute type prefix and without parameter size
                      let displayName = modelId;
                      const prefixes = ['public-cloud/', 'private-cloud/', 'GPU/', 'iGPU/', 'NPU/', 'CPU/', 'dNPU/'];
                      let hasPrefix = false;
                      
                      for (const prefix of prefixes) {
                        if (displayName.startsWith(prefix)) {
                          displayName = displayName.substring(prefix.length);
                          hasPrefix = true;
                          break;
                        }
                      }
                      // If no prefix was found, the displayName is already correct (model without compute prefix)
                      
                      // Extract the model name and parameter size
                      const parts = displayName.split(':');
                      let modelName, paramSize;
                      
                      if (parts.length >= 2) {
                        modelName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                        paramSize = parts[1];
                      } else {
                        modelName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                        paramSize = null;
                      }
                      
                      // Get the current enabled state (default to true if not specified)
                      const enabled = settings.enabledModels?.[modelId] !== false;
                      
                      // Check if this is the default model
                      const isDefault = settings.defaultModel === modelId;
                      
                      // Get compute location tag if available
                      // If tag is not available in settings but we know it doesn't have a prefix, assume NPU
                      const tag = settings.modelTags?.[modelId] || (!hasPrefix ? 'NPU' : undefined);
                      
                      // Get model capability (if available)
                      const capability = settings.modelCapabilities?.[modelId];
                      
                      // Check if model can be toggled (only TextToText or TextToTextWithTools models)
                      const canBeToggled = capability === 'TextToText' || capability === 'TextToTextWithTools';

                      // Helper function to get tag color based on compute location
                      const getTagColor = (tagValue: string): string => {
                        switch(tagValue) {
                          case 'public-cloud': return 'info';
                          case 'private-cloud': return 'success';
                          case 'GPU': return 'error';
                          case 'iGPU': return 'secondary'; // Use secondary color (purple) for iGPU
                          case 'NPU': return 'warning';
                          case 'CPU': return 'default';
                          case 'dNPU': return 'warning';
                          default: return 'default';
                        }
                      };
                      
                      return (
                        <ListItem
                          key={modelId}
                          sx={{
                            py: 0.5,
                            display: 'grid',
                            gridTemplateColumns: '56px minmax(140px, 0.8fr) minmax(180px, 1.2fr) 100px',
                            alignItems: 'center',
                            gap: 0,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': {
                              borderBottom: 'none'
                            }
                          }}
                          disableGutters
                        >
                          {/* Column 1: Toggle Switch */}
                          <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
                            <Switch 
                              size="small"
                              checked={enabled}
                              disabled={!canBeToggled}
                              onChange={(e) => {
                                const newEnabledModels = {
                                  ...(settings.enabledModels || {}),
                                  [modelId]: e.target.checked
                                };
                                handleChange('enabledModels', newEnabledModels);
                                
                                // If disabling the default model, clear the default
                                if (!e.target.checked && isDefault) {
                                  handleChange('defaultModel', '');
                                }
                              }}
                            />
                          </Box>
                          
                          {/* Column 2: Model Name */}
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: enabled ? 'medium' : 'normal',
                              opacity: canBeToggled ? 1 : 0.7,
                              pl: 1,
                              pr: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {modelName}
                          </Typography>
                          
                          {/* Column 3: Tags/Chips */}
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 0.75, 
                            flexWrap: 'wrap',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            pl: 0
                          }}>
                            {tag && (
                              <Chip 
                                size="small"
                                label={tag}
                                color={getTagColor(tag) as any}
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                            {paramSize && (
                              <Chip 
                                size="small"
                                label={paramSize}
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                            {capability && capability !== 'TextToText' && capability !== 'TextToTextWithTools' && (
                              <Chip 
                                size="small"
                                label={capability}
                                color="default"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem', opacity: 0.7 }}
                              />
                            )}
                          </Box>
                          
                          {/* Column 4: Default Switch */}
                          <Box sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: canBeToggled ? 'flex-start' : 'center',
                            pr: 1
                          }}>
                            {canBeToggled && (
                              <FormControlLabel
                                control={
                                  <Switch
                                    size="small"
                                    checked={isDefault}
                                    disabled={!enabled}
                                    color="secondary"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Set this as the default model
                                        handleChange('defaultModel', modelId);
                                      } else if (isDefault) {
                                        // If unchecking the current default, clear it
                                        handleChange('defaultModel', '');
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Typography 
                                    variant="caption" 
                                    color="secondary"
                                    sx={{ opacity: enabled ? 1 : 0.5 }}
                                  >
                                    Default
                                  </Typography>
                                }
                                sx={{ m: 0 }}
                              />
                            )}
                          </Box>
                        </ListItem>
                      );
                    })}
                  </List>
                </Paper>
              </>
            )}
          </Box>
        )}

        {activeTab === 'appearance' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Theme Selection */}
            <Typography variant="h6" gutterBottom>
              Appearance
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="theme-select-label">Theme</InputLabel>
              <Select
                labelId="theme-select-label"
                value={settings.selectedTheme}
                onChange={(e) => handleChange('selectedTheme', e.target.value)}
                label="Theme"
              >
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
                <MenuItem value="oled">OLED Black</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            
            {/* Custom Theme Editor - only show if custom theme selected */}
            {settings.selectedTheme === 'custom' && settings.customTheme && (
              <Box sx={{ mt: 2, p: 0 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Custom Theme Editor
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Start from preset:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handlePreviewTheme('light')}
                          >
                            Light
                          </Button>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handlePreviewTheme('dark')}
                          >
                            Dark
                          </Button>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={() => handlePreviewTheme('oled')}
                          >
                            OLED
                          </Button>
                        </Box>
                      </Box>
                      
                      <Divider sx={{ mb: 2 }} />
                      
                      <ColorPickerInput
                        label="Primary"
                        color={settings.customTheme.primary}
                        onChange={(value) => handleCustomThemeChange('primary', value)}
                      />
                      <ColorPickerInput
                        label="Secondary"
                        color={settings.customTheme.secondary}
                        onChange={(value) => handleCustomThemeChange('secondary', value)}
                      />
                      <ColorPickerInput
                        label="Accent"
                        color={settings.customTheme.accent}
                        onChange={(value) => handleCustomThemeChange('accent', value)}
                      />
                      <ColorPickerInput
                        label="Background"
                        color={settings.customTheme.background}
                        onChange={(value) => handleCustomThemeChange('background', value)}
                      />
                      <ColorPickerInput
                        label="Paper"
                        color={settings.customTheme.paper}
                        onChange={(value) => handleCustomThemeChange('paper', value)}
                      />
                      <ColorPickerInput
                        label="Text"
                        color={settings.customTheme.text}
                        onChange={(value) => handleCustomThemeChange('text', value)}
                      />
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    {renderThemePreview()}
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        )}

        {activeTab === 'assistant' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* System Message Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="settings-section-title">
                  <SmartToyIcon sx={{ mr: 1 }} />
                  AI Assistant Behavior
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="subtitle2" gutterBottom>
                  System Message
                  <Tooltip title="This message defines how the AI assistant behaves">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  placeholder="You are a state-of-the-art AI assistant renowned for accuracy, clarity, and thoughtful insights. Your mission is to provide detailed, well-reasoned answers that are both user-friendly and reliable. Always interpret the user's intent carefully—if a query is ambiguous, ask clarifying questions before responding. When uncertain about a fact, admit 'I don't know' rather than guessing. Use a professional, yet warm tone, break down complex topics into understandable steps, and maintain consistency in style. Prioritize factual accuracy, and if new information is requested that falls outside your training, state your limitations clearly."
                  value={systemMessage}
                  onChange={(e) => setSystemMessage(e.target.value)}
                  helperText="Customize how the AI assistant behaves. Leave blank to use the default behavior."
                  margin="normal"
                />
              </AccordionDetails>
            </Accordion>
            
            {/* Text-to-Speech Settings Section */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="settings-section-title">
                  <VolumeUpIcon sx={{ mr: 1 }} />
                  Text-to-Speech Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="tts-model-label">TTS Model</InputLabel>
                      <Select
                        labelId="tts-model-label"
                        value={settings.ttsModel || 'kokoro'}
                        onChange={(e) => handleChange('ttsModel', e.target.value)}
                        label="TTS Model"
                      >
                        <MenuItem value="kokoro">Kokoro</MenuItem>
                        <MenuItem value="audio-nova">Audio Nova</MenuItem>
                        <MenuItem value="tts-1">TTS-1</MenuItem>
                        <MenuItem value="tts-1-hd">TTS-1-HD</MenuItem>
                      </Select>
                      <FormHelperText>Model used for text-to-speech conversion</FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="tts-voice-label">TTS Voice</InputLabel>
                      <Select
                        labelId="tts-voice-label"
                        value={settings.ttsVoice || 'af_jessic'}
                        onChange={(e) => handleChange('ttsVoice', e.target.value)}
                        label="TTS Voice"
                      >
                        <MenuItem value="af_jessic">Jessic (Female)</MenuItem>
                        <MenuItem value="shimmer">Shimmer</MenuItem>
                        <MenuItem value="alloy">Alloy</MenuItem>
                        <MenuItem value="echo">Echo</MenuItem>
                        <MenuItem value="fable">Fable</MenuItem>
                        <MenuItem value="onyx">Onyx</MenuItem>
                        <MenuItem value="nova">Nova</MenuItem>
                      </Select>
                      <FormHelperText>Voice used for text-to-speech conversion</FormHelperText>
                    </FormControl>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
            
            {/* RAG Settings Section */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="settings-section-title">
                  <ArticleIcon sx={{ mr: 1 }} />
                  RAG Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.strictRagMode === true}
                        onChange={(e) => handleChange('strictRagMode', e.target.checked)}
                      />
                    }
                    label="Strict RAG Mode"
                  />
                  <Typography variant="body2" color="text.secondary">
                    When enabled, the assistant will only use information explicitly stated in the retrieved documents and will not use its general knowledge.
                  </Typography>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showDocumentSources !== false}
                        onChange={(e) => handleChange('showDocumentSources', e.target.checked)}
                      />
                    }
                    label="Show Document Sources"
                  />
                  <Typography variant="body2" color="text.secondary">
                    When enabled, the assistant will cite document sources in its responses.
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
            
            {/* LLM Response Settings */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="settings-section-title">
                  <SmartToyIcon sx={{ mr: 1 }} />
                  Response Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.streamEnabled !== false}
                        onChange={(e) => handleChange('streamEnabled', e.target.checked)}
                      />
                    }
                    label="Enable Streaming Responses"
                  />
                  <Typography variant="body2" color="text.secondary">
                    When enabled, responses will appear word by word as they are generated. When disabled, responses will appear all at once after completion.
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {activeTab === 'documents' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Document Processing Settings */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" className="settings-section-title">
                  <SettingsIcon sx={{ mr: 1 }} />
                  Document Processing Settings
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Batch Size for Document Processing
                    <Tooltip title="Number of document chunks to process simultaneously during upload. Higher values may be faster but use more memory.">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={settings.documentProcessingBatchSize || 20}
                      onChange={(e, value) => handleChange('documentProcessingBatchSize', value)}
                      min={5}
                      max={2000}
                      step={5}
                      marks={[
                        { value: 5, label: '5' },
                        { value: 20, label: '20' },
                        { value: 100, label: '100' },
                        { value: 500, label: '500' },
                        { value: 1000, label: '1000' },
                        { value: 2000, label: '2000' }
                      ]}
                      valueLabelDisplay="on"
                      sx={{ width: '100%' }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Current batch size: {settings.documentProcessingBatchSize || 20} chunks per batch
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
            
            {/* Document Library */}
            <Box sx={{ 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              height: '400px',
              overflow: 'hidden'
            }}>
              <Typography variant="subtitle1" sx={{ 
                p: 2, 
                pb: 1, 
                borderBottom: '1px solid',
                borderBottomColor: 'divider'
              }}>
                Document Library
              </Typography>
              <Box sx={{ height: 'calc(100% - 48px)', overflow: 'auto' }}>
                <DocumentLibrary />
              </Box>
            </Box>
          </Box>
        )}
        
        {activeTab === 'vectorDb' && (
          <Box sx={{ mt: 2 }}>
            <VectorDatabaseSettings onConfigurationChange={handleVectorDbConfigChange} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: '1px solid',
        borderColor: 'divider',
        padding: 1.5,
        mt: 'auto' // Push to bottom
      }}>
        <Button onClick={onClose}>Close</Button>
        {activeTab !== 'documents' && (
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
          >
            Save
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};