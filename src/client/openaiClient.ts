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

import OpenAI from 'openai';
import { DocumentReference } from '../db/types';
import { getSettings } from '../utils/settings';

// Initialize OpenAI with current settings
const getOpenAIClient = () => {
    const settings = getSettings();
    return new OpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.apiBaseUrl,
        dangerouslyAllowBrowser: true,
    });
};

/**
 * Requests a streaming ChatCompletion using the new 'openai' package with
 * client.chat.completions.create. Streams partial tokens, dispatches them via callbacks.
 */
export async function callOpenAICompletion(
    userPrompt: string,
    previousMessages: Array<{role: string, content: string}>,
    modelId: string,
    onToken: (token: string) => void,
    onDone: (documentReferences?: DocumentReference[]) => void,
    abortSignal?: AbortSignal
) {
    try {
        console.log('Calling OpenAI with prompt:', userPrompt);
        
        // Get system message from settings or use default
        const defaultSystemMessage = 'You are a helpful virtual assistant, a state-of-the-art AI assistant renowned for accuracy, clarity, and thoughtful insights. Your mission is to provide detailed, well-reasoned answers that are both user-friendly and reliable. Always interpret the user\'s intent carefully—if a query is ambiguous, ask clarifying questions before responding. When uncertain about a fact, admit \'I don\'t know\' rather than guessing. Use a professional, yet warm tone, break down complex topics into understandable steps, and maintain consistency in style. Prioritize factual accuracy, and if new information is requested that falls outside your training, state your limitations clearly.';

        // Get current settings
        const currentSettings = getSettings();
        
        // Define system message
        const systemMessage = {
            role: 'system', 
            content: currentSettings.systemMessage || defaultSystemMessage
        };
        
        // Check if the user message is already in the previousMessages array
        const userMessageExists = previousMessages.some(msg => 
            msg.role === 'user' && msg.content === userPrompt
        );
        
        console.log('DEBUG - User message exists in previousMessages?', userMessageExists);
        console.log('DEBUG - User prompt:', userPrompt);
        console.log('DEBUG - Previous messages:', JSON.stringify(previousMessages));
        
        // Build the messages array - only add user prompt if it doesn't exist already
        const messages = [
            systemMessage,
            ...previousMessages,
            // Only add if not already in the messages
            ...(userMessageExists ? [] : [{ role: 'user', content: userPrompt }])
        ];

        console.log('--------------------------------');
        console.log('Model ID:', modelId);
        console.log('Messages for OpenAI:', messages);
        console.log('--------------------------------');

        console.log('messages', messages);
        console.log('modelId', modelId);
        
        // Check if already aborted
        if (abortSignal?.aborted) {
            console.log('Request already aborted');
            onDone([]);
            return;
        }
        
        // Get current settings to check if streaming is enabled
        const streamEnabled = currentSettings.streamEnabled !== false;
        
        // Get OpenAI client with current settings
        const openai = getOpenAIClient();
        
        // Create a chat completion (streaming or non-streaming based on settings)
        if (streamEnabled) {
            // Streaming mode
            const stream = await openai.chat.completions.create({
                model: modelId,
                messages: messages as any,
                stream: true,
                max_completion_tokens: 4096,
            }, {
                signal: abortSignal, // Pass the abort signal to the API call
            });
            
            console.log('stream started');
            
            // Buffer to accumulate partial tags
            let buffer = '';
            let inThinkTag = false;
            
            // For batching tokens to reduce state updates
            const tokenBatch: string[] = [];
            const MAX_BATCH_SIZE = 5; // Adjust based on testing
            let lastUpdateTime = Date.now();
            const MIN_UPDATE_INTERVAL = 100; // milliseconds
            
            const processBatch = () => {
                if (tokenBatch.length > 0) {
                    const batchText = tokenBatch.join('');
                    onToken(batchText);
                    tokenBatch.length = 0; // Clear the array
                    lastUpdateTime = Date.now();
                }
            };
            
            // Use the async iterator to stream tokens
            for await (const part of stream) {
                // Check if aborted during streaming
                if (abortSignal?.aborted) {
                    console.log('Stream aborted by user');
                    break;
                }
                
                const token = part.choices?.[0]?.delta?.content || '';
                if (!token) continue;
                
                // Add token to buffer
                buffer += token;
                
                // Process tags until no more tags are found
                let tagProcessed;
                do {
                    tagProcessed = false;
                    
                    // Check for opening tag
                    if (!inThinkTag) {
                        const openTagIndex = buffer.indexOf('<think>');
                        if (openTagIndex !== -1) {
                            // Content before tag goes to regular message
                            if (openTagIndex > 0) {
                                tokenBatch.push(buffer.substring(0, openTagIndex));
                            }
                            
                            // Push the tag
                            tokenBatch.push('<think>');
                            
                            // Update buffer and state
                            buffer = buffer.substring(openTagIndex + 7);
                            inThinkTag = true;
                            tagProcessed = true;
                            
                            // Process batch to avoid mixing regular and thinking content
                            processBatch();
                        }
                    }
                    // Check for closing tag if we're inside a thinking section
                    else {
                        const closeTagIndex = buffer.indexOf('</think>');
                        if (closeTagIndex !== -1) {
                            // Content before closing tag is part of thinking
                            if (closeTagIndex > 0) {
                                tokenBatch.push(buffer.substring(0, closeTagIndex));
                            }
                            
                            // Push closing tag
                            tokenBatch.push('</think>');
                            
                            // Update buffer and state
                            buffer = buffer.substring(closeTagIndex + 8);
                            inThinkTag = false;
                            tagProcessed = true;
                            
                            // Process batch to finalize thinking content
                            processBatch();
                        }
                    }
                } while (tagProcessed && buffer.length > 0);
                
                // Process remaining buffer content if it doesn't have any more tags
                if (buffer.length > 0) {
                    if ((!inThinkTag && !buffer.includes('<think>')) || 
                        (inThinkTag && !buffer.includes('</think>'))) {
                        tokenBatch.push(buffer);
                        buffer = '';
                        
                        // Send batch if it's large enough or enough time has passed
                        if (tokenBatch.length >= MAX_BATCH_SIZE || 
                            Date.now() - lastUpdateTime > MIN_UPDATE_INTERVAL) {
                            processBatch();
                        }
                    }
                    // Otherwise keep in buffer for next iteration
                }
                
                // Small delay to prevent UI thrashing
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            // Process any remaining content
            if (buffer.length > 0) {
                tokenBatch.push(buffer);
            }
            
            // Final batch process
            processBatch();
        } else {
            // Non-streaming mode
            const response = await openai.chat.completions.create({
                model: modelId,
                messages: messages as any,
                stream: false,
                max_tokens: 4096,
            }, {
                signal: abortSignal, // Pass the abort signal to the API call
            });
            
            console.log('non-streaming response received');
            
            // Process the full response text
            const fullText = response.choices[0]?.message?.content || '';
            
            // Process thinking tags if present
            let remainingText = fullText;
            while (remainingText.includes('<think>')) {
                const beforeThink = remainingText.split('<think>')[0];
                if (beforeThink) {
                    onToken(beforeThink);
                }
                
                onToken('<think>');
                
                const afterOpenTag = remainingText.split('<think>')[1];
                if (!afterOpenTag) break;
                
                if (afterOpenTag.includes('</think>')) {
                    const thinkContent = afterOpenTag.split('</think>')[0];
                    onToken(thinkContent);
                    onToken('</think>');
                    
                    remainingText = afterOpenTag.split('</think>')[1];
                } else {
                    onToken(afterOpenTag);
                    remainingText = '';
                }
            }
            
            // Send any remaining text
            if (remainingText) {
                onToken(remainingText);
            }
        }

        // When the stream completes, call onDone with empty array
        onDone([]);
    } catch (err: any) {
        if (err.name === 'AbortError' || (abortSignal?.aborted && err.message?.includes('aborted'))) {
            console.log('Request cancelled by user');
        } else {
            console.error('Error calling openai:', err);
        }
        onDone([]);
    }
}

/**
 * Calls the OpenAI text-to-speech API to convert text to speech
 * Returns an audio blob that can be played
 */
export async function getTextToSpeech(text: string, model: string = 'kokoro', voice: string = 'af_jessic'): Promise<Blob> {
    try {
        // Get settings from localStorage
        const settings = getSettings();
        const baseURL = settings.apiBaseUrl;
        const apiKey = settings.apiKey;

        // Check if text-to-speech model is specified in settings
        const ttsModel = settings.ttsModel || model;
        const ttsVoice = settings.ttsVoice || voice;
        
        console.log('Converting text to speech:', { text: text.substring(0, 50) + '...', model: ttsModel, voice: ttsVoice });
        
        // Make direct fetch request to the API
        const response = await fetch(`${baseURL}/audio/speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                input: text,
                model: ttsModel,
                voice: ttsVoice
            })
        });
        
        if (!response.ok) {
            throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }
        
        // Get the binary audio data as a blob
        const audioBlob = await response.blob();
        return audioBlob;
    } catch (error) {
        console.error('Error getting text-to-speech:', error);
        throw error;
    }
}

/**
 * Summarizes text using the OpenAI API
 * Returns a concise summary of the input text
 */
export async function summarizeText(text: string, modelId: string): Promise<string> {
    try {
        // Get OpenAI client with current settings
        const openai = getOpenAIClient();
        
        console.log('Summarizing text:', { textLength: text.length, model: modelId });
        
        // Create a concise prompt for summarization
        const prompt = "Summarize the following text in a brief, concise way. Please use text only, no markdown. it should be a message that can be read out load to the user.Make the summary conversational and friendly, but focus on the key points. Keep it under 3 sentences if possible:\n\n" + text;
        
        // Make the API request using the OpenAI client
        const response = await openai.chat.completions.create({
            model: modelId,
            messages: [
                { role: 'system', content: 'You are a helpful assistant that creates concise, clear summaries.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.7
        });
        
        return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
        console.error('Error summarizing text:', error);
        throw error;
    }
}