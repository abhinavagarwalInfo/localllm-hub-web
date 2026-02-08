/**
 * data-query-engine.js
 * 
 * SQL-LIKE QUERY ENGINE
 * Performs deterministic operations on structured data
 * 100% reliable, 0% LLM guessing
 */

import { extractStructuredData, inferColumnTypes, getColumnStats } from './document-data-extractor.js';
import { extractPDFStructuredData, queryPDFData } from './pdf-document-parser.js';


export async function processDataQuery(query, documentIds) {
  console.log('[QueryEngine] ==========================================');
  console.log('[QueryEngine] PROCESSING DATA QUERY');
  console.log('[QueryEngine] Query:', query);
  console.log('[QueryEngine] ==========================================');
  
  // Step 1: Try to extract tabular data (CSV/Excel)
  const tables = await extractStructuredData(documentIds);
  
  if (tables && tables.length > 0) {
    console.log('[QueryEngine] Found tabular data, using table query engine');
    
    const data = mergeTables(tables);
    console.log('[QueryEngine] Total rows:', data.rows.length);
    console.log('[QueryEngine] Columns:', data.headers);
    
    const intent = parseQueryIntent(query, data);
    console.log('[QueryEngine] Intent:', JSON.stringify(intent, null, 2));
    
    const result = executeQuery(data, intent);
    console.log('[QueryEngine] ✅ Query executed');
    console.log('[QueryEngine] ==========================================\n');
    
    return result;
  }
  
  // Step 2: Try PDF/unstructured data
  console.log('[QueryEngine] No tabular data, trying PDF parser...');
  
  const pdfData = await extractPDFStructuredData(documentIds);
  
  if (pdfData && pdfData.length > 0) {
    console.log('[QueryEngine] Found PDF structured data');
    console.log('[QueryEngine] Documents:', pdfData.length);
    console.log('[QueryEngine] Fields:', Object.keys(pdfData[0]?.fields || {}).length);
    
    const result = queryPDFData(pdfData, query);
    
    if (result && result.length > 0) {
      console.log('[QueryEngine] ✅ Found', result.length, 'matches in PDF');
      
      return {
        operation: 'pdf_lookup',
        query: query,
        results: result,
        count: result.length
      };
    }
  }
  
  console.log('[QueryEngine] ⚠️ No structured data found');
  console.log('[QueryEngine] ==========================================\n');
  
  return null;
}

/**
 * Merge tables with same structure
 */
function mergeTables(tables) {
  if (tables.length === 0) return null;
  if (tables.length === 1) return tables[0];
  
  // For now, just use first table
  // TODO: Smart merging of compatible tables
  return tables[0];
}

/**
 * Parse natural language query into structured intent
 */
function parseQueryIntent(query, data) {
  const lower = query.toLowerCase();
  const headers = data.headers;
  
  const intent = {
    operation: null,
    columns: [],
    filters: [],
    groupBy: null,
    orderBy: null,
    limit: null,
    distinct: false
  };
  
  // Detect operation
  if (/\b(count|how many|number of)\b/.test(lower)) {
    intent.operation = 'count';
  } else if (/\b(sum|total|add)\b/.test(lower)) {
    intent.operation = 'sum';
  } else if (/\b(average|mean|avg)\b/.test(lower)) {
    intent.operation = 'avg';
  } else if (/\b(max|maximum|highest|largest|biggest|top)\b/.test(lower)) {
    intent.operation = 'max';
  } else if (/\b(min|minimum|lowest|smallest|bottom)\b/.test(lower)) {
    intent.operation = 'min';
  } else if (/\b(list|show|display|get|find|give me)\b/.test(lower)) {
    intent.operation = 'select';
  } else if (/\b(group|categorize|organize|breakdown)\b/.test(lower)) {
    intent.operation = 'group';
  }
  
  // Detect target columns
  for (const header of headers) {
    const headerLower = header.toLowerCase();
    
    // Column mentioned in query
    if (lower.includes(headerLower)) {
      if (!intent.columns.includes(header)) {
        intent.columns.push(header);
      }
    }
  }
  
  // Auto-detect columns based on operation
  if (intent.columns.length === 0) {
    if (intent.operation === 'count') {
      // Count all rows
      intent.columns = headers;
    } else if (['sum', 'avg', 'max', 'min'].includes(intent.operation)) {
      // Find numeric column
      const numericCol = findNumericColumn(data);
      if (numericCol) intent.columns.push(numericCol);
    }
  }
  
  // Extract filters
  intent.filters = extractQueryFilters(query, data);
  
  // Detect grouping
  const groupMatch = query.match(/\bby\s+(\w+)/i);
  if (groupMatch) {
    const groupCol = headers.find(h => h.toLowerCase() === groupMatch[1].toLowerCase());
    if (groupCol) intent.groupBy = groupCol;
  }
  
  // Detect ordering
  if (/\bhighest\b|\bgreatest\b|\blargest\b|\btop\b/.test(lower)) {
    intent.orderBy = { order: 'desc' };
  } else if (/\blowest\b|\bsmallest\b|\bbottom\b/.test(lower)) {
    intent.orderBy = { order: 'asc' };
  }
  
  // Detect limit
  const limitMatch = query.match(/\b(top|first|bottom|last)\s+(\d+)\b/i);
  if (limitMatch) {
    intent.limit = parseInt(limitMatch[2]);
  }
  
  // Detect distinct
  if (/\bunique\b|\bdistinct\b|\bdifferent\b/.test(lower)) {
    intent.distinct = true;
  }
  
  return intent;
}

/**
 * Extract filters from query
 */
function extractQueryFilters(query, data) {
  const filters = [];
  const headers = data.headers;
  const lower = query.toLowerCase();
  
  // Get all unique values for each column
  const columnValues = {};
  headers.forEach(header => {
    const values = data.rows.map(r => r[header]).filter(v => v != null);
    columnValues[header] = [...new Set(values.map(v => String(v)))];
  });
  
  // STRATEGY 1: "COLUMN = VALUE" patterns
  for (const header of headers) {
    const headerLower = header.toLowerCase();
    const values = columnValues[header];
    
    for (const value of values) {
      const valueLower = String(value).toLowerCase();
      
      // Pattern: "column value" or "have column value" or "with column value"
      const patterns = [
        `${headerLower} ${valueLower}`,
        `${headerLower} is ${valueLower}`,
        `${headerLower} = ${valueLower}`,
        `have ${headerLower} ${valueLower}`,
        `with ${headerLower} ${valueLower}`,
        `in ${headerLower} ${valueLower}`,
        `of ${headerLower} ${valueLower}`
      ];
      
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          filters.push({
            column: header,
            operator: '=',
            value: value
          });
          break;
        }
      }
    }
  }
  
  // STRATEGY 2: Numeric comparisons
  const compPattern = /([\w\s]+)\s*(>|<|>=|<=|=|!=)\s*([0-9,.]+)/gi;
  let match;
  
  while ((match = compPattern.exec(query)) !== null) {
    const colName = match[1].trim();
    const operator = match[2];
    const value = parseFloat(match[3].replace(/,/g, ''));
    
    const header = headers.find(h => h.toLowerCase() === colName.toLowerCase());
    
    if (header && !isNaN(value)) {
      filters.push({
        column: header,
        operator: operator,
        value: value
      });
    }
  }
  
  // STRATEGY 3: Date filters
  // "on DATE", "after DATE", "before DATE"
  const datePattern = /\b(on|after|before|since|until)\s+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi;
  
  while ((match = datePattern.exec(query)) !== null) {
    const operator = match[1].toLowerCase();
    const dateStr = match[2];
    
    // Find date column
    const dateCol = headers.find(h => h.toLowerCase().includes('date'));
    
    if (dateCol) {
      const opMap = {
        'on': '=',
        'after': '>',
        'before': '<',
        'since': '>=',
        'until': '<='
      };
      
      filters.push({
        column: dateCol,
        operator: opMap[operator] || '=',
        value: dateStr
      });
    }
  }
  
  return filters;
}

/**
 * Find first numeric column in data
 */
function findNumericColumn(data) {
  for (const header of data.headers) {
    const firstValue = data.rows[0]?.[header];
    if (typeof firstValue === 'number') {
      return header;
    }
  }
  return null;
}

/**
 * Execute the parsed query
 */
function executeQuery(data, intent) {
  // Apply filters first
  let rows = applyFilters(data.rows, intent.filters);
  
  console.log(`[QueryEngine] After filters: ${rows.length} rows`);
  
  // Execute operation
  let result;
  
  switch (intent.operation) {
    case 'count':
      result = executeCount(rows, intent);
      break;
    case 'sum':
      result = executeSum(rows, intent);
      break;
    case 'avg':
      result = executeAvg(rows, intent);
      break;
    case 'max':
      result = executeMax(rows, intent);
      break;
    case 'min':
      result = executeMin(rows, intent);
      break;
    case 'select':
      result = executeSelect(rows, intent);
      break;
    case 'group':
      result = executeGroup(rows, intent);
      break;
    default:
      result = executeSelect(rows, intent);
  }
  
  return result;
}

/**
 * Apply filters to rows
 */
function applyFilters(rows, filters) {
  if (!filters || filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const rowValue = row[filter.column];
      const filterValue = filter.value;
      
      // Handle null values
      if (rowValue == null) return false;
      
      // String comparison (case-insensitive)
      if (typeof rowValue === 'string' || typeof filterValue === 'string') {
        const rowStr = String(rowValue).toLowerCase().trim();
        const filterStr = String(filterValue).toLowerCase().trim();
        
        switch (filter.operator) {
          case '=':
          case '==':
            return rowStr === filterStr;
          case '!=':
            return rowStr !== filterStr;
          case 'contains':
            return rowStr.includes(filterStr);
          default:
            return false;
        }
      }
      
      // Numeric comparison
      if (typeof rowValue === 'number' && typeof filterValue === 'number') {
        switch (filter.operator) {
          case '=':
          case '==':
            return rowValue === filterValue;
          case '!=':
            return rowValue !== filterValue;
          case '>':
            return rowValue > filterValue;
          case '<':
            return rowValue < filterValue;
          case '>=':
            return rowValue >= filterValue;
          case '<=':
            return rowValue <= filterValue;
          default:
            return false;
        }
      }
      
      return false;
    });
  });
}

/**
 * COUNT operation
 */
function executeCount(rows, intent) {
  if (intent.groupBy) {
    const groups = groupBy(rows, intent.groupBy);
    return {
      operation: 'count',
      groupBy: intent.groupBy,
      groups: Object.entries(groups).map(([key, items]) => ({
        [intent.groupBy]: key,
        count: items.length
      })),
      total: rows.length
    };
  }
  
  if (intent.distinct && intent.columns.length > 0) {
    const col = intent.columns[0];
    const unique = new Set(rows.map(r => r[col]));
    return {
      operation: 'count',
      distinct: true,
      column: col,
      count: unique.size,
      values: Array.from(unique)
    };
  }
  
  return {
    operation: 'count',
    count: rows.length,
    filters: intent.filters
  };
}

/**
 * SUM operation
 */
function executeSum(rows, intent) {
  const col = intent.columns[0];
  const values = rows.map(r => r[col]).filter(v => typeof v === 'number');
  const sum = values.reduce((a, b) => a + b, 0);
  
  return {
    operation: 'sum',
    column: col,
    sum: sum,
    count: values.length
  };
}

/**
 * AVG operation
 */
function executeAvg(rows, intent) {
  const col = intent.columns[0];
  const values = rows.map(r => r[col]).filter(v => typeof v === 'number');
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  return {
    operation: 'avg',
    column: col,
    average: avg,
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

/**
 * MAX operation
 */
function executeMax(rows, intent) {
  const col = intent.columns[0];
  
  const sorted = [...rows].sort((a, b) => {
    const aVal = a[col];
    const bVal = b[col];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return bVal - aVal; // Descending
    }
    
    return String(bVal).localeCompare(String(aVal));
  });
  
  const limit = intent.limit || 1;
  const top = sorted.slice(0, limit);
  
  return {
    operation: 'max',
    column: col,
    maximum: top[0][col],
    topRecords: top,
    count: top.length
  };
}

/**
 * MIN operation
 */
function executeMin(rows, intent) {
  const col = intent.columns[0];
  
  const sorted = [...rows].sort((a, b) => {
    const aVal = a[col];
    const bVal = b[col];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal; // Ascending
    }
    
    return String(aVal).localeCompare(String(bVal));
  });
  
  const limit = intent.limit || 1;
  const bottom = sorted.slice(0, limit);
  
  return {
    operation: 'min',
    column: col,
    minimum: bottom[0][col],
    bottomRecords: bottom,
    count: bottom.length
  };
}

/**
 * SELECT operation
 */
function executeSelect(rows, intent) {
  let result = rows;
  
  // Apply distinct
  if (intent.distinct && intent.columns.length > 0) {
    const seen = new Set();
    result = result.filter(row => {
      const key = intent.columns.map(c => row[c]).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  // Apply ordering
  if (intent.orderBy && intent.columns.length > 0) {
    const col = intent.columns[0];
    result = [...result].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return intent.orderBy.order === 'desc' ? bVal - aVal : aVal - bVal;
      }
      
      const comp = String(aVal).localeCompare(String(bVal));
      return intent.orderBy.order === 'desc' ? -comp : comp;
    });
  }
  
  // Apply limit
  if (intent.limit) {
    result = result.slice(0, intent.limit);
  }
  
  return {
    operation: 'select',
    rows: result,
    count: result.length,
    columns: intent.columns.length > 0 ? intent.columns : Object.keys(result[0] || {})
  };
}

/**
 * GROUP operation
 */
function executeGroup(rows, intent) {
  const groupCol = intent.groupBy || intent.columns[0];
  const groups = groupBy(rows, groupCol);
  
  const summary = Object.entries(groups).map(([key, items]) => ({
    [groupCol]: key,
    count: items.length,
    items: items
  }));
  
  return {
    operation: 'group',
    groupBy: groupCol,
    groups: summary,
    totalGroups: summary.length,
    totalRows: rows.length
  };
}

/**
 * Helper: Group rows by column
 */
function groupBy(rows, column) {
  const groups = {};
  
  for (const row of rows) {
    const key = row[column];
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  
  return groups;
}

export { parseQueryIntent, executeQuery, applyFilters };
