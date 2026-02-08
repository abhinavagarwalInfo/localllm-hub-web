/**
 * document-processor-advanced.js
 * 
 * PRODUCTION-READY Document Processing
 * Creates high-quality chunks for accurate RAG retrieval
 */

/**
 * Main entry point - processes any document type intelligently
 */
export function processDocumentAdvanced(text, fileType, filename) {
  console.log('[DocProcessor] ========== PROCESSING START ==========');
  console.log('[DocProcessor] File:', filename);
  console.log('[DocProcessor] Type:', fileType);
  console.log('[DocProcessor] Size:', text.length, 'chars');
  
  // Clean the text first
  const cleanedText = cleanText(text);
  
  // Detect document structure
  const docType = detectDocumentType(cleanedText, fileType, filename);
  console.log('[DocProcessor] Detected type:', docType);
  
  let chunks = [];
  
  // Use appropriate strategy based on document type
  switch (docType) {
    case 'csv':
      chunks = processCSV(cleanedText, filename);
      break;
    case 'excel':
      chunks = processExcel(cleanedText, filename);
      break;
    case 'code':
      chunks = processCode(cleanedText, filename);
      break;
    case 'markdown':
      chunks = processMarkdown(cleanedText, filename);
      break;
    case 'structured':
      chunks = processStructured(cleanedText, filename);
      break;
    default:
      chunks = processPlainText(cleanedText, filename);
  }
  
  // Post-process all chunks
  chunks = enrichChunks(chunks, filename, docType);
  
  // Validate quality
  const validation = validateChunks(chunks);
  
  console.log('[DocProcessor] ========== PROCESSING COMPLETE ==========');
  console.log('[DocProcessor] Chunks created:', chunks.length);
  console.log('[DocProcessor] Avg chunk size:', validation.avgSize, 'chars');
  console.log('[DocProcessor] Quality score:', validation.qualityScore + '/100');
  console.log('[DocProcessor] ================================================\n');
  
  return chunks;
}

/**
 * Clean and normalize text
 */
function cleanText(text) {
  // Remove BOM
  text = text.replace(/^\uFEFF/, '');
  
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove excessive whitespace but preserve structure
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{4,}/g, '\n\n\n');
  
  return text.trim();
}

/**
 * Detect document type with high accuracy
 */
function detectDocumentType(text, fileType, filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const lower = text.toLowerCase();
  const lines = text.split('\n');
  
  // CSV detection - check first line structure
  if (ext === 'csv' || ext === 'tsv' || fileType?.includes('csv')) {
    const firstLine = lines[0] || '';
    const hasCommas = firstLine.includes(',');
    const hasTabs = firstLine.includes('\t');
    const seemsTabular = hasCommas || hasTabs;
    
    if (seemsTabular && lines.length > 2) {
      return 'csv';
    }
  }
  
  // Excel
  if (ext === 'xlsx' || ext === 'xls' || fileType?.includes('spreadsheet')) {
    return 'excel';
  }
  
  // Code files
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rb', 'php', 'rust', 'swift'];
  if (codeExts.includes(ext)) {
    return 'code';
  }
  
  // Markdown
  if (ext === 'md' || text.match(/^#{1,6}\s/m) || text.match(/\[.+\]\(.+\)/)) {
    return 'markdown';
  }
  
  // Structured (HTML, XML, etc)
  if (lower.includes('<html') || lower.includes('<?xml') || text.match(/<h[1-6]>/i)) {
    return 'structured';
  }
  
  return 'plain';
}

/**
 * CSV Processing - CRITICAL for accurate data retrieval
 */
function processCSV(text, filename) {
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    return [{ text: text, metadata: { type: 'csv', rows: lines.length } }];
  }
  
  console.log('[CSV] Processing', lines.length, 'lines');
  
  const chunks = [];
  const header = lines[0];
  const headerCols = parseCSVLine(header);
  
  console.log('[CSV] Header columns:', headerCols);
  
  // Strategy: Create overlapping chunks with context
  const ROWS_PER_CHUNK = 10;
  const OVERLAP_ROWS = 2;
  
  for (let i = 1; i < lines.length; i += (ROWS_PER_CHUNK - OVERLAP_ROWS)) {
    const endIdx = Math.min(i + ROWS_PER_CHUNK, lines.length);
    const chunkRows = lines.slice(i, endIdx);
    
    // Build chunk with full context
    const chunkText = [
      `Document: ${filename}`,
      `Type: CSV Data Table`,
      `Columns: ${headerCols.join(', ')}`,
      ``,
      header,
      ...chunkRows
    ].join('\n');
    
    // Extract metadata for better search
    const metadata = {
      type: 'csv',
      hasHeader: true,
      columns: headerCols,
      rowStart: i,
      rowEnd: endIdx - 1,
      rowCount: chunkRows.length
    };
    
    // Also extract key-value pairs for semantic search
    const kvPairs = extractCSVKeyValues(header, chunkRows);
    if (kvPairs.length > 0) {
      metadata.keyValues = kvPairs;
    }
    
    chunks.push({ text: chunkText, metadata });
  }
  
  // Create a summary chunk with all unique values
  const summaryText = createCSVSummary(filename, header, lines.slice(1));
  chunks.unshift({ 
    text: summaryText, 
    metadata: { type: 'csv_summary', isSummary: true } 
  });
  
  console.log('[CSV] Created', chunks.length, 'chunks (including summary)');
  
  return chunks;
}

/**
 * Parse CSV line handling quotes and commas
 */
function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  cols.push(current.trim());
  return cols.map(c => c.replace(/^"|"$/g, ''));
}

/**
 * Extract key-value pairs from CSV for semantic search
 */
function extractCSVKeyValues(header, rows) {
  const kvPairs = [];
  const cols = parseCSVLine(header);
  
  for (const row of rows.slice(0, 5)) { // First 5 rows only
    const values = parseCSVLine(row);
    for (let i = 0; i < Math.min(cols.length, values.length); i++) {
      if (values[i]) {
        kvPairs.push(`${cols[i]}: ${values[i]}`);
      }
    }
  }
  
  return kvPairs.slice(0, 20); // Limit to prevent bloat
}

/**
 * Create CSV summary with statistics
 */
function createCSVSummary(filename, header, dataRows) {
  const cols = parseCSVLine(header);
  
  // Get unique values from first column (usually dates/names)
  const firstColValues = dataRows
    .map(row => parseCSVLine(row)[0])
    .filter(v => v)
    .slice(0, 10);
  
  return [
    `Document: ${filename}`,
    `Type: CSV Data Table`,
    `Total Rows: ${dataRows.length}`,
    `Columns: ${cols.join(', ')}`,
    ``,
    `Sample Data (First Column):`,
    ...firstColValues.map(v => `- ${v}`),
    ``,
    `This table contains ${dataRows.length} rows of data with columns: ${cols.join(', ')}.`,
    `The data can be queried by any column value, date, or numeric range.`
  ].join('\n');
}

/**
 * Excel processing (similar to CSV)
 */
function processExcel(text, filename) {
  return processCSV(text, filename); // Excel exports are usually CSV-like
}

/**
 * Code processing - keep logical blocks together
 */
function processCode(text, filename) {
  const chunks = [];
  const lang = filename.split('.').pop();
  
  // Split by function/class definitions
  const patterns = [
    /(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+\w+/g,
    /(?:^|\n)(?:export\s+)?class\s+\w+/g,
    /(?:^|\n)(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /(?:^|\n)def\s+\w+/g, // Python
    /(?:^|\n)(?:public|private|protected)\s+(?:static\s+)?\w+/g // Java
  ];
  
  let parts = [text];
  for (const pattern of patterns) {
    const newParts = [];
    for (const part of parts) {
      newParts.push(...part.split(pattern));
    }
    parts = newParts;
  }
  
  let current = `File: ${filename}\nLanguage: ${lang}\n\n`;
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    if ((current + part).length > 1500) {
      if (current.length > 100) {
        chunks.push({ 
          text: current, 
          metadata: { type: 'code', language: lang } 
        });
      }
      current = `File: ${filename}\nLanguage: ${lang}\n\n${part}`;
    } else {
      current += part;
    }
  }
  
  if (current.length > 100) {
    chunks.push({ 
      text: current, 
      metadata: { type: 'code', language: lang } 
    });
  }
  
  return chunks.length > 0 ? chunks : [{ text, metadata: { type: 'code', language: lang } }];
}

/**
 * Markdown processing - split by headings
 */
function processMarkdown(text, filename) {
  const chunks = [];
  const lines = text.split('\n');
  
  let currentSection = '';
  let currentHeading = '';
  let headingLevel = 0;
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Save previous section
      if (currentSection.trim()) {
        chunks.push({
          text: `Document: ${filename}\n${currentHeading}\n\n${currentSection}`,
          metadata: { 
            type: 'markdown', 
            heading: currentHeading,
            level: headingLevel
          }
        });
      }
      
      currentHeading = line;
      headingLevel = headingMatch[1].length;
      currentSection = '';
    } else {
      currentSection += line + '\n';
      
      // Split long sections
      if (currentSection.length > 2000) {
        chunks.push({
          text: `Document: ${filename}\n${currentHeading}\n\n${currentSection}`,
          metadata: { 
            type: 'markdown', 
            heading: currentHeading,
            level: headingLevel
          }
        });
        currentSection = '';
      }
    }
  }
  
  // Add final section
  if (currentSection.trim()) {
    chunks.push({
      text: `Document: ${filename}\n${currentHeading}\n\n${currentSection}`,
      metadata: { 
        type: 'markdown', 
        heading: currentHeading,
        level: headingLevel
      }
    });
  }
  
  return chunks.length > 0 ? chunks : processPlainText(text, filename);
}

/**
 * Structured document processing (HTML, XML)
 */
function processStructured(text, filename) {
  // Remove HTML tags but keep structure
  const withoutTags = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                           .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ');
  
  return processPlainText(withoutTags, filename);
}

/**
 * Plain text processing - paragraph-based with overlap
 */
function processPlainText(text, filename) {
  const CHUNK_SIZE = 1000;
  const OVERLAP = 200;
  const MIN_CHUNK = 200;
  
  const chunks = [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  let current = `Document: ${filename}\n\n`;
  let previousEnd = '';
  
  for (const para of paragraphs) {
    const paraText = para.trim();
    
    if ((current + paraText).length > CHUNK_SIZE && current.length > MIN_CHUNK) {
      chunks.push({ 
        text: current.trim(), 
        metadata: { type: 'text' } 
      });
      
      // Add overlap from previous chunk
      current = `Document: ${filename}\n\n${previousEnd}\n\n${paraText}`;
    } else {
      current += '\n\n' + paraText;
    }
    
    // Keep last 200 chars for overlap
    previousEnd = paraText.slice(-OVERLAP);
  }
  
  if (current.trim().length > MIN_CHUNK) {
    chunks.push({ 
      text: current.trim(), 
      metadata: { type: 'text' } 
    });
  }
  
  return chunks.length > 0 ? chunks : [{ text, metadata: { type: 'text' } }];
}

/**
 * Enrich chunks with metadata
 */
function enrichChunks(chunks, filename, docType) {
  return chunks.map((chunk, idx) => ({
    text: chunk.text,
    metadata: {
      ...chunk.metadata,
      filename,
      docType,
      chunkIndex: idx,
      totalChunks: chunks.length,
      charCount: chunk.text.length,
      wordCount: chunk.text.split(/\s+/).length
    }
  }));
}

/**
 * Validate chunk quality
 */
function validateChunks(chunks) {
  const sizes = chunks.map(c => c.text.length);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  
  let qualityScore = 100;
  
  // Penalize if chunks too small
  if (minSize < 100) qualityScore -= 20;
  
  // Penalize if chunks too large
  if (maxSize > 3000) qualityScore -= 10;
  
  // Penalize if too much size variation
  const sizeVariation = (maxSize - minSize) / avgSize;
  if (sizeVariation > 3) qualityScore -= 15;
  
  return {
    avgSize: Math.round(avgSize),
    minSize,
    maxSize,
    count: chunks.length,
    qualityScore: Math.max(0, qualityScore)
  };
}

export { 
  processCSV, 
  processCode, 
  processMarkdown, 
  processPlainText,
  cleanText,
  parseCSVLine
};