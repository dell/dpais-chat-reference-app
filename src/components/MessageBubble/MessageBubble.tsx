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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Avatar, Typography, Chip, Tooltip, Divider, IconButton, CircularProgress } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import CountertopsIcon from '@mui/icons-material/Countertops';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CodeIcon from '@mui/icons-material/Code';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MessageDocType } from '../../db/types';
import { ThinkingSection } from '../ThinkingSection/ThinkingSection';
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer';

import { DocumentReferences, DocumentChunk } from '../DocumentReferences/DocumentReferences';
import { getLastReferences } from '../../client/langchainClient';
import { store } from '../../store/store';
import { getTextToSpeech, summarizeText } from '../../client/openaiClient';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { regenerateMessage } from '../../store/store';

interface MessageBubbleProps {
  message: MessageDocType;
  thinkingContent?: string;  // For live thinking content
  isThinking?: boolean;      // Flag for active thinking
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  thinkingContent,
  isThinking = false
}) => {
  const isUser = message.sender === 'user';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const dispatch = useAppDispatch();
  const [metrics, setMetrics] = useState(message.metrics || {});
  const [hasMetrics, setHasMetrics] = useState(false);

  // React to changes in the message prop
  useEffect(() => {
    setMetrics(message.metrics || {});
    setHasMetrics(
      message.sender === 'assistant' &&
      !!(message.metrics?.processingTimeMs || 
         message.metrics?.tokensGenerated || 
         message.metrics?.wordsGenerated)
    );
  }, [message, message.metrics]);

  // Check if this is the last assistant message
  const isLastAssistantMessage = useMemo(() => {
    if (isUser) return false;

    const state = store.getState().chat;
    const messages = state.messages;

    // Find the last assistant message in the state
    const lastAssistantIndex = [...messages].reverse().findIndex(m => m.sender === 'assistant');
    if (lastAssistantIndex === -1) return false;

    // Convert to actual index
    const actualIndex = messages.length - 1 - lastAssistantIndex;

    // Compare with this message
    return messages[actualIndex]?.id === message.id;
  }, [isUser, message.id]);

  // Format timestamp
  const formattedDate = new Date(message.timestamp).toLocaleDateString();
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Add this state to store whether this message used RAG
  const [usedRag, setUsedRag] = useState(false);
  const [references, setReferences] = useState<DocumentChunk[]>(
    message.documentReferences?.map(ref => ({
      content: ref.content || "", // Use content if available
      documentName: ref.documentName,
      similarity: ref.similarity || 0.8,
      documentId: ref.documentId,
      chunkId: ref.chunkId,
      chunkIndex: ref.chunkIndex
    })) || []
  );

  const hasReferences = message.documentReferences && message.documentReferences.length > 0;

  // Only load from lastReferences for new messages without saved references
  useEffect(() => {
    if (message.sender === 'assistant' &&
      !message.documentReferences &&
      message.id === store.getState().chat.messages[store.getState().chat.messages.length - 1]?.id) {
      const refs = getLastReferences();
      if (refs && refs.length > 0) {
        // Convert references to DocumentChunk format with content preserved
        setReferences(refs.map(ref => ({
          documentId: ref.documentId,
          documentName: ref.documentName,
          chunkId: ref.chunkId,
          similarity: ref.similarity || 0.8,
          sourceType: ref.sourceType,
          chunkIndex: ref.chunkIndex,
          content: ref.content || ""
        })));
      } else {
        // Ensure references are empty if none are available
        setReferences([]);
      }
    }
  }, [message.id, message.documentReferences]);

  // Handle audio playback
  const handleSpeechClick = async () => {
    if (isPlaying && audioRef.current) {
      // Stop playing if already playing
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      try {
        // Convert text to speech and play
        const audioBlob = await getTextToSpeech(message.text);
        const audioUrl = URL.createObjectURL(audioBlob);

        if (!audioRef.current) {
          // Create audio element if it doesn't exist
          audioRef.current = new Audio(audioUrl);
          audioRef.current.addEventListener('ended', () => {
            setIsPlaying(false);
          });
        } else {
          // Update source of existing audio element
          audioRef.current.src = audioUrl;
        }

        // Play the audio
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing speech:', error);
        setIsPlaying(false);
      }
    }
  };

  // Handle summarization and playback
  const handleSummarizeClick = async () => {
    if (isPlaying && audioRef.current) {
      // Stop playing if already playing
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    try {
      setIsSummarizing(true);

      // Get the current model from store
      const currentModel = store.getState().chat.currentModel;

      // Use cached summary if we have one
      let summaryText = summary;

      // Generate a new summary if we don't have one yet
      if (!summaryText) {
        summaryText = await summarizeText(message.text, currentModel);
        setSummary(summaryText);
      }

      // Convert summary to speech
      const audioBlob = await getTextToSpeech(summaryText);
      const audioUrl = URL.createObjectURL(audioBlob);

      if (!audioRef.current) {
        // Create audio element if it doesn't exist
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
        });
      } else {
        // Update source of existing audio element
        audioRef.current.src = audioUrl;
      }

      // Play the audio
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error summarizing or playing speech:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle regenerate click
  const handleRegenerateClick = () => {
    // Set local UI state
    setIsRegenerating(true);

    // Dispatch regenerate action
    dispatch(regenerateMessage());

    // Reset regenerating state after a short delay to allow for transition
    setTimeout(() => {
      setIsRegenerating(false);
    }, 1000);
  };

  // Clean up audio resources when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  // Helper function to format model name for display
  const formatModelName = (modelId: string): string => {
    // Convert 'deepseek-r1:7b' to 'Deepseek 7B'
    if (!modelId) return 'Unknown';

    const parts = modelId.split(':');
    if (parts.length >= 2) {
      const provider = parts[0].split('-')[0]; // Get 'deepseek' from 'deepseek-r1'
      const size = parts[1].toUpperCase(); // Convert '7b' to '7B'
      return `${provider.charAt(0).toUpperCase() + provider.slice(1)} ${size}`;
    }
    return modelId;
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      mb: 3,
      gap: 2,
      width: 'auto',
      marginLeft: 'auto',
      position: 'relative',
      justifyContent: isUser ? 'flex-start' : 'flex-start',
    }}>
      <Avatar sx={{
        flexShrink: 0,
        mt: 1,
        bgcolor: isUser ? 'primary.main' : 'secondary.main',
      }}>
        {isUser ? <PersonIcon /> : <SmartToyIcon />}
      </Avatar>

      <Box sx={{
        flexGrow: 1,
        maxWidth: { xs: '80%', sm: '85%', md: '95%' },
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        textAlign: isUser ? 'right' : 'left', // Always keep text left-aligned
      }}>
        <Box sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          mb: 1,
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, order: isUser ? 2 : 1 }}>
            {isUser ? 'You' : 'Assistant'}
          </Typography>
          <Box sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            mx: 1,
            order: isUser ? 1 : 2
          }}>
            <Typography variant="caption">
              {formattedDate} {formattedTime}
            </Typography>
          </Box>
        </Box>

        {/* Show thinking section for assistant messages */}
        {!isUser && (message.thinkingContent || thinkingContent) && (
          <ThinkingSection
            content={thinkingContent || message.thinkingContent || ''}
            messageId={message.id}
            isStreaming={isThinking}
          />
        )}

        <Box sx={{
          bgcolor: isUser ? 'primary.light' : 'transparent',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          p: 2,
          borderRadius: isUser ? 2 : 0,
          boxShadow: isUser ? 1 : 0,
        }}>
          {isUser ? (
            <Typography>{message.text}</Typography>
          ) : (
            <MarkdownRenderer content={message.text} />
          )}
        </Box>

        {/* Show metrics for assistant messages */}
        {hasMetrics && (
          <>
            <Divider sx={{ my: 1, opacity: 0.5 }} />
            <Box sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mt: 1
            }}>
              {message.model && (
                <Tooltip title="AI Model">
                  <Chip
                    icon={<CodeIcon fontSize="small" />}
                    label={formatModelName(message.model)}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'info.light', color: 'info.contrastText', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {metrics.processingTimeMs && (
                <Tooltip title="Processing Time">
                  <Chip
                    icon={<AccessTimeIcon fontSize="small" />}
                    label={`${(metrics.processingTimeMs / 1000).toFixed(2)}s`}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'action.hover', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {metrics.tokensGenerated && (
                <Tooltip title="Tokens Generated">
                  <Chip
                    icon={<TextFieldsIcon fontSize="small" />}
                    label={`${metrics.tokensGenerated} tokens`}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'action.hover', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {metrics.wordsGenerated && (
                <Tooltip title="Words Generated">
                  <Chip
                    icon={<CountertopsIcon fontSize="small" />}
                    label={`${metrics.wordsGenerated} words`}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'action.hover', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {metrics.tokensPerSecond && (
                <Tooltip title="Generation Speed">
                  <Chip
                    icon={<SpeedIcon fontSize="small" />}
                    label={`${metrics.tokensPerSecond.toFixed(1)} t/s`}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'action.hover', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {metrics.tokensGenerated && (
                <Tooltip title="Cost at $10 per million tokens (gpt-4o pricing)">
                  <Chip
                    icon={<AttachMoneyIcon fontSize="small" />}
                    label={`$${((metrics.tokensGenerated * 10) / 1000000).toFixed(6)}`}
                    size="small"
                    variant="outlined"
                    sx={{ bgcolor: 'action.hover', border: 'none', height: '24px' }}
                  />
                </Tooltip>
              )}

              {/* {!isUser && (
                <Tooltip title={isPlaying ? "Stop Speech" : "Play as Speech"}>
                  <Chip
                    icon={isPlaying ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                    label={isPlaying ? "Stop" : "Speak"}
                    size="small"
                    variant="outlined"
                    onClick={handleSpeechClick}
                    sx={{
                      bgcolor: isPlaying ? 'primary.light' : 'action.hover',
                      border: 'none',
                      height: '24px',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: isPlaying ? 'primary.main' : 'action.selected',
                      }
                    }}
                  />
                </Tooltip>
              )} */}

              {/* {!isUser && (
                <Tooltip title={isPlaying ? "Stop" : "Summarize and Speak"}>
                  <Chip
                    icon={
                      isSummarizing ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : isPlaying ? (
                        <VolumeUpIcon fontSize="small" />
                      ) : (
                        <AutoAwesomeIcon fontSize="small" />
                      )
                    }
                    label={isSummarizing ? "Summarizing..." : isPlaying ? "Stop" : "TLDR"}
                    size="small"
                    variant="outlined"
                    onClick={handleSummarizeClick}
                    disabled={isSummarizing}
                    sx={{
                      bgcolor: isPlaying ? 'secondary.light' : 'action.hover',
                      border: 'none',
                      height: '24px',
                      cursor: isSummarizing ? 'default' : 'pointer',
                      opacity: isSummarizing ? 0.7 : 1,
                      '&:hover': {
                        bgcolor: isSummarizing ? 'action.hover' : isPlaying ? 'secondary.main' : 'action.selected',
                      }
                    }}
                  />
                </Tooltip>
              )} */}
              {/* Add regenerate section for the last assistant message */}
            {!isUser && isLastAssistantMessage && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Tooltip title="Regenerate response">
                  <Chip
                    icon={isRegenerating ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon fontSize="small" />}
                    size="small"
                    variant="outlined"
                    onClick={handleRegenerateClick}
                    disabled={isRegenerating}
                    sx={{
                      bgcolor: 'action.hover',
                      border: 'none',
                      height: '24px',
                      cursor: isRegenerating ? 'default' : 'pointer',
                      opacity: isRegenerating ? 0.7 : 1,
                      '&:hover': {
                        bgcolor: 'action.selected',
                      }
                    }}
                  />
                </Tooltip>
              </Box>
            )}
            </Box>
            
          </>
        )}

        {/* Show document references if available */}
        {(hasReferences || references.length > 0) && message.sender === 'assistant' && (
          <DocumentReferences references={references} />
        )}
      </Box>
    </Box>
  );
};