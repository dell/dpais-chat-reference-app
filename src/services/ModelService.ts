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

import { store } from '../store/store';
import { getSettings, saveSettings } from '../utils/settings';

interface Model {
  id: string;
  tags: Array<string> | null;
  capability: string | null;
  isTextToTextModel: boolean;
  baseName: string;
}

interface FetchModelsResult {
  success: boolean;
  message: string;
  models?: string[];
  modelTags?: Record<string, Array<string>>;
  modelCapabilities?: Record<string, string>;
  updatedEnabledModels?: Record<string, boolean>;
}

export class ModelService {
  static async fetchModels(apiBaseUrl: string, apiKey: string, silent = false): Promise<FetchModelsResult> {
    if (!apiBaseUrl || !apiKey) {
      return {
        success: false,
        message: 'API URL and key are required'
      };
    }

    try {
      // Add timeout to handle offline scenarios better
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${apiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched models:', data);

        const mappedModels = data.data.map((model: any) => {
          // Extract compute location tag from model ID
          let tags = [];
          const id = model.id;

          const knownTags = [
            'public-cloud',
            'private-cloud',
            'foundry-local',
            'ollama',
            'edge',
            'GPU',
            'iGPU',
            'dGPU',
            'NPU',            
            'dNPU',
            'CPU',
          ]

          let baseName = id;

          while (true) {
            let anyMatch = false;
            knownTags.forEach((tag) => {
              if (baseName.startsWith(tag)) {
                anyMatch = true;
                let tagName = tag;
                if (tagName == 'dGPU') {
                    tagName = 'iGPU';
                } else if (tagName == 'foundry-local') {
                    tagName = 'Foundry Local';
                }
                tags.push(tagName);
                const prefix = `${tag}/`
                baseName = baseName.substring(prefix.length);
              }
            });
            if (!anyMatch) break;
          }

          // Determine if model is a text generation model
          // Handle capability as either string or array
          let capability = null;
          let isTextToTextModel = false;

          if (Array.isArray(model.capability) && model.capability.length > 0) {
            // If capability is an array, check if any element contains TextToText
            capability = model.capability[0];
            isTextToTextModel = model.capability.some((cap: string) =>
              cap && (cap.includes('TextToText') || cap.includes('TextToTextWithTools'))
            );
          } else if (typeof model.capability === 'string') {
            // If capability is a string, check if it contains TextToText
            capability = model.capability;
            isTextToTextModel = capability.includes('TextToText') || capability.includes('TextToTextWithTools');
          } else {
            capability = 'TextToTextWithTools';
            isTextToTextModel = true;
          }

          // Extract base model name (without compute prefix)

          return {
            id: id,
            tags: tags,
            capability: capability || null,
            isTextToTextModel: isTextToTextModel,
            baseName: baseName
          };
        });

        // Deduplicate models by base name, preferring TextToTextWithTools over TextToText
        const modelMap = new Map<string, Model>();
        mappedModels.forEach((model: Model) => {
          const existing = modelMap.get(model.id);
          if (!existing) {
            modelMap.set(model.id, model);
          } else {
            // If the new model has TextToTextWithTools and existing has only TextToText, replace
            if (model.capability && existing.capability &&
              model.capability.includes('TextToTextWithTools') &&
              existing.capability.includes('TextToText') &&
              !existing.capability.includes('TextToTextWithTools')) {
              modelMap.set(model.id, model);
            }
          }
        });

        // Convert back to array
        const models = Array.from(modelMap.values());

        // Create modelTags and modelCapabilities maps
        const modelTags = models.reduce((acc: Record<string, Array<string>>, model: Model) => {
          if (model.tags && model.tags.length > 0) {
            acc[model.id] = model.tags;
          }
          return acc;
        }, {});

        const modelCapabilities = models.reduce((acc: Record<string, string>, model: Model) => {
          if (model.capability) {
            acc[model.id] = model.capability;
          }
          return acc;
        }, {});

        // Get current settings to determine enabled models
        const savedSettings = getSettings();
        const currentEnabledModels = savedSettings.enabledModels || {};
        const updatedEnabledModels = { ...currentEnabledModels };

        // Set enabled state based on model capabilities
        models.forEach((model: Model) => {
          // If model is not a text generation model, ensure it's disabled
          if (!model.isTextToTextModel) {
            updatedEnabledModels[model.id] = false;
          }
          // If it is a text generation model and not already in settings, default to enabled
          else if (updatedEnabledModels[model.id] === undefined) {
            updatedEnabledModels[model.id] = true;
          }
        });

        return {
          success: true,
          message: `Connection successful! Found ${models.length} models.`,
          models: models.map(model => model.id),
          modelTags,
          modelCapabilities,
          updatedEnabledModels
        };
      } else {
        return {
          success: false,
          message: `Error: HTTP ${response.status} - ${response.statusText}`
        };
      }
    } catch (error) {
      // Check if it's an abort error (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timeout - Dell Pro AI Studio may be starting up or offline'
        };
      }

      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Initialize models on app startup with retry logic
   */
  static async initializeModels(): Promise<void> {
    const savedSettings = getSettings();

    // Only fetch if we have API settings and no models cached
    if (savedSettings.apiBaseUrl && savedSettings.apiKey && (!savedSettings.availableModels || savedSettings.availableModels.length === 0)) {
      console.log('Fetching models on app initialization...');

      let result: FetchModelsResult | null = null;
      let retryCount = 0;
      const maxRetries = 3;

      // Retry logic for better offline/startup handling
      while (retryCount < maxRetries && (!result || !result.success)) {
        result = await this.fetchModels(savedSettings.apiBaseUrl, savedSettings.apiKey, true);

        if (!result.success && retryCount < maxRetries - 1) {
          console.log(`Model fetch attempt ${retryCount + 1} failed, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        } else {
          break;
        }
      }

      if (result && result.success && result.models) {
        // Update settings with fetched models
        const updatedSettings = {
          ...savedSettings,
          availableModels: result.models,
          modelTags: result.modelTags || {},
          modelCapabilities: result.modelCapabilities || {},
          enabledModels: result.updatedEnabledModels || {}
        };

        // If no default model is set, set the first enabled text generation model as default
        if (!updatedSettings.defaultModel) {
          const firstEnabledModel = result.models.find(modelId =>
            result.updatedEnabledModels?.[modelId] === true
          );
          if (firstEnabledModel) {
            updatedSettings.defaultModel = firstEnabledModel;
            console.log('Set default model to:', firstEnabledModel);
          }
        }

        saveSettings(updatedSettings);

        // Dispatch event to notify components with the updated model info
        window.dispatchEvent(new CustomEvent('settings-updated', {
          detail: { defaultModel: updatedSettings.defaultModel }
        }));

        console.log('Models initialized successfully');
      } else {
        console.warn('Failed to fetch models on initialization:', result?.message || 'Unknown error');
      }
    }
  }
} 