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
import { Box } from '@mui/material';
import { Sidebar } from '../Sidebar/Sidebar';
import { ChatContainer } from '../ChatContainer/ChatContainer';
import { OfflineIndicator } from '../OfflineIndicator/OfflineIndicator';
import './Layout.css';

interface LayoutProps {
  onOpenSettings: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ onOpenSettings }) => {
  return (
    <Box className="layout-container">
      <Sidebar onOpenSettings={onOpenSettings} />
      <ChatContainer />
      <OfflineIndicator />
    </Box>
  );
};