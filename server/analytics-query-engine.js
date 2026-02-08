/**
 * analytics-query-engine.js
 * 
 * Advanced Analytics Engine for Structured Data
 * Handles mathematical operations, aggregations, filtering, and complex queries
 */

import { chunkQueries, documentQueries } from './database.js';
import { parseCSVLine } from './document-processor-advanced.js';

/**
 * Detect if query requires data analytics
 */
export function isAnalyticsQuery(query) {
  const lower = query.toLowerCase();
  
  const analyticsPatterns = [
    // Mathematical operations
    /\b(sum|total|add|calculate|compute)\b/,
    /\b(average|mean|avg)\b/,
    /\b(maximum|max|highest|largest|biggest)\b/,
    /\b(minimum|min|lowest|smallest)\b/,
    /\b(median|mode)\b/,
    
    // Counting and filtering
    /\b(count|how many|number of)\b/,
    /\b(list|show|find|get).*\b(all|every|where|with|having)\b/,
    /\b(filter|select|choose)\b/,
    
    // Comparisons
    /\b(compare|difference|between|vs|versus)\b/,
    /\b(greater than|less than|more than|above|below)\b/,
    /\b(equals?|equal to)\b/,
    
    // Aggregations
    /\b(group by|categorize|organize)\b/,
    /\b(distinct|unique)\b/,
    
    // Specific data queries
    /\b(in category|of type|level|designation)\b/,
    /\b(price|value|amount|volume).*\b(on|at|for)\b/,
  ];
  
  return analyticsPatterns.some(pattern => pattern.test(lower));
}

/**
 * Main analytics query processor
 */
export async function processAnalyticsQuery(query, documentIds) {
  console.log('[Analytics] ============ ANALYTICS QUERY START ============');
  console.log('[Analytics] Query:', query);
  console.log('[Analytics] Documents:', documentIds);
  
  try {
    // Get document data
    const data = await extractStructuredData(documentIds);
    
    if (!data || data.length === 0) {
      console.log('[Analytics] ⚠️  No structured data found');
      return null;
    }
    
    console.log('[Analytics] Extracted', data.length, 'data rows');
    console.log('[Analytics] Columns:', Object.keys(data[0]));
    
    // Analyze the query to understand intent
    const queryIntent = analyzeQueryIntent(query, data);
    console.log('[Analytics] Query intent:', queryIntent.operation);
    console.log('[Analytics] Target column:', queryIntent.targetColumn);
    console.log('[Analytics] Filters:', queryIntent.filters);
    
    // Execute the analytical operation
    const result = executeAnalyticsOperation(data, queryIntent);
    
    console.log('[Analytics] ✅ Result:', result);
    console.log('[Analytics] ============ ANALYTICS COMPLETE ============\n');
    
    return result;
    
  } catch (error) {
    console.error('[Analytics] ERROR:', error);
    return null;
  }
}

/**
 * Extract structured data from CSV/table documents
 */
async function extractStructuredData(documentIds) {
  const allData = [];
  
  for (const docId of documentIds) {
    // Get document info
    const doc = documentQueries.findById.get(docId);
    
    if (!doc) continue;
    
    // For CSV documents, use original_content if available
    if (doc.original_content) {
      const rows = parseCSVDocument(doc.original_content);
      allData.push(...rows);
    } else {
      // Parse from chunks
      const chunks = chunkQueries.findByDocumentId.all(docId);
      for (const chunk of chunks) {
        const rows = parseCSVDocument(chunk.chunk_text);
        allData.push(...rows);
      }
    }
  }
  
  // Deduplicate by content
  const unique = [];
  const seen = new Set();
  
  for (const row of allData) {
    const key = JSON.stringify(row);
    if (!seen.has(key) && Object.keys(row).length > 0) {
      seen.add(key);
      unique.push(row);
    }
  }
  
  return unique;
}

/**
 * Parse CSV text into structured data
 */
function parseCSVDocument(text) {
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) return [];
  
  // Find header line (first line with commas or look for "Name,Level" pattern)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].includes(',') && !lines[i].startsWith('Document:')) {
      headerIndex = i;
      break;
    }
  }
  
  const header = parseCSVLine(lines[headerIndex]);
  const data = [];
  
  // Parse data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip non-data lines
    if (line.startsWith('Document:') || 
        line.startsWith('Type:') || 
        line.startsWith('---') ||
        line.trim() === '') {
      continue;
    }
    
    const values = parseCSVLine(line);
    
    if (values.length !== header.length) continue;
    
    const row = {};
    for (let j = 0; j < header.length; j++) {
      const colName = header[j].trim();
      const value = values[j].trim();
      
      // Try to parse as number
      const numValue = parseNumber(value);
      row[colName] = numValue !== null ? numValue : value;
    }
    
    data.push(row);
  }
  
  return data;
}

/**
 * Parse number from string (handles commas, currency, etc)
 */
function parseNumber(str) {
  if (!str || typeof str !== 'string') return null;
  
  // Remove currency symbols, commas, quotes
  const cleaned = str.replace(/[$₹,"\s]/g, '');
  
  // Check if it's a number
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned);
  }
  
  return null;
}

/**
 * Analyze query to understand what operation is needed
 */
function analyzeQueryIntent(query, data) {
  const lower = query.toLowerCase();
  const columns = Object.keys(data[0] || {});
  
  const intent = {
    operation: 'unknown',
    targetColumn: null,
    filters: [],
    groupBy: null,
    sortBy: null,
    limit: null
  };
  
  // Detect operation type
  if (/\b(count|how many|number of)\b/.test(lower)) {
    intent.operation = 'count';
  } else if (/\b(sum|total|add up)\b/.test(lower)) {
    intent.operation = 'sum';
  } else if (/\b(average|mean|avg)\b/.test(lower)) {
    intent.operation = 'average';
  } else if (/\b(max|maximum|highest|largest|biggest)\b/.test(lower)) {
    intent.operation = 'max';
  } else if (/\b(min|minimum|lowest|smallest)\b/.test(lower)) {
    intent.operation = 'min';
  } else if (/\b(list|show|find|get|display)\b/.test(lower)) {
    intent.operation = 'list';
  } else if (/\b(compare|difference)\b/.test(lower)) {
    intent.operation = 'compare';
  }
  
  // Detect target column
  for (const col of columns) {
    const colLower = col.toLowerCase();
    if (lower.includes(colLower)) {
      intent.targetColumn = col;
      break;
    }
  }
  
  // Auto-detect target column for numeric operations
  if (!intent.targetColumn && ['sum', 'average', 'max', 'min'].includes(intent.operation)) {
    // Find first numeric column
    for (const col of columns) {
      const firstValue = data[0][col];
      if (typeof firstValue === 'number') {
        intent.targetColumn = col;
        break;
      }
    }
  }
  
  // Extract filters
  intent.filters = extractFilters(query, columns, data);
  
  // Detect grouping
  for (const col of columns) {
    if (new RegExp(`\\bby\\s+${col}\\b`, 'i').test(query) ||
        new RegExp(`\\bper\\s+${col}\\b`, 'i').test(query)) {
      intent.groupBy = col;
      break;
    }
  }
  
  // Detect sorting
  if (/\bhighest\b|\blargest\b|\bgreatest\b/.test(lower)) {
    intent.sortBy = { order: 'desc' };
  } else if (/\blowest\b|\bsmallest\b|\bleast\b/.test(lower)) {
    intent.sortBy = { order: 'asc' };
  }
  
  // Detect limit
  const limitMatch = query.match(/\b(top|first|bottom|last)\s+(\d+)\b/i);
  if (limitMatch) {
    intent.limit = parseInt(limitMatch[2]);
  }
  
  return intent;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract filter conditions from query - FIXED VERSION
 */
function extractFilters(query, columns, data) {
  const filters = [];
  const lower = query.toLowerCase();
  
  console.log('[Analytics] ==========================================');
  console.log('[Analytics] FILTER EXTRACTION START');
  console.log('[Analytics] Query:', query);
  console.log('[Analytics] Columns:', columns);
  console.log('[Analytics] ==========================================');
  
  // Get all possible values for each column (for matching)
  const columnValues = {};
  if (data && data.length > 0) {
    columns.forEach(col => {
      const vals = data.map(row => row[col]).filter(v => v != null);
      columnValues[col] = [...new Set(vals.map(v => String(v)))];
    });
    
    console.log('[Analytics] Column values:', Object.keys(columnValues).map(col => 
      `${col}: [${columnValues[col].slice(0, 3).join(', ')}...]`
    ));
  }
  
  // STRATEGY 1: Simple string matching (NO REGEX for values with special chars)
  // Matches: "level J4", "have level J4", "with level J4"
  
  for (const col of columns) {
    const colLower = col.toLowerCase();
    const colValues = columnValues[col] || [];
    
    // Try each value in this column
    for (const value of colValues) {
      const valueLower = value.toLowerCase();
      
      // IMPORTANT: Skip values with regex special characters for pattern matching
      // Instead, use simple string contains
      const hasSpecialChars = /[.*+?^${}()|[\]\\]/.test(value);
      
      if (hasSpecialChars) {
        // For values with special chars (like "Rohan Mandal (J4)"), use simple string matching
        
        // Pattern 1: "COLUMN VALUE" as substring
        if (lower.includes(`${colLower} ${valueLower}`)) {
          console.log(`[Analytics] 🎯 MATCH (substring): "${col} ${value}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: value
          });
          break;
        }
        
        // Pattern 2: Just the value appearing in query
        if (lower.includes(valueLower)) {
          console.log(`[Analytics] 🎯 MATCH (value found): "${col} = ${value}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: value
          });
          break;
        }
        
      } else {
        // For simple values (like "J4", "SDE"), we can use regex safely
        
        // Pattern 1: "COLUMN VALUE"
        const pattern1 = `\\b${escapeRegex(colLower)}\\s+${escapeRegex(valueLower)}\\b`;
        if (new RegExp(pattern1, 'i').test(lower)) {
          console.log(`[Analytics] 🎯 MATCH (pattern): "${col} ${value}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: value
          });
          break;
        }
        
        // Pattern 2: "have/with COLUMN VALUE"
        const pattern2 = `\\b(have|with|at)\\s+${escapeRegex(colLower)}\\s+${escapeRegex(valueLower)}\\b`;
        if (new RegExp(pattern2, 'i').test(lower)) {
          console.log(`[Analytics] 🎯 MATCH (have/with): "${col} ${value}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: value
          });
          break;
        }
        
        // Pattern 3: "VALUE COLUMN" (reversed)
        const pattern3 = `\\b${escapeRegex(valueLower)}\\s+${escapeRegex(colLower)}\\b`;
        if (new RegExp(pattern3, 'i').test(lower)) {
          console.log(`[Analytics] 🎯 MATCH (reversed): "${value} ${col}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: value
          });
          break;
        }
      }
    }
  }
  
  // STRATEGY 2: Fallback - Look for capitalized words/codes that match column values
  // Only if no filters found yet
  
  if (filters.length === 0) {
    console.log('[Analytics] No filters found, trying fallback...');
    
    // Extract capitalized words and codes (J1, J2, J3, J4, SDE, etc.)
    const words = query.match(/\b[A-Z][A-Z0-9]*\b/g) || [];
    console.log('[Analytics] Capitalized words:', words);
    
    for (const word of words) {
      for (const col of columns) {
        const colValues = columnValues[col] || [];
        
        // Check if this word matches any value in this column
        const matchingValue = colValues.find(v => 
          v.toLowerCase() === word.toLowerCase()
        );
        
        if (matchingValue) {
          console.log(`[Analytics] 🎯 FALLBACK MATCH: "${col} = ${matchingValue}"`);
          filters.push({
            column: col,
            operator: 'equals',
            value: matchingValue
          });
          break;
        }
      }
    }
  }
  
  // STRATEGY 3: Numeric comparisons (safe - numbers don't have special chars)
  
  const numberPattern = /([\w]+)\s*(>=?|<=?|=|!=)\s*([0-9,.]+)/gi;
  let match;
  
  while ((match = numberPattern.exec(query)) !== null) {
    const colName = match[1];
    const operator = match[2];
    const valueStr = match[3];
    
    const col = columns.find(c => c.toLowerCase() === colName.toLowerCase());
    
    if (col) {
      const numValue = parseFloat(valueStr.replace(/,/g, ''));
      if (!isNaN(numValue)) {
        console.log(`[Analytics] 🎯 NUMERIC MATCH: "${col} ${operator} ${numValue}"`);
        filters.push({
          column: col,
          operator: operator,
          value: numValue
        });
      }
    }
  }
  
  console.log('[Analytics] ==========================================');
  console.log('[Analytics] FILTERS EXTRACTED:', filters.length);
  filters.forEach((f, i) => {
    console.log(`[Analytics]   ${i+1}. ${f.column} ${f.operator} "${f.value}"`);
  });
  console.log('[Analytics] ==========================================\n');
  
  return filters;
}

/**
 * Execute the analytics operation
 */
function executeAnalyticsOperation(data, intent) {
  // Apply filters first
  let filteredData = applyFilters(data, intent.filters);
  
  console.log('[Analytics] After filters:', filteredData.length, 'rows');
  
  if (filteredData.length === 0) {
    return {
      operation: intent.operation,
      result: null,
      message: 'No data matches the filter criteria',
      rowsProcessed: 0
    };
  }
  
  // Execute operation
  let result;
  
  switch (intent.operation) {
    case 'count':
      result = {
        operation: 'count',
        count: filteredData.length,
        filters: intent.filters,
        message: `Found ${filteredData.length} matching records`
      };
      break;
      
    case 'sum':
      result = calculateSum(filteredData, intent.targetColumn);
      break;
      
    case 'average':
      result = calculateAverage(filteredData, intent.targetColumn);
      break;
      
    case 'max':
      result = findMaximum(filteredData, intent.targetColumn, intent.limit);
      break;
      
    case 'min':
      result = findMinimum(filteredData, intent.targetColumn, intent.limit);
      break;
      
    case 'list':
      result = generateList(filteredData, intent);
      break;
      
    case 'compare':
      result = compareValues(filteredData, intent);
      break;
      
    default:
      result = {
        operation: 'unknown',
        data: filteredData.slice(0, 5),
        totalRows: filteredData.length
      };
  }
  
  result.rowsProcessed = filteredData.length;
  
  return result;
}

/**
 * ALSO UPDATE: applyFilters to be more robust
 */
function applyFilters(data, filters) {
  if (!filters || filters.length === 0) {
    console.log('[Analytics] No filters to apply, returning all', data.length, 'rows');
    return data;
  }
  
  console.log('[Analytics] ==========================================');
  console.log('[Analytics] APPLYING FILTERS');
  console.log('[Analytics] Filters:', filters);
  console.log('[Analytics] Data rows:', data.length);
  console.log('[Analytics] ==========================================');
  
  const filtered = data.filter((row, rowIndex) => {
    const matchesAll = filters.every(filter => {
      const rowValue = row[filter.column];
      const filterValue = filter.value;
      
      // Debug first few rows
      if (rowIndex < 3) {
        console.log(`[Analytics] Row ${rowIndex}: ${filter.column}="${rowValue}" vs "${filterValue}"`);
      }
      
      // Handle string comparison (CASE INSENSITIVE)
      if (typeof rowValue === 'string' || typeof filterValue === 'string') {
        const rowStr = String(rowValue).trim().toLowerCase();
        const filterStr = String(filterValue).trim().toLowerCase();
        
        switch (filter.operator) {
          case 'equals':
          case '=':
            const match = rowStr === filterStr;
            if (rowIndex < 3) {
              console.log(`[Analytics]   String compare: "${rowStr}" === "${filterStr}" → ${match}`);
            }
            return match;
          case '!=':
            return rowStr !== filterStr;
          case 'contains':
            return rowStr.includes(filterStr);
          default:
            return false;
        }
      }
      
      // Handle numeric comparison
      if (typeof rowValue === 'number' && typeof filterValue === 'number') {
        switch (filter.operator) {
          case '>': return rowValue > filterValue;
          case '<': return rowValue < filterValue;
          case '>=': return rowValue >= filterValue;
          case '<=': return rowValue <= filterValue;
          case '=':
          case 'equals': return rowValue === filterValue;
          case '!=': return rowValue !== filterValue;
          default: return false;
        }
      }
      
      // Default: no match
      return false;
    });
    
    return matchesAll;
  });
  
  console.log('[Analytics] ==========================================');
  console.log('[Analytics] FILTER RESULTS');
  console.log('[Analytics] Before:', data.length, 'rows');
  console.log('[Analytics] After:', filtered.length, 'rows');
  console.log('[Analytics] ==========================================\n');
  
  return filtered;
}

/**
 * Calculate sum
 */
function calculateSum(data, column) {
  const values = data.map(row => row[column]).filter(v => typeof v === 'number');
  const sum = values.reduce((a, b) => a + b, 0);
  
  return {
    operation: 'sum',
    column: column,
    sum: sum,
    count: values.length,
    message: `Sum of ${column}: ${sum.toLocaleString()}`
  };
}

/**
 * Calculate average
 */
function calculateAverage(data, column) {
  const values = data.map(row => row[column]).filter(v => typeof v === 'number');
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  return {
    operation: 'average',
    column: column,
    average: avg,
    count: values.length,
    message: `Average ${column}: ${avg.toFixed(2)}`
  };
}

/**
 * Find maximum value(s)
 */
function findMaximum(data, column, limit = 1) {
  const sorted = [...data].sort((a, b) => {
    const aVal = typeof a[column] === 'number' ? a[column] : 0;
    const bVal = typeof b[column] === 'number' ? b[column] : 0;
    return bVal - aVal;
  });
  
  const top = sorted.slice(0, limit);
  
  return {
    operation: 'max',
    column: column,
    maximum: top[0][column],
    topRecords: top,
    message: limit === 1 
      ? `Maximum ${column}: ${top[0][column]}`
      : `Top ${limit} by ${column}`
  };
}

/**
 * Find minimum value(s)
 */
function findMinimum(data, column, limit = 1) {
  const sorted = [...data].sort((a, b) => {
    const aVal = typeof a[column] === 'number' ? a[column] : 0;
    const bVal = typeof b[column] === 'number' ? b[column] : 0;
    return aVal - bVal;
  });
  
  const bottom = sorted.slice(0, limit);
  
  return {
    operation: 'min',
    column: column,
    minimum: bottom[0][column],
    bottomRecords: bottom,
    message: limit === 1 
      ? `Minimum ${column}: ${bottom[0][column]}`
      : `Bottom ${limit} by ${column}`
  };
}

/**
 * Generate filtered list
 */
function generateList(data, intent) {
  let list = data;
  
  // Apply sorting if specified
  if (intent.sortBy && intent.targetColumn) {
    list = [...list].sort((a, b) => {
      const aVal = a[intent.targetColumn];
      const bVal = b[intent.targetColumn];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return intent.sortBy.order === 'desc' ? bVal - aVal : aVal - bVal;
      }
      
      return String(aVal).localeCompare(String(bVal));
    });
  }
  
  // Apply limit
  if (intent.limit) {
    list = list.slice(0, intent.limit);
  }
  
  return {
    operation: 'list',
    items: list,
    count: list.length,
    totalAvailable: data.length,
    message: `Listed ${list.length} items`
  };
}

/**
 * Compare values
 */
function compareValues(data, intent) {
  // Group by comparison
  const grouped = {};
  
  if (intent.groupBy) {
    for (const row of data) {
      const key = row[intent.groupBy];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }
  }
  
  return {
    operation: 'compare',
    groups: grouped,
    summary: Object.keys(grouped).map(key => ({
      group: key,
      count: grouped[key].length
    })),
    message: `Comparison across ${Object.keys(grouped).length} groups`
  };
}

export { extractStructuredData, executeAnalyticsOperation, analyzeQueryIntent };
export { extractFilters, applyFilters };