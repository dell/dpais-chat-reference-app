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

import { ThemeOptions, PaletteMode } from '@mui/material';

export interface ThemeConfig {
  mode: PaletteMode;
  primary: string;
  secondary: string;
  background: string;
  paper: string;
  text: string;
  accent: string;
}

// Default themes
export const DEFAULT_THEMES = {
  light: {
    mode: 'light',
    primary: '#002A58',
    secondary: '#6366f1',
    background: '#ffffff',
    paper: '#f9fafb',
    text: '#213547',
    accent: '#646cff'
  } as ThemeConfig,

  dark: {
    mode: 'dark',
    primary: '#97DCF4',
    secondary: '#C47AF4',
    background: '#1e1e2e',
    paper: '#2a2a3c',
    text: '#e2e8f0',
    accent: '#818cf8'
  } as ThemeConfig,

  oled: {
    mode: 'dark',
    primary: '#61C1EB',
    secondary: '#C47AF4',
    background: '#000000',
    paper: '#000',
    text: '#f0f0f0',
    accent: '#00bfff'
  } as ThemeConfig
};

// Convert ThemeConfig to MUI ThemeOptions
export function createThemeOptions(config: ThemeConfig): ThemeOptions {
  // Helper to convert hex to rgb
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  };

  // Inject CSS variables into document root
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', config.primary);
    root.style.setProperty('--secondary-color', config.secondary);
    root.style.setProperty('--background-color', config.background);
    root.style.setProperty('--paper-color', config.paper);
    root.style.setProperty('--text-color', config.text);
    root.style.setProperty('--accent-color', config.accent);

    // Add RGB values for opacity support
    root.style.setProperty('--primary-color-rgb', hexToRgb(config.primary));
    root.style.setProperty('--secondary-color-rgb', hexToRgb(config.secondary));
    root.style.setProperty('--background-color-rgb', hexToRgb(config.background));
    root.style.setProperty('--paper-color-rgb', hexToRgb(config.paper));
    root.style.setProperty('--text-color-rgb', hexToRgb(config.text));
    root.style.setProperty('--accent-color-rgb', hexToRgb(config.accent));

    // Add contrast variables
    root.style.setProperty('--text-on-primary', '#ffffff');
    root.style.setProperty('--border-color', config.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--hover-bg', config.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)');
    root.style.setProperty('--active-bg', config.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)');
  }

  return {
    palette: {
      mode: config.mode,
      primary: {
        main: config.primary,
      },
      secondary: {
        main: config.secondary,
      },
      background: {
        default: config.background,
        paper: config.paper,
      },
      text: {
        primary: config.text,
      },
      // Custom colors for compute types
      computePublicCloud: {
        main: '#1976d2', // Blue
        contrastText: '#ffffff',
      },
      computePrivateCloud: {
        main: '#9c27b0', // Purple
        contrastText: '#ffffff',
      },
      computeAiCompanion: {
        main: '#2e7d32', // Green
        contrastText: '#ffffff',
      },
      computeEdge: {
        main: '#0288d1', // Light Blue
        contrastText: '#ffffff',
      },
      computeGPU: {
        main: '#ed6c02', // Orange
        contrastText: '#ffffff',
      },
      computeIGPU: {
        main: '#00897b', // Teal/Cyan - distinct from GPU orange
        contrastText: '#ffffff',
      },
      computeDGPU: {
        main: '#7b1fa2', // Purple - distinct from iGPU teal
        contrastText: '#ffffff',
      },
      computeNPU: {
        main: '#d32f2f', // Red
        contrastText: '#ffffff',
      },
      computeCPU: {
        main: '#757575', // Grey
        contrastText: '#ffffff',
      },
      computeDNPU: {
        main: '#c2185b', // Pink
        contrastText: '#ffffff',
      },
      dell: {
        main: '#0076CE', // Dell Blue
        contrastText: '#ffffff',
      },
      microsoft: {
        main: '#00A4EF', // Microsoft Blue
        contrastText: '#ffffff',
      },
      ollama: {
        main: '#000000', // Black
        contrastText: '#ffffff',
      }
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", "Roboto", "Oxygen", sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
    },
  };
}