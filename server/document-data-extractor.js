/**
 * document-data-extractor.js
 * 
 * PRODUCTION-GRADE STRUCTURED DATA EXTRACTION
 * Converts any document type into queryable structured data
 */

import { chunkQueries, documentQueries } from './database.js';
import db from './database.js';

/**
 * Main extraction function - gets structured data from any document
 */
export async function extractStructuredData(documentIds) {
  console.log('[DataExtractor] ========================================');
  console.log('[DataExtractor] EXTRACTING STRUCTURED DATA');
  console.log('[DataExtractor] Documents:', documentIds);
  console.log('[DataExtractor] ========================================');
  
  const allTables = [];
  
  for (const docId of documentIds) {
    try {
      const doc = documentQueries.findById.get(docId);
      
      if (!doc) {
        console.log(`[DataExtractor] Document ${docId} not found`);
        continue;
      }
      
      console.log(`[DataExtractor] Processing: ${doc.filename}`);
      console.log(`[DataExtractor] Type: ${doc.file_type}`);
      
      let tables = [];
      
      // Extract based on file type
      if (doc.original_content) {
        // Use original content if available (best for CSV/Excel)
        tables = extractFromContent(doc.original_content, doc.filename, doc.file_type);
      } else {
        // Fall back to chunks
        const chunks = chunkQueries.findByDocumentId.all(docId);
        tables = extractFromChunks(chunks, doc.filename, doc.file_type);
      }
      
      // Add metadata to each table
      tables.forEach(table => {
        table.documentId = docId;
        table.documentName = doc.filename;
        table.documentType = doc.file_type;
      });
      
      allTables.push(...tables);
      
      console.log(`[DataExtractor] ✅ Extracted ${tables.length} tables from ${doc.filename}`);
      
    } catch (error) {
      console.error(`[DataExtractor] Error processing document ${docId}:`, error);
    }
  }
  
  console.log('[DataExtractor] ========================================');
  console.log('[DataExtractor] TOTAL TABLES:', allTables.length);
  console.log('[DataExtractor] TOTAL ROWS:', allTables.reduce((sum, t) => sum + t.rows.length, 0));
  console.log('[DataExtractor] ========================================\n');
  
  return allTables;
}

/**
 * Extract structured data from original content
 */
function extractFromContent(content, filename, fileType) {
  const tables = [];
  
  // Determine format
  const ext = filename.toLowerCase().split('.').pop();
  
  if (ext === 'csv' || fileType?.includes('csv')) {
    tables.push(...parseCSV(content, filename));
  } else if (ext === 'tsv' || content.includes('\t')) {
    tables.push(...parseTSV(content, filename));
  } else if (ext === 'xlsx' || ext === 'xls') {
    tables.push(...parseExcel(content, filename));
  } else {
    // Try to detect table structure
    tables.push(...detectAndParseTables(content, filename));
  }
  
  return tables;
}

/**
 * Extract structured data from chunks
 */
function extractFromChunks(chunks, filename, fileType) {
  const tables = [];
  
  // Combine all chunk text
  const fullText = chunks.map(c => c.chunk_text).join('\n');
  
  return extractFromContent(fullText, filename, fileType);
}

/**
 * Parse CSV content into structured table
 */
function parseCSV(content, filename) {
  console.log('[DataExtractor] Parsing CSV...');
  
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.log('[DataExtractor] ⚠️ Not enough lines for a table');
    return [];
  }
  
  // Find header line (first line with commas, not starting with metadata)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.includes(',') && 
        !line.startsWith('Document:') && 
        !line.startsWith('Type:') &&
        !line.startsWith('---')) {
      headerIndex = i;
      break;
    }
  }
  
  const headerLine = lines[headerIndex];
  const headers = parseCSVLine(headerLine);
  
  console.log('[DataExtractor] Headers:', headers);
  
  // Parse data rows
  const rows = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip metadata and empty lines
    if (!line || 
        line.startsWith('Document:') || 
        line.startsWith('Type:') ||
        line.startsWith('Total Rows:') ||
        line.startsWith('Columns:') ||
        line.startsWith('Sample Data:') ||
        line.startsWith('This table') ||
        line.startsWith('---') ||
        line.startsWith('The data can')) {
      continue;
    }
    
    const values = parseCSVLine(line);
    
    // Skip if not matching header length
    if (values.length !== headers.length) {
      continue;
    }
    
    // Create row object
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const header = cleanHeader(headers[j]);
      const value = cleanValue(values[j]);
      row[header] = value;
    }
    
    rows.push(row);
  }
  
  console.log('[DataExtractor] ✅ Parsed', rows.length, 'rows');
  
  return [{
    name: filename,
    headers: headers.map(cleanHeader),
    rows: rows,
    rowCount: rows.length,
    columnCount: headers.length
  }];
}

/**
 * Parse TSV (tab-separated values)
 */
function parseTSV(content, filename) {
  // Replace tabs with commas and use CSV parser
  const csvContent = content.replace(/\t/g, ',');
  return parseCSV(csvContent, filename);
}

/**
 * Parse Excel content (if stored as text)
 */
function parseExcel(content, filename) {
  // Check if it's actually CSV-like
  if (content.includes(',')) {
    return parseCSV(content, filename);
  }
  
  // Otherwise try to detect structure
  return detectAndParseTables(content, filename);
}

/**
 * Detect and parse tables from unstructured text
 */
function detectAndParseTables(content, filename) {
  const tables = [];
  
  // Look for table-like structures
  const lines = content.split('\n');
  
  // Pattern: Multiple lines with consistent delimiters
  const patterns = [
    /,/,  // Comma
    /\t/, // Tab
    /\|/, // Pipe
    /\s{2,}/ // Multiple spaces
  ];
  
  for (const pattern of patterns) {
    const matchingLines = lines.filter(l => pattern.test(l));
    
    if (matchingLines.length >= 3) {
      // Found potential table
      const delimiter = pattern.source === ',' ? ',' : 
                       pattern.source === '\\t' ? '\t' :
                       pattern.source === '\\|' ? '|' : null;
      
      if (delimiter) {
        const tableContent = matchingLines.join('\n');
        const parsed = parseDelimitedContent(tableContent, delimiter, filename);
        if (parsed) tables.push(parsed);
      }
    }
  }
  
  return tables;
}

/**
 * Parse content with a specific delimiter
 */
function parseDelimitedContent(content, delimiter, filename) {
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) return null;
  
  const headers = lines[0].split(delimiter).map(h => cleanHeader(h));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, j) => {
        row[h] = cleanValue(values[j]);
      });
      rows.push(row);
    }
  }
  
  return {
    name: filename,
    headers: headers,
    rows: rows,
    rowCount: rows.length,
    columnCount: headers.length
  };
}

/**
 * Parse a CSV line (handles quotes and commas inside quotes)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // Add last field
  
  return result;
}

/**
 * Clean header name
 */
function cleanHeader(header) {
  return header
    .trim()
    .replace(/^["']|["']$/g, '') // Remove quotes
    .replace(/\s+/g, ' ')         // Normalize spaces
    .replace(/[^\w\s-]/g, '')     // Remove special chars except dash
    .trim();
}

/**
 * Clean and type-convert value
 */
function cleanValue(value) {
  if (!value) return null;
  
  // Remove quotes and trim
  let cleaned = value.trim().replace(/^["']|["']$/g, '');
  
  if (!cleaned) return null;
  
  // Try to parse as number
  const num = parseNumberValue(cleaned);
  if (num !== null) return num;
  
  // Try to parse as boolean
  if (cleaned.toLowerCase() === 'true') return true;
  if (cleaned.toLowerCase() === 'false') return false;
  
  // Return as string
  return cleaned;
}

/**
 * Parse number from string (handles currency, percentages, etc)
 */
function parseNumberValue(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Remove currency symbols, commas, spaces
  let cleaned = str.replace(/[$₹£€¥,\s]/g, '');
  
  // Handle percentages
  if (cleaned.endsWith('%')) {
    cleaned = cleaned.slice(0, -1);
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num / 100;
  }
  
  // Handle units (M, K, B)
  const unitMatch = cleaned.match(/^([\d.]+)([MKB])$/i);
  if (unitMatch) {
    const base = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toUpperCase();
    const multiplier = unit === 'K' ? 1000 : unit === 'M' ? 1000000 : 1000000000;
    return base * multiplier;
  }
  
  // Standard number
  if (/^-?\d+\.?\d*$/.test(cleaned)) {
    return parseFloat(cleaned);
  }
  
  return null;
}

/**
 * Get column data types
 */
export function inferColumnTypes(table) {
  const types = {};
  
  table.headers.forEach(header => {
    const values = table.rows.map(r => r[header]).filter(v => v != null);
    
    if (values.length === 0) {
      types[header] = 'unknown';
      return;
    }
    
    // Check if all numeric
    const allNumeric = values.every(v => typeof v === 'number');
    if (allNumeric) {
      types[header] = 'number';
      return;
    }
    
    // Check if all boolean
    const allBoolean = values.every(v => typeof v === 'boolean');
    if (allBoolean) {
      types[header] = 'boolean';
      return;
    }
    
    // Check if all dates
    const allDates = values.every(v => {
      if (typeof v !== 'string') return false;
      return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v);
    });
    if (allDates) {
      types[header] = 'date';
      return;
    }
    
    // Default to string
    types[header] = 'string';
  });
  
  return types;
}

/**
 * Get column statistics
 */
export function getColumnStats(table, columnName) {
  const values = table.rows.map(r => r[columnName]).filter(v => v != null);
  
  const stats = {
    column: columnName,
    count: values.length,
    unique: new Set(values).size,
    type: typeof values[0]
  };
  
  if (typeof values[0] === 'number') {
    const nums = values.filter(v => typeof v === 'number');
    stats.min = Math.min(...nums);
    stats.max = Math.max(...nums);
    stats.sum = nums.reduce((a, b) => a + b, 0);
    stats.avg = stats.sum / nums.length;
    stats.median = calculateMedian(nums);
  } else {
    // String column - show top values
    const freq = {};
    values.forEach(v => {
      const key = String(v);
      freq[key] = (freq[key] || 0) + 1;
    });
    
    stats.topValues = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));
  }
  
  return stats;
}

/**
 * Calculate median
 */
function calculateMedian(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

export { parseCSVLine, cleanValue, parseNumberValue };
