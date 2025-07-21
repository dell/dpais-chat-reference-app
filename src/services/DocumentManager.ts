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

import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db/db';
import { DocumentChunkDocType } from '../db/types';
import { DocumentDocType, DocumentMetadata } from '../db/types';
import { createEmbedding } from '../db/vectorStore';
import * as PDFJS from 'pdfjs-dist';
import { read as readXLSX, utils as xlsxUtils } from 'xlsx';
import * as xmldom from 'xmldom';
import JSZip from 'jszip';

// Configure PDF.js worker with a direct path that Vite can handle
if (typeof window !== 'undefined' && 'Worker' in window) {
  PDFJS.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

// Define SlideFile interface for PowerPoint extraction
interface SlideFile {
  path: string;
  file: JSZip.JSZipObject;
}

/**
 * Document manager service for handling document uploads, embeddings, and search
 */
export class DocumentManager {
  /**
   * Upload and process a document
   * @param file The file to upload
   * @param tags Optional tags to associate with the document
   * @param progressCallback Optional callback to report embedding progress
   */
  static async uploadDocument(
    file: File, 
    tags: string[] = [], 
    progressCallback?: (progress: { 
      processedChunks: number; 
      totalChunks: number; 
      elapsedTime: number; 
      estimatedTimeRemaining: number;
      chunkProcessingRate: number;
    }) => void
  ): Promise<DocumentDocType> {
    // Extract text based on file type
    const content = await this.extractTextFromFile(file);
    
    // Generate a unique ID for the document
    const documentId = uuidv4();
    
    // Create document metadata
    const metadata: DocumentMetadata = {
      filename: file.name,
      mimetype: file.type,
      size: file.size,
      uploadDate: Date.now(),
      tags: tags,
      chunkCount: 0  // Will be updated after chunking
    };
    
    // Create document object
    const document: DocumentDocType = {
      id: documentId,
      content,
      metadata,
    };
    
    // Store the main document
    const db = await getDB();
    await db.documents.insert(document);
    
    // Process the document in chunks
    const chunks = this.chunkText(content);
    console.log(`Document chunked into ${chunks.length} pieces`);
    
    // Track processing progress and timing
    const startTime = Date.now();
    const totalChunks = chunks.length;
    let processedChunks = 0;
    let lastUpdateTime = startTime;
    let processingRates: number[] = [];
    
    // Process chunks in batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      try {
        const batchStartTime = Date.now();
        
        // Get current batch (up to BATCH_SIZE chunks)
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        const batchTexts = batchChunks.map(chunk => chunk);
        
        // Generate embeddings for this batch of chunks
        const embeddingsResult = await createEmbedding(batchTexts);
        // Handle both cases - single embedding or array of embeddings
        const embeddings = Array.isArray(embeddingsResult[0]) 
          ? embeddingsResult as number[][] 
          : [embeddingsResult as number[]];
        
        // Process each chunk with its embedding
        const batchPromises = batchChunks.map(async (chunkText, index) => {
          // Get the embedding for this chunk (or use the first one if index is out of bounds)
          const embedding = embeddings[index] || embeddings[0];
          
          const chunk: DocumentChunkDocType = {
            id: uuidv4(),
            documentId,
            content: chunkText,
            embedding,
            chunkIndex: i + index,
            metadata: {
              documentName: file.name,
              documentType: file.type,
              tags: tags,
            }
          };
          
          // Insert the chunk
          await db.documentChunks.insert(chunk);
        });
        
        // Wait for all chunks in this batch to be processed
        await Promise.all(batchPromises);
        
        // Update progress
        const chunkCount = batchChunks.length;
        processedChunks += chunkCount;
        
        // Calculate processing metrics
        const batchProcessingTime = Date.now() - batchStartTime;
        processingRates.push(batchProcessingTime / chunkCount); // avg time per chunk in this batch
        
        // Only keep the last 5 processing times for more accurate recent estimates
        if (processingRates.length > 5) {
          processingRates.shift();
        }
        
        // Calculate average processing rate (chunks per millisecond)
        const avgProcessingTime = processingRates.reduce((sum, time) => sum + time, 0) / processingRates.length;
        
        // Calculate estimated time remaining
        const remainingChunks = totalChunks - processedChunks;
        const estimatedTimeRemaining = avgProcessingTime * remainingChunks;
        const chunkProcessingRate = 1000 / avgProcessingTime; // chunks per second
        
        // Report progress through callback
        if (progressCallback && (Date.now() - lastUpdateTime > 200 || processedChunks === totalChunks)) {
          lastUpdateTime = Date.now();
          progressCallback({
            processedChunks,
            totalChunks,
            elapsedTime: Date.now() - startTime,
            estimatedTimeRemaining,
            chunkProcessingRate
          });
        }
        
      } catch (error) {
        console.error(`Error processing batch starting at chunk ${i}:`, error);
      }
    }
    
    // Update the document with the chunk count
    const docToUpdate = await db.documents.findOne({
      selector: { id: documentId }
    }).exec();
    
    if (docToUpdate) {
      await docToUpdate.update({
        $set: {
          'metadata.chunkCount': chunks.length
        }
      });
    }
    
    // Final progress update
    if (progressCallback) {
      progressCallback({
        processedChunks,
        totalChunks,
        elapsedTime: Date.now() - startTime,
        estimatedTimeRemaining: 0,
        chunkProcessingRate: processedChunks * 1000 / (Date.now() - startTime)
      });
    }
    
    // Return the document (with updated metadata)
    return {
      ...document,
      metadata: {
        ...metadata,
        chunkCount: chunks.length
      }
    };
  }
  
  /**
   * Extract text content from various file types
   * @param file The file to extract text from
   * @returns Extracted text content
   */
  private static async extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    // Text files
    if (
      fileType === 'text/plain' || 
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.py') ||
      fileName.endsWith('.java') ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.css') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.xml')
    ) {
      return await this.readFileAsText(file);
    }
    
    // PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await this.extractTextFromPDF(file);
    }
    
    // Word documents
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      return await this.extractTextFromWord(file);
    }
    
    // PowerPoint files
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileType === 'application/vnd.ms-powerpoint' ||
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.ppt')
    ) {
      return await this.extractTextFromPowerPoint(file);
    }
    
    // Excel files
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel' ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      return await this.extractTextFromExcel(file);
    }
    
    // CSV files
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      return await this.readFileAsText(file);
    }
    
    // Default fallback - try to read as text
    try {
      return await this.readFileAsText(file);
    } catch (error) {
      console.error('Error reading file as text:', error);
      return `[Unsupported Document: ${file.name}]\n\nThis file type is not fully supported for text extraction.`;
    }
  }
  
  /**
   * Extract text from a PDF file
   * @param file The PDF file
   * @returns Extracted text
   */
  private static async extractTextFromPDF(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read PDF file');
          }
          
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          
          // Load the PDF document using PDF.js
          const pdf = await PDFJS.getDocument(typedArray).promise;
          let text = `[PDF Document: ${file.name}]\n\n`;
          
          // Process each page
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // Extract text and handle line breaks
            const pageText = content.items
              .map((item: any) => item.str)
              .join(' ');
            
            text += `[Page ${i}]\n${pageText}\n\n`;
          }
          
          resolve(text);
        } catch (error) {
          console.error('Error extracting PDF text:', error);
          // Fallback to a placeholder if extraction fails
          resolve(`[PDF Document: ${file.name}]\n\nFailed to extract text from this PDF file.`);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading PDF file:', error);
        reject(new Error('Failed to read PDF file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Extract text from a Word document
   * @param file The Word document file
   * @returns Extracted text
   */
  private static async extractTextFromWord(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read Word file');
          }
          
          // Use mammoth.js to extract text from the Word document
        //   const result = await mammoth.extractRawText({
        //     arrayBuffer: event.target.result as ArrayBuffer
        //   });
          
        //   const text = `[Word Document: ${file.name}]\n\n${result.value}`;
            const text = 'TODO';    
          resolve(text);
        } catch (error) {
          console.error('Error extracting Word document text:', error);
          // Fallback to a placeholder if extraction fails
          resolve(`[Word Document: ${file.name}]\n\nFailed to extract text from this Word document.`);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading Word file:', error);
        reject(new Error('Failed to read Word file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Extract text from a PowerPoint file
   * @param file The PowerPoint file
   * @returns Extracted text
   */
  private static async extractTextFromPowerPoint(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read PowerPoint file');
          }
          
          // For PPTX files (modern PowerPoint), we can use JSZip to extract XML content
          if (file.name.toLowerCase().endsWith('.pptx')) {
            const arrayBuffer = event.target.result as ArrayBuffer;
            const zip = new JSZip();
            const contents = await zip.loadAsync(arrayBuffer);
            
            let text = `[PowerPoint Document: ${file.name}]\n\n`;
            let slideCount = 0;
            
            // Process each slide's content
            const slideFiles: SlideFile[] = [];
            
            // Collect all slide files
            contents.forEach((path, file) => {
              if (path.startsWith('ppt/slides/slide') && path.endsWith('.xml')) {
                slideFiles.push({ path, file });
              }
            });
            
            // Sort slide files by number
            slideFiles.sort((a, b) => {
              const numA = parseInt(a.path.replace(/\D/g, ''));
              const numB = parseInt(b.path.replace(/\D/g, ''));
              return numA - numB;
            });
            
            // Process each slide
            for (const slideFile of slideFiles) {
              slideCount++;
              const content = await slideFile.file.async('text');
              
              // Parse XML content to extract text
              const doc = new xmldom.DOMParser().parseFromString(content, 'text/xml');
              const textElements = doc.getElementsByTagName('a:t');
              let slideText = '';
              
              for (let i = 0; i < textElements.length; i++) {
                slideText += textElements[i].textContent + ' ';
              }
              
              text += `[Slide ${slideCount}]\n${slideText.trim()}\n\n`;
            }
            
            resolve(text);
          } else {
            // For older PPT files, we don't have a simple JS library
            resolve(`[PowerPoint Document: ${file.name}]\n\nThis is an older PowerPoint format (.ppt) which requires specialized libraries for text extraction.`);
          }
        } catch (error) {
          console.error('Error extracting PowerPoint text:', error);
          // Fallback to a placeholder if extraction fails
          resolve(`[PowerPoint Document: ${file.name}]\n\nFailed to extract text from this PowerPoint file.`);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading PowerPoint file:', error);
        reject(new Error('Failed to read PowerPoint file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Extract text from an Excel file
   * @param file The Excel file
   * @returns Extracted text
   */
  private static async extractTextFromExcel(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read Excel file');
          }
          
          // Use SheetJS to parse the Excel file
          const data = new Uint8Array(event.target.result as ArrayBuffer);
          const workbook = readXLSX(data, { type: 'array' });
          
          let text = `[Excel Document: ${file.name}]\n\n`;
          
          // Process each worksheet
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            text += `[Sheet: ${sheetName}]\n`;
            
            // Convert sheet to JSON and then to text
            const jsonData = xlsxUtils.sheet_to_json(worksheet, { header: 1 });
            
            // Add each row as a line of text
            jsonData.forEach((row: any) => {
              if (row && row.length) {
                text += row.join('\t') + '\n';
              }
            });
            
            text += '\n';
          });
          
          resolve(text);
        } catch (error) {
          console.error('Error extracting Excel text:', error);
          // Fallback to a placeholder if extraction fails
          resolve(`[Excel Document: ${file.name}]\n\nFailed to extract text from this Excel file.`);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading Excel file:', error);
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Search for documents by semantic similarity
   * @param query The search query
   * @param limit Maximum number of results
   * @param minSimilarity Minimum similarity threshold
   */
  static async searchDocuments(
    query: string, 
    limit = 5, 
    minSimilarity = 0.7
  ): Promise<Array<{document: DocumentChunkDocType, similarity: number}>> {
    const db = await getDB();
    
    // Generate embedding for the query
    const queryEmbedding = await createEmbedding(query);
    
    // Search documentChunks instead of documents
    const chunks = await db.documentChunks.find().exec();
    const chunksWithSimilarity = chunks.map(doc => {
      const chunk = doc.toJSON() as DocumentChunkDocType;
      const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      return { document: chunk, similarity };
    });
    
    // Return top results
    return chunksWithSimilarity
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Search for documents by tag
   * @param tag The tag to search for
   */
  static async searchByTag(tag: string): Promise<DocumentDocType[]> {
    const db = await getDB();
    
    const documents = await db.documents.find({
      selector: {
        'metadata.tags': {
          $elemMatch: {
            $eq: tag
          }
        }
      }
    }).exec();
    
    return documents.map(doc => doc.toJSON() as DocumentDocType);
  }
  
  /**
   * Get documents by multiple tags (AND logic)
   * @param tags Array of tags to filter by
   */
  static async getDocumentsByTags(tags: string[]): Promise<DocumentDocType[]> {
    if (!tags.length) return [];
    
    const db = await getDB();
    const documents = await db.documents.find().exec();
    
    // Filter documents that have ALL the specified tags
    return documents
      .map(doc => doc.toJSON() as DocumentDocType)
      .filter(doc => 
        tags.every(tag => doc.metadata.tags.includes(tag))
      );
  }
  
  /**
   * Get all tags
   */
  static async getAllTags(): Promise<string[]> {
    const db = await getDB();
    
    const documents = await db.documents.find().exec();
    
    // Extract all tags from all documents
    const allTags = new Set<string>();
    documents.forEach(doc => {
      const document = doc.toJSON() as DocumentDocType;
      document.metadata.tags.forEach(tag => allTags.add(tag));
    });
    
    return Array.from(allTags);
  }
  
  /**
   * Delete a document
   * @param documentId The ID of the document to delete
   */
  static async deleteDocument(documentId: string): Promise<boolean> {
    const db = await getDB();
    
    const document = await db.documents.findOne({
      selector: { id: documentId }
    }).exec();
    
    if (document) {
      await document.remove();
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += Math.pow(vecA[i], 2);
      normB += Math.pow(vecB[i], 2);
    }
    
    // Avoid division by zero
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Read a file as text
   * @param file The file to read
   */
  private static readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(reader.error);
      };
      
      reader.readAsText(file);
    });
  }
  
  /**
   * Split text into chunks suitable for embedding
   * @param text Full document text
   * @param maxChunkSize Maximum characters per chunk
   * @param overlap Number of characters to overlap between chunks
   */
  private static chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
    const chunks: string[] = [];
    
    if (text.length <= maxChunkSize) {
      return [text];
    }
    
    let start = 0;
    
    while (start < text.length) {
      let end = start + maxChunkSize;
      
      // If we're not at the end of the text, try to find a sentence break
      if (end < text.length) {
        // Look for a sentence break in the surrounding area
        const breakPointPattern = /[.!?][\s\n]/g;
        let lastBreakPoint = -1;
        let match;
        
        // Create a search window around the desired break point
        const searchArea = text.substring(Math.max(0, end - 200), Math.min(text.length, end + 200));
        const searchOffset = Math.max(0, end - 200);
        
        // Find the last sentence break in the search window
        while ((match = breakPointPattern.exec(searchArea)) !== null) {
          if (match.index + searchOffset <= end) {
            lastBreakPoint = match.index + searchOffset + 2; // +2 to include the punctuation and space
          }
        }
        
        if (lastBreakPoint !== -1) {
          end = lastBreakPoint;
        } else {
          // If no sentence break, try to find a space or newline
          const spaceNearEnd = text.substring(end - 100, end + 100).search(/[\s\n]/);
          if (spaceNearEnd !== -1) {
            end = end - 100 + spaceNearEnd + 1;
          }
        }
      }
      
      chunks.push(text.substring(start, Math.min(end, text.length)));
      start = Math.max(start + 1, end - overlap); // Ensure we make progress
    }
    
    return chunks;
  }

  static async processDocumentWithChunks(
    document: DocumentDocType, 
    tags: string[]
  ): Promise<void> {
    const settings = JSON.parse(localStorage.getItem('chatAppSettings') || '{}');
    
    // Use settings or defaults for chunk size and overlap
    const chunkSize = settings.documentChunkSize || 1000;
    const chunkOverlap = settings.documentOverlap || 200;
    
    // Process document with these values
    // ...existing processing code...
  }
} 