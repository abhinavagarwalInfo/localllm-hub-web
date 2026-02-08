/**
 * pdf-document-parser.js
 * 
 * Extracts structured information from PDFs and unstructured documents
 * Converts text into queryable key-value pairs
 */

import { chunkQueries, documentQueries } from './database.js';

/**
 * Extract structured data from PDF/text documents
 */
export async function extractPDFStructuredData(documentIds) {
  console.log('[PDFParser] ========================================');
  console.log('[PDFParser] EXTRACTING PDF STRUCTURED DATA');
  console.log('[PDFParser] Documents:', documentIds);
  console.log('[PDFParser] ========================================');
  
  const allData = [];
  
  for (const docId of documentIds) {
    try {
      const doc = documentQueries.findById.get(docId);
      
      if (!doc) continue;
      
      console.log(`[PDFParser] Processing: ${doc.filename}`);
      
      // Get all chunks for this document
      const chunks = chunkQueries.findByDocumentId.all(docId);
      const fullText = chunks.map(c => c.chunk_text).join('\n');
      
      console.log(`[PDFParser] Text length: ${fullText.length} chars`);
      
      // Extract key-value pairs and structured info
      const structured = parsePDFContent(fullText, doc.filename);
      
      structured.documentId = docId;
      structured.documentName = doc.filename;
      
      allData.push(structured);
      
      console.log(`[PDFParser] ✅ Extracted ${Object.keys(structured.fields).length} fields`);
      
    } catch (error) {
      console.error(`[PDFParser] Error processing ${docId}:`, error);
    }
  }
  
  console.log('[PDFParser] ========================================');
  console.log('[PDFParser] Total documents:', allData.length);
  console.log('[PDFParser] ========================================\n');
  
  return allData;
}

/**
 * Parse PDF content into structured fields
 */
function parsePDFContent(text, filename) {
  const structured = {
    filename: filename,
    fullText: text,
    fields: {},
    sections: {},
    tables: [],
    lists: []
  };
  
  // Extract key-value pairs
  structured.fields = extractKeyValuePairs(text);
  
  // Extract sections
  structured.sections = extractSections(text);
  
  // Extract tables
  structured.tables = extractTables(text);
  
  // Extract lists
  structured.lists = extractLists(text);
  
  // Extract dates
  structured.dates = extractAllDates(text);
  
  // Extract numbers and amounts
  structured.amounts = extractAmounts(text);
  
  return structured;
}

/**
 * Extract key-value pairs from text
 */
function extractKeyValuePairs(text) {
  const fields = {};
  const lines = text.split('\n');
  
  // Pattern 1: "Key: Value" or "Key : Value"
  const colonPattern = /^([A-Za-z][A-Za-z\s/]+?)\s*:\s*(.+)$/;
  
  // Pattern 2: "Key Value" (where key is followed by whitespace/value)
  const labelPattern = /^([A-Z][A-Za-z\s]+)\s{2,}(.+)$/;
  
  // Common field names to look for
  const knownFields = [
    'Policy No', 'Policy Number', 'Policy No.', 'Policy#',
    'Name', 'Policyholder', 'Policy Holder', 'Insured Name',
    'Address', 'Residential Address', 'Communication Address',
    'Premium', 'Premium Amount', 'Annual Premium', 'Total Premium',
    'Sum Assured', 'Sum Insured', 'Coverage Amount',
    'Policy Term', 'Term', 'Period', 'Policy Period',
    'Start Date', 'Commencement Date', 'Issue Date',
    'Maturity Date', 'End Date', 'Expiry Date',
    'Status', 'Policy Status', 'Coverage Status',
    'Plan', 'Plan Name', 'Product Name',
    'Nominee', 'Beneficiary',
    'Date of Birth', 'DOB', 'Age',
    'Mobile', 'Phone', 'Contact', 'Email',
    'PAN', 'Aadhaar', 'Aadhar'
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try colon pattern
    const colonMatch = trimmed.match(colonPattern);
    if (colonMatch) {
      const key = colonMatch[1].trim();
      const value = colonMatch[2].trim();
      
      if (value && value.length > 0 && value.length < 500) {
        const normalizedKey = normalizeFieldName(key);
        fields[normalizedKey] = value;
      }
    }
    
    // Try to match known fields
    for (const knownField of knownFields) {
      const pattern = new RegExp(`${knownField}\\s*[:\\s]\\s*(.+)`, 'i');
      const match = trimmed.match(pattern);
      
      if (match) {
        const value = match[1].trim();
        if (value && value.length > 0 && value.length < 500) {
          const normalizedKey = normalizeFieldName(knownField);
          if (!fields[normalizedKey]) {
            fields[normalizedKey] = value;
          }
        }
      }
    }
  }
  
  // Also try to extract from continuous text
  const inlineFields = extractInlineFields(text);
  Object.assign(fields, inlineFields);
  
  return fields;
}

/**
 * Extract inline fields from continuous text
 */
function extractInlineFields(text) {
  const fields = {};
  
  // Policy number patterns
  const policyPatterns = [
    /Policy\s*(?:No|Number|#)[:\s]*([A-Z0-9]+)/i,
    /Policy[:\s]+([A-Z0-9]{8,})/i
  ];
  
  for (const pattern of policyPatterns) {
    const match = text.match(pattern);
    if (match) {
      fields['Policy Number'] = match[1].trim();
      break;
    }
  }
  
  // Premium amount
  const premiumPatterns = [
    /Premium[:\s]*₹?\s*([\d,]+(?:\.\d{2})?)/i,
    /₹\s*([\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*(?:annum|year|month)/i
  ];
  
  for (const pattern of premiumPatterns) {
    const match = text.match(pattern);
    if (match) {
      fields['Premium Amount'] = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Status
  const statusMatch = text.match(/Status[:\s]*([\w\s]+?)(?:\n|\.)/i);
  if (statusMatch) {
    fields['Status'] = statusMatch[1].trim();
  }
  
  return fields;
}

/**
 * Normalize field names
 */
function normalizeFieldName(name) {
  return name
    .trim()
    .replace(/[:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/No\./i, 'Number')
    .replace(/^The\s+/i, '');
}

/**
 * Extract sections from document
 */
function extractSections(text) {
  const sections = {};
  const lines = text.split('\n');
  
  let currentSection = 'General';
  let currentContent = [];
  
  // Patterns for section headers
  const headerPatterns = [
    /^([A-Z][A-Za-z\s]+):?\s*$/,  // All caps or Title Case alone
    /^=+\s*([A-Za-z\s]+)\s*=+$/,   // ===Section===
    /^-+\s*([A-Za-z\s]+)\s*-+$/,   // ---Section---
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    let isHeader = false;
    for (const pattern of headerPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Save previous section
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n');
        }
        
        currentSection = match[1].trim();
        currentContent = [];
        isHeader = true;
        break;
      }
    }
    
    if (!isHeader && trimmed) {
      currentContent.push(trimmed);
    }
  }
  
  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }
  
  return sections;
}

/**
 * Extract tables from text
 */
function extractTables(text) {
  const tables = [];
  const lines = text.split('\n');
  
  let currentTable = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect table rows (multiple spaces or tabs)
    if (/\s{3,}|\t/.test(line)) {
      const cells = line.split(/\s{3,}|\t/).map(c => c.trim()).filter(c => c);
      
      if (cells.length >= 2) {
        if (!currentTable) {
          currentTable = {
            headers: cells,
            rows: []
          };
        } else {
          currentTable.rows.push(cells);
        }
      }
    } else if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
      currentTable = null;
    }
  }
  
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }
  
  return tables;
}

/**
 * Extract lists from text
 */
function extractLists(text) {
  const lists = [];
  const lines = text.split('\n');
  
  let currentList = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect list items
    const listPatterns = [
      /^[-•*]\s+(.+)$/,           // - item
      /^(\d+)\.\s+(.+)$/,         // 1. item
      /^[a-z]\)\s+(.+)$/i,        // a) item
    ];
    
    let isListItem = false;
    for (const pattern of listPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        if (!currentList) {
          currentList = { items: [] };
        }
        currentList.items.push(match[match.length - 1].trim());
        isListItem = true;
        break;
      }
    }
    
    if (!isListItem && currentList && currentList.items.length > 0) {
      lists.push(currentList);
      currentList = null;
    }
  }
  
  if (currentList && currentList.items.length > 0) {
    lists.push(currentList);
  }
  
  return lists;
}

/**
 * Extract all dates from text
 */
function extractAllDates(text) {
  const dates = [];
  
  const datePatterns = [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,  // DD/MM/YYYY
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,    // YYYY/MM/DD
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi,
  ];
  
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[0]);
    }
  }
  
  return [...new Set(dates)];
}

/**
 * Extract amounts and currency values
 */
function extractAmounts(text) {
  const amounts = [];
  
  const amountPatterns = [
    /₹\s*([\d,]+(?:\.\d{2})?)/g,
    /Rs\.?\s*([\d,]+(?:\.\d{2})?)/gi,
    /INR\s*([\d,]+(?:\.\d{2})?)/gi,
  ];
  
  for (const pattern of amountPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount)) {
        amounts.push(amount);
      }
    }
  }
  
  return amounts;
}

/**
 * Query PDF structured data
 */
export function queryPDFData(data, query) {
  console.log('[PDFParser] Querying PDF data');
  console.log('[PDFParser] Query:', query);
  
  const lower = query.toLowerCase();
  const results = [];
  
  for (const doc of data) {
    // Search in fields
    for (const [key, value] of Object.entries(doc.fields)) {
      const keyLower = key.toLowerCase();
      
      if (lower.includes(keyLower) || keyLower.includes(lower.replace(/what is|the|a|\?/g, '').trim())) {
        results.push({
          field: key,
          value: value,
          source: doc.documentName,
          type: 'field'
        });
      }
    }
    
    // Search in sections
    for (const [section, content] of Object.entries(doc.sections)) {
      if (lower.includes(section.toLowerCase())) {
        results.push({
          field: section,
          value: content.substring(0, 500),
          source: doc.documentName,
          type: 'section'
        });
      }
    }
  }
  
  return results;
}

export { parsePDFContent, extractKeyValuePairs, normalizeFieldName };
