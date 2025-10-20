/*
 * Copyright © 2025 Dell Inc. or its subsidiaries. All Rights Reserved.
 *
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

import '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Palette {
        computePublicCloud: Palette['primary'];
        computePrivateCloud: Palette['primary'];
        computeAiCompanion: Palette['primary'];
        computeEdge: Palette['primary'];
        computeGPU: Palette['primary'];
        computeIGPU: Palette['primary'];
        computeNPU: Palette['primary'];
        computeCPU: Palette['primary'];
        computeDNPU: Palette['primary'];
    }

    interface PaletteOptions {
        computePublicCloud?: PaletteOptions['primary'];
        computePrivateCloud?: PaletteOptions['primary'];
        computeAiCompanion?: PaletteOptions['primary'];
        computeEdge?: PaletteOptions['primary'];
        computeGPU?: PaletteOptions['primary'];
        computeIGPU?: PaletteOptions['primary'];
        computeNPU?: PaletteOptions['primary'];
        computeCPU?: PaletteOptions['primary'];
        computeDNPU?: PaletteOptions['primary'];
    }
}

declare module '@mui/material/Chip' {
    interface ChipPropsColorOverrides {
        computePublicCloud: true;
        computePrivateCloud: true;
        computeAiCompanion: true;
        computeEdge: true;
        computeGPU: true;
        computeIGPU: true;
        computeNPU: true;
        computeCPU: true;
        computeDNPU: true;
    }
}

