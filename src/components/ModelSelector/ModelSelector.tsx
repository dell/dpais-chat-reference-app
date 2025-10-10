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

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Select, MenuItem, FormControl, InputLabel, Box, Chip, Typography } from '@mui/material';
import { useAppSelector, useAppDispatch, setCurrentModel } from '../../store/store';

interface Model {
  id: string;
  name: string;
  enabled: boolean;
  isDefault?: boolean;
  tag?: string;
}

export const ModelSelector: React.FC = () => {
    const dispatch = useAppDispatch();
    const selectedModel = useAppSelector(state => state.chat.currentModel);
    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    
    useEffect(() => {
        // Load models from settings
        const fetchModels = () => {
            const savedSettings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
            const enabledModels = savedSettings.enabledModels || {};
            const defaultModel = savedSettings.defaultModel || 'phi3:phi3-mini-4k';
            const modelTags = savedSettings.modelTags || {};
            
            // Get the list of models
            if (savedSettings.availableModels && savedSettings.availableModels.length > 0) {
                const models: Model[] = savedSettings.availableModels.map((modelId: string) => ({
                    id: modelId,
                    name: getModelDisplayName(modelId),
                    enabled: enabledModels[modelId] !== false, // Default to enabled unless explicitly disabled
                    isDefault: modelId === defaultModel,
                    tag: modelTags[modelId] || null
                }));
                setAvailableModels(models);
                
                // Check if current selected model is valid
                const isCurrentModelValid = selectedModel && models.some(model => model.id === selectedModel && model.enabled);
                
                // Prioritize setting model based on these conditions:
                // 1. If current model is invalid or empty, and we have a default model that exists in available models
                // 2. If current model is invalid or empty, select first enabled model
                // 3. If current model is the old fallback, replace it with the new default
                
                if (defaultModel && models.some(model => model.id === defaultModel && model.enabled)) {
                    // If we have a valid default model and (no current selection OR current selection is invalid OR it's the old fallback)
                    if (!selectedModel || !isCurrentModelValid || selectedModel === 'deepseek-r1:7b' || selectedModel === 'phi3:phi3-mini-4k') {
                        dispatch(setCurrentModel(defaultModel));
                        console.log('Set model to default:', defaultModel);
                    }
                } else if (!isCurrentModelValid && models.length > 0) {
                    // If no valid default but we have models, select the first enabled model
                    const firstEnabledModel = models.find((model: Model) => model.enabled);
                    if (firstEnabledModel) {
                        dispatch(setCurrentModel(firstEnabledModel.id));
                        console.log('Set model to first available:', firstEnabledModel.id);
                    }
                }
            } else {
                // Fallback to hardcoded models if none available
                setAvailableModels([]);
            }
        };
        
        fetchModels();
        
        // Listen for settings changes
        const handleSettingsUpdate = () => {
            fetchModels();
        };
        
        window.addEventListener('settings-updated', handleSettingsUpdate);
        return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
    }, [dispatch, selectedModel]);
    
    // Convert model ID to display name
    const getModelDisplayName = (modelId: string): string => {
        // First remove compute-type prefix if present
        let displayName = modelId;
        const prefixes = ['public-cloud/', 'private-cloud/', 'edge/', 'GPU/', 'iGPU/', 'NPU/', 'CPU/', 'dNPU/'];
        
        for (const prefix of prefixes) {
            if (displayName.startsWith(prefix)) {
                displayName = displayName.substring(prefix.length);
                break;
            }
        }
        // If no prefix was found, the displayName is already correct (model without compute prefix)
        
        // Then parse remaining model ID for the name part
        const parts = displayName.split(':');
        if (parts.length >= 2) {
            // Just return the model name part, without the parameter size
            const model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            return model;
        }
        return displayName;
    };
    
    // Extract parameter size from model ID if present
    const getParameterSize = (modelId: string): string | null => {
        const parts = modelId.split(':');
        if (parts.length >= 2) {
            return parts[1]; // Return the parameter size part
        }
        return null;
    };

    const handleModelChange = (event: React.ChangeEvent<{ value: unknown }>) => {
        const modelId = event.target.value as string;
        dispatch(setCurrentModel(modelId));
    };

    // Only show enabled models and sort alphabetically by model name
    const enabledModels = availableModels
        .filter(model => model.enabled)
        .sort((a, b) => {
            // Get display names without compute type prefix
            const nameA = getModelDisplayName(a.id).toLowerCase();
            const nameB = getModelDisplayName(b.id).toLowerCase();
            return nameA.localeCompare(nameB);
        });

    // Helper function to get tag color based on compute location
    const getTagColor = (tag: string): string => {
        switch(tag) {
            case 'public-cloud':
                return 'info';
            case 'private-cloud':
                return 'success';
            case 'edge':
                return 'primary';
            case 'GPU':
                return 'error';
            case 'iGPU':
                return 'secondary'; // Use secondary color (purple) for iGPU
            case 'NPU':
                return 'warning';
            case 'CPU':
                return 'default';
            case 'dNPU':
                return 'warning';
            default:
                return 'default';
        }
    };

    return (
        <FormControl 
            variant="outlined" 
            size="small"
            sx={{
                minWidth: 150,
                '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'background.paper',
                    fontSize: '0.875rem',
                }
            }}
        >
            <InputLabel id="model-select-label">Model</InputLabel>
            <Select
                labelId="model-select-label"
                label="Model"
                sx={{
                    width: '18vw',
                    maxWidth: '400px',
                    height: '6vh'
                }}
                value={selectedModel}
                onChange={handleModelChange as any}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            '& .MuiMenuItem-root': {
                                py: 0.75
                            }
                        }
                    }
                }}
            >
                {enabledModels.map(model => {
                    const paramSize = getParameterSize(model.id);
                    return (
                        <MenuItem key={model.id} value={model.id}>
                            <Box sx={{ 
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center',
                                flexWrap: 'nowrap'
                            }}>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        fontWeight: selectedModel === model.id ? 'bold' : 'medium',
                                        flexShrink: 0,
                                        marginRight: 1,
                                        minWidth: '100px'
                                    }}
                                >
                                    {model.name}
                                </Typography>
                                <Box sx={{ 
                                    display: 'flex', 
                                    gap: 0.5, 
                                    flexWrap: 'wrap',
                                    flex: 1,
                                    justifyContent: 'flex-end'
                                }}>
                                    {model.isDefault && (
                                        <Chip 
                                            size="small" 
                                            label="Default" 
                                            color="secondary" 
                                            variant="outlined" 
                                            sx={{ 
                                                height: 18, 
                                                fontSize: '0.65rem',
                                                '& .MuiChip-label': { 
                                                    px: 0.8,
                                                    py: 0
                                                }
                                            }}
                                        />
                                    )}
                                    {model.tag && (
                                        <Chip 
                                            size="small" 
                                            label={model.tag} 
                                            color={getTagColor(model.tag) as any}
                                            variant="outlined" 
                                            sx={{ 
                                                height: 18, 
                                                fontSize: '0.65rem',
                                                '& .MuiChip-label': { 
                                                    px: 0.8,
                                                    py: 0
                                                }
                                            }}
                                        />
                                    )}
                                    {paramSize && (
                                        <Chip 
                                            size="small" 
                                            label={paramSize} 
                                            color="primary"
                                            variant="outlined" 
                                            sx={{ 
                                                height: 18, 
                                                fontSize: '0.65rem',
                                                '& .MuiChip-label': { 
                                                    px: 0.8,
                                                    py: 0
                                                }
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        </MenuItem>
                    );
                })}
            </Select>
        </FormControl>
    );
};