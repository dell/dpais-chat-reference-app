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
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../../store/store';
import { WelcomeScreen } from '../WelcomeScreen/WelcomeScreen';
import { ChatMessages } from '../ChatMessages/ChatMessages';
import { InputArea } from '../InputArea/InputArea';
import './ChatContent.css';

export const ChatContent: React.FC = () => {
  const { messages } = useAppSelector(state => state.chat);
  const hasMessages = messages.length > 0;
  
  return (
    <Box className="chat-content">
      <AnimatePresence mode="wait">
        {!hasMessages ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="welcome-container"
          >
            <WelcomeScreen />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0 }}
            className="chat-container"
          >
            <ChatMessages />
          </motion.div>
        )}
      </AnimatePresence>
      
      <InputArea />
    </Box>
  );
};