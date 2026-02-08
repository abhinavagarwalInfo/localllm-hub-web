/**
 * rag-engine-advanced.js
 * 
 * PRODUCTION-READY RAG Engine
 * Hybrid search: Keyword + Semantic + Metadata matching
 */

import { chunkQueries } from './database.js';



/**
 * Check if query should use RAG or just be answered directly
 */
export function shouldSkipRAG(query) {
  const lower = query.toLowerCase().trim();
  
  // Skip greetings and small talk
  const greetings = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 
    'good evening', 'how are you', 'whats up', "what's up",
    'thanks', 'thank you', 'ok', 'okay', 'bye', 'goodbye'
  ];
  
  if (greetings.includes(lower)) {
    return true;
  }
  
  // Skip if query is too short (< 3 words) and no specific keywords
  const words = lower.split(/\s+/);
  if (words.length < 3) {
    const hasQuestionWord = /\b(what|when|where|who|how|why|which|list|show|tell|find)\b/.test(lower);
    if (!hasQuestionWord) {
      return true; // Skip simple statements
    }
  }
  
  return false;
}


/**
 * Advanced search with hybrid scoring
 */
export function searchRelevantChunksAdvanced(query, documentIds, maxChunks = 5) {
  console.log('[RAG] ============ ADVANCED SEARCH START ============');
  console.log('[RAG] Query:', query);
  console.log('[RAG] Documents:', documentIds);
  console.log('[RAG] Max chunks:', maxChunks);
  
  if (!documentIds || documentIds.length === 0) {
    console.log('[RAG] ⚠️  No documents specified');
    return [];
  }
  
  // Get all chunks
  const allChunks = [];
  for (const docId of documentIds) {
    try {
      const docChunks = chunkQueries.findByDocumentId.all(docId);
      console.log(`[RAG] Doc ${docId}: ${docChunks.length} chunks`);
      
      docChunks.forEach(chunk => {
        // Parse metadata
        let metadata = {};
        try {
          metadata = JSON.parse(chunk.metadata || '{}');
        } catch (e) {
          // Ignore parse errors
        }
        
        allChunks.push({
          ...chunk,
          document_id: docId,
          parsedMetadata: metadata
        });
      });
    } catch (error) {
      console.error(`[RAG] Error loading doc ${docId}:`, error);
    }
  }
  
  console.log('[RAG] Total chunks:', allChunks.length);
  
  if (allChunks.length === 0) {
    console.log('[RAG] ⚠️  No chunks found');
    return [];
  }
  
  // Analyze query
  const queryAnalysis = analyzeQuery(query);
  console.log('[RAG] Query analysis:', queryAnalysis);
  
  // Score all chunks
  const scoredChunks = allChunks.map(chunk => {
    const scores = calculateHybridScore(
      chunk.chunk_text,
      chunk.parsedMetadata,
      query,
      queryAnalysis
    );
    
    return {
      ...chunk,
      ...scores,
      finalScore: scores.total
    };
  });
  
  // Sort by score
  scoredChunks.sort((a, b) => b.finalScore - a.finalScore);
  
  // Get top chunks
  const topChunks = scoredChunks.slice(0, maxChunks);
  
  console.log('[RAG] Top chunk scores:');
  topChunks.forEach((c, i) => {
    console.log(`  #${i+1}: ${c.finalScore.toFixed(2)} (kw:${c.keywordScore.toFixed(1)}, sem:${c.semanticScore.toFixed(1)}, meta:${c.metadataScore.toFixed(1)})`);
  });
  
  console.log('[RAG] ============ ADVANCED SEARCH COMPLETE ============\n');
  
  return topChunks;
}

/**
 * Analyze query to extract different types of information
 */
function analyzeQuery(query) {
  const lower = query.toLowerCase();
  
  return {
    // Extract keywords
    keywords: extractAdvancedKeywords(lower),
    
    // Extract dates
    dates: extractDates(query),
    
    // Extract numbers
    numbers: extractNumbers(query),
    
    // Detect question type
    questionType: detectQuestionType(lower),
    
    // Extract entities (names, places, etc)
    entities: extractEntities(query)
  };
}

/**
 * Extract keywords with better handling
 */
function extractAdvancedKeywords(text) {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in',
    'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from',
    'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'what', 'when', 'where', 'who', 'how', 'why'
  ]);
  
  const words = text
    .replace(/[^\w\s\/\-\.]/g, ' ') // Keep dates and numbers
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopWords.has(w))
    .filter(w => !/^\d+$/.test(w)); // Remove pure numbers (handle separately)
  
  return [...new Set(words)];
}

/**
 * Extract dates in various formats
 */
function extractDates(text) {
  const dates = [];
  
  // MM/DD/YY or DD/MM/YY
  const slashDates = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g);
  if (slashDates) dates.push(...slashDates);
  
  // DD-MM-YY
  const dashDates = text.match(/\d{1,2}-\d{1,2}-\d{2,4}/g);
  if (dashDates) dates.push(...dashDates);
  
  // "2nd Feb 2026", "February 2, 2026"
  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04',
    june: '06', july: '07', august: '08', september: '09',
    october: '10', november: '11', december: '12'
  };
  
  const textDatePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+(\d{4})/gi;
  
  let match;
  while ((match = textDatePattern.exec(text)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = monthNames[match[2].toLowerCase()];
    const year = match[3];
    const yearShort = year.substring(2);
    
    // Add multiple formats
    dates.push(`${day}/${month}/${yearShort}`);
    dates.push(`${day}/${month}/${year}`);
    dates.push(`${day}-${month}-${yearShort}`);
    dates.push(match[2].toLowerCase()); // month name
  }
  
  return [...new Set(dates)];
}

/**
 * Extract numbers (prices, quantities, etc)
 */
function extractNumbers(text) {
  const numbers = [];
  
  // Numbers with commas: 25,776.00
  const formattedNums = text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g);
  if (formattedNums) {
    numbers.push(...formattedNums);
    // Also add without commas
    numbers.push(...formattedNums.map(n => n.replace(/,/g, '')));
  }
  
  // Regular numbers
  const simpleNums = text.match(/\b\d+(?:\.\d+)?\b/g);
  if (simpleNums) {
    numbers.push(...simpleNums);
  }
  
  return [...new Set(numbers)];
}

/**
 * Detect question type
 */
function detectQuestionType(query) {
  if (query.match(/\b(what|which)\b.*\b(is|are|was|were)\b/)) return 'factual';
  if (query.match(/\bhow\s+many\b/)) return 'count';
  if (query.match(/\bhow\s+much\b/)) return 'quantity';
  if (query.match(/\bwhen\b/)) return 'temporal';
  if (query.match(/\bwhere\b/)) return 'location';
  if (query.match(/\bwho\b/)) return 'person';
  if (query.match(/\blist|show|give|enumerate\b/)) return 'list';
  if (query.match(/\bcompare|difference|vs\b/)) return 'comparison';
  
  return 'general';
}

/**
 * Extract named entities (simple version)
 */
function extractEntities(text) {
  const entities = [];
  
  // Capitalized words (potential names/places)
  const caps = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (caps) entities.push(...caps);
  
  // Quoted strings
  const quoted = text.match(/"([^"]+)"/g);
  if (quoted) entities.push(...quoted.map(q => q.replace(/"/g, '')));
  
  return [...new Set(entities)];
}

/**
 * Calculate hybrid score combining multiple signals
 */
function calculateHybridScore(chunkText, metadata, query, queryAnalysis) {
  const lowerChunk = chunkText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  let keywordScore = 0;
  let semanticScore = 0;
  let metadataScore = 0;
  let dateScore = 0;
  let numberScore = 0;
  
  // 1. KEYWORD MATCHING (40% weight)
  for (const keyword of queryAnalysis.keywords) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    const exactMatches = (lowerChunk.match(regex) || []).length;
    keywordScore += exactMatches * 15;
    
    // Partial matches
    if (keyword.length >= 4) {  
      const partialMatches = (lowerChunk.split(keyword).length - 1) - exactMatches;
      keywordScore += partialMatches * 5;
    }
  }

  // 2. QUERY TYPE BONUSES
  if (queryAnalysis.questionType === 'count') {
    // For "how many" queries, boost chunks with lists
    const hasListStructure = /\n.*\n.*\n/.test(chunkText); // Multiple lines
    if (hasListStructure) {
      keywordScore += 20;
      console.log('[RAG] 📊 List structure detected: +20');
    }
  }
  
  // 2. DATE MATCHING (25% weight) - CRITICAL for date queries
  for (const date of queryAnalysis.dates) {
    if (lowerChunk.includes(date.toLowerCase())) {
      dateScore += 60; // Big boost for date matches
      console.log(`[RAG] 📅 Date match found: "${date}" + 60`);
    }
  }
  
  // 3. NUMBER MATCHING (15% weight)
  for (const num of queryAnalysis.numbers) {
    if (lowerChunk.includes(num)) {
      numberScore += 25;
    }
  }
  
  // 4. SEMANTIC MATCHING (10% weight)
  // Phrase proximity
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
  let consecutiveMatches = 0;
  let currentStreak = 0;
  
  for (const word of queryWords) {
    if (lowerChunk.includes(word)) {
      currentStreak++;
      consecutiveMatches = Math.max(consecutiveMatches, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  semanticScore += consecutiveMatches * 12;
  
  // Exact phrase match
  if (lowerChunk.includes(lowerQuery)) {
    semanticScore += 40;
  }
  
  // 5. METADATA MATCHING (10% weight)
  if (metadata) {
    // CSV-specific metadata
    if (metadata.type === 'csv' && queryAnalysis.questionType === 'factual') {
      metadataScore += 15;
    }
    
    // Summary chunks for overview questions
    if (metadata.isSummary && (lowerQuery.includes('all') || lowerQuery.includes('total') || lowerQuery.includes('how many'))) {
      metadataScore += 25;
    }
    
    // Heading/section match
    if (metadata.heading) {
      const headingLower = metadata.heading.toLowerCase();
      for (const keyword of queryAnalysis.keywords) {
        if (headingLower.includes(keyword)) {
          metadataScore += 12;
        }
      }
    }
  }
  
  // Calculate weighted total
  const total = 
    (keywordScore * 0.40) +
    (dateScore * 0.25) +
    (numberScore * 0.15) +
    (semanticScore * 0.10) +
    (metadataScore * 0.10);
  
  return {
    keywordScore,
    semanticScore: semanticScore + dateScore + numberScore,
    metadataScore,
    total
  };
}

// EXPORT the new function
export { calculateHybridScore };

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build optimized context from chunks
 */
export function buildOptimizedContext(chunks, maxTokens = 2000) {
  console.log('[RAG] Building optimized context');
  console.log('[RAG] Chunks:', chunks.length);
  console.log('[RAG] Max tokens:', maxTokens);
  
  if (chunks.length === 0) return '';
  
  let context = '';
  let tokens = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTokens = estimateTokens(chunk.chunk_text);
    
    if (tokens + chunkTokens + 100 > maxTokens) {
      console.log(`[RAG] Token limit reached at chunk ${i+1}`);
      break;
    }
    
    const score = chunk.finalScore || chunk.relevance_score || 0;
    
    context += `\n\n--- Source ${i+1} (Relevance: ${score.toFixed(1)}) ---\n`;
    context += chunk.chunk_text;
    
    tokens += chunkTokens + 100;
  }
  
  console.log(`[RAG] Context built: ${tokens} tokens\n`);
  
  return context.trim();
}

/**
 * Estimate tokens
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Build enhanced system prompt
 */
export function buildEnhancedSystemPrompt(context, documentNames, queryType) {
  const basePrompt = `You are a precise AI assistant analyzing documents. Answer based ONLY on the provided information.

**CRITICAL RULES:**
1. Use ONLY information from the sources below
2. For factual questions, provide exact values from the documents
3. If information is not in the sources, clearly state: "I don't have that information in the provided documents"
4. Cite specific details when answering
5. Be concise and accurate

**DOCUMENT SOURCES:**
${context}

---

**INSTRUCTIONS FOR THIS QUERY:**`;

  // Add query-specific instructions
  const queryInstructions = {
    factual: '\n- Provide the exact fact or value from the document\n- Include specific details (dates, numbers, names)',
    count: '\n- Count accurately from the document\n- List all items if asked\n- State the total number clearly',
    temporal: '\n- Provide exact dates from the document\n- Use the same date format as shown in the source',
    list: '\n- List all items found in the document\n- Use bullet points or numbered list\n- Be complete and accurate',
    comparison: '\n- Compare values from the document\n- Show differences clearly\n- Use exact numbers',
    general: '\n- Answer comprehensively using document information\n- Be clear and direct'
  };
  
  const instruction = queryInstructions[queryType] || queryInstructions.general;
  
  return basePrompt + instruction + '\n\nNow answer the user\'s question based on these sources.';
}

export { analyzeQuery, extractDates, extractNumbers };