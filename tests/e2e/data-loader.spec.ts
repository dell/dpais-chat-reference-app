import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Data Loader Setup', () => {
  const DATA_LOADER_DIR = path.join(process.cwd(), 'pcloud-rag/data-loader');
  
  test('should verify data loader directory exists', async () => {
    // Check if the data loader directory exists
    const dirExists = fs.existsSync(DATA_LOADER_DIR);
    expect(dirExists).toBeTruthy();
    
    if (dirExists) {
      const files = fs.readdirSync(DATA_LOADER_DIR);
      console.log('Files in data loader directory:', files);
      
      // Verify essential files exist
      expect(files.includes('load_vectorstores.py')).toBeTruthy();
      expect(files.includes('download_eli5.py')).toBeTruthy();
      expect(files.includes('Dockerfile')).toBeTruthy();
      expect(files.includes('requirements.txt')).toBeTruthy();
    }
  });
  
  test('should verify sample files exist', async () => {
    const sampleDir = path.join(DATA_LOADER_DIR, 'sample-files');
    
    // Check if sample directory exists
    const dirExists = fs.existsSync(sampleDir);
    expect(dirExists).toBeTruthy();
    
    if (dirExists) {
      // Get the files in the sample directory
      const files = fs.readdirSync(sampleDir);
      console.log('Sample files:', files);
      
      // We should have at least one sample file
      expect(files.length).toBeGreaterThan(0);
      
      // Check if at least one file has the expected format (JSON)
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      expect(jsonFiles.length).toBeGreaterThan(0);
      
      // Check content of one random sample file
      if (jsonFiles.length > 0) {
        const randomIndex = Math.floor(Math.random() * jsonFiles.length);
        const sampleFile = path.join(sampleDir, jsonFiles[randomIndex]);
        
        try {
          const fileContent = fs.readFileSync(sampleFile, 'utf-8');
          const jsonContent = JSON.parse(fileContent);
          
          // Verify file structure
          expect(jsonContent).toHaveProperty('title');
          expect(jsonContent).toHaveProperty('subreddit');
          
          console.log(`Verified sample file: ${jsonFiles[randomIndex]}`);
          console.log(`Sample question: "${jsonContent.title}"`);
        } catch (error) {
          console.error(`Error reading sample file: ${error instanceof Error ? error.message : String(error)}`);
          expect(false).toBeTruthy(); // Fail test if file can't be read
        }
      }
    }
  });
  
  test('should verify docker-compose configuration includes data loader', async () => {
    const dockerComposeFile = path.join(process.cwd(), 'pcloud-rag/docker-compose.yml');
    
    // Check if docker-compose.yml exists
    const fileExists = fs.existsSync(dockerComposeFile);
    expect(fileExists).toBeTruthy();
    
    if (fileExists) {
      // Read the file content
      const fileContent = fs.readFileSync(dockerComposeFile, 'utf-8');
      
      // Check if data-loader service is configured
      expect(fileContent).toContain('data-loader:');
      expect(fileContent).toContain('NOMIC_EMBEDDINGS_API');
      expect(fileContent).toContain('NOMIC_EMBEDDINGS_MODEL');
      
      console.log('Data loader is properly configured in docker-compose.yml');
    }
  });
}); 