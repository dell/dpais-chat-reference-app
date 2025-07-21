import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function createTestPDF() {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add a page to the PDF
  const page = pdfDoc.addPage([612, 792]); // Letter size page
  
  // Get a standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Add content to the PDF
  page.drawText('Test Document for RAG Testing', {
    x: 50,
    y: 700,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });
  
  // Add some paragraphs with different information for RAG tests
  const paragraphs = [
    'This is a test document created for automated testing of the RAG (Retrieval Augmented Generation) system. ' +
    'The system should be able to retrieve information from this document when asked questions about its content.',
    
    'The hybrid RAG system combines multiple vector databases to provide accurate and comprehensive answers. ' +
    'It supports document chunking with configurable sizes and overlap to optimize retrieval performance.',
    
    'Key features of our RAG implementation include:',
    '1. Multiple vector store integration (RxDB, Pinecone, Qdrant, etc.)',
    '2. Custom document processing pipeline',
    '3. Automatic metadata extraction',
    '4. Document tagging for filtered retrieval',
    '5. Similarity scoring for relevance ranking',
    
    'The system also supports various document formats including PDF, DOCX, TXT, and more. ' +
    'When processing documents, the system extracts text, splits it into chunks, and generates embeddings ' +
    'for semantic search.',
    
    'Technical specifications:',
    '- Default chunk size: 1000 characters',
    '- Default chunk overlap: 200 characters',
    '- Embedding model: OpenAI text-embedding-ada-002',
    '- Vector dimension: 1536',
    '- Similarity metric: Cosine similarity',
    
    'For testing purposes, you can use this document to verify that:',
    '1. The document is properly processed and stored',
    '2. Chunks are created with appropriate sizes',
    '3. Semantic search returns relevant results',
    '4. The UI correctly displays document references',
    '5. The system can answer questions based on this content',
  ];
  
  // Draw paragraphs with spacing
  let y = 650;
  for (const paragraph of paragraphs) {
    // Split long paragraphs into multiple lines
    const words = paragraph.split(' ');
    let line = '';
    let lines = [];
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      if (font.widthOfTextAtSize(testLine, 12) < 500) {
        line = testLine;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    
    // Draw each line
    for (const lineText of lines) {
      page.drawText(lineText, {
        x: 50,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      y -= 16;
    }
    
    // Add spacing between paragraphs
    y -= 10;
    
    // Add a new page if we're running out of space
    if (y < 100) {
      const newPage = pdfDoc.addPage([612, 792]);
      y = 750;
    }
  }
  
  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save();
  
  // Write the PDF to a file
  fs.writeFileSync('tests/fixtures/test-document.pdf', pdfBytes);
  
  console.log('Test PDF created successfully!');
}

createTestPDF().catch(console.error); 