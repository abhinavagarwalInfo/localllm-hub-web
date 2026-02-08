// /**
//  * rag-engine.js
//  * 
//  * Retrieval-Augmented Generation (RAG) Engine
//  * Provides semantic search and context building for accurate chat responses
//  */

// import { chunkQueries } from './database.js';

// /**
//  * Search for relevant chunks using keyword-based semantic search
//  * @param {string} query - User's question/message
//  * @param {number[]} documentIds - Array of document IDs to search
//  * @param {number} maxChunks - Maximum number of chunks to return
//  * @returns {Array} - Scored and sorted chunks
//  */
// export function searchRelevantChunks(query, documentIds, maxChunks = 5) {
//   console.log('[RAG] ============ SEARCH START ============');
//   console.log('[RAG] Query:', query);
//   console.log('[RAG] Document IDs:', documentIds);
//   console.log('[RAG] Max chunks to return:', maxChunks);
  
//   if (!documentIds || documentIds.length === 0) {
//     console.log('[RAG] ⚠️  No documents specified for search');
//     return [];
//   }
  
//   // Get all chunks from specified documents
//   const allChunks = [];
//   for (const docId of documentIds) {
//     try {
//       const docChunks = chunkQueries.findByDocumentId.all(docId);
//       console.log(`[RAG] Document ${docId}: ${docChunks.length} chunks`);
//       allChunks.push(...docChunks.map(c => ({ ...c, document_id: docId })));
//     } catch (error) {
//       console.error(`[RAG] Error loading chunks for document ${docId}:`, error);
//     }
//   }
  
//   console.log('[RAG] Total chunks to search:', allChunks.length);
  
//   if (allChunks.length === 0) {
//     console.log('[RAG] ⚠️  No chunks found in specified documents');
//     return [];
//   }
  
//   // Extract keywords from query
//   const keywords = extractKeywords(query.toLowerCase());
//   console.log('[RAG] Extracted keywords:', keywords);
  
//   if (keywords.length === 0) {
//     console.log('[RAG] ⚠️  No keywords extracted, returning first chunks');
//     return allChunks.slice(0, maxChunks);
//   }
  
//   // Score each chunk based on keyword relevance
//   const scoredChunks = allChunks.map(chunk => {
//     const score = scoreChunk(chunk.chunk_text.toLowerCase(), keywords, query.toLowerCase());
//     return { ...chunk, relevance_score: score };
//   });
  
//   // Sort by relevance score (highest first)
//   scoredChunks.sort((a, b) => b.relevance_score - a.relevance_score);
  
//   // Get top N chunks
//   const topChunks = scoredChunks.slice(0, maxChunks);
  
//   console.log('[RAG] Top chunk scores:', topChunks.map((c, i) => `#${i+1}: ${c.relevance_score.toFixed(2)}`));
//   console.log('[RAG] ============ SEARCH COMPLETE ============\n');
  
//   return topChunks;
// }

// /**
//  * Extract meaningful keywords from text
//  * Removes stop words and keeps significant terms
//  */
// function extractKeywords(text) {
//   // Common stop words to filter out
//   const stopWords = new Set([
//     'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 
//     'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from', 
//     'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 
//     'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 
//     'when', 'where', 'who', 'how', 'why', 'about', 'there', 'their', 'they',
//     'them', 'these', 'those', 'then', 'than', 'such', 'some', 'into', 'just',
//     'so', 'if', 'out', 'up', 'down', 'only', 'no', 'yes', 'not', 'now',
//     'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'same',
//     'very', 'too', 'also', 'well', 'even', 'here', 'there', 'get', 'got',
//     'make', 'made', 'see', 'saw', 'know', 'knew', 'think', 'thought'
//   ]);
  
//   const words = text
//     .replace(/[^\w\s]/g, ' ')              // Remove punctuation
//     .replace(/\d+/g, '')                   // Remove standalone numbers (keep them in compound words)
//     .split(/\s+/)                          // Split on whitespace
//     .map(w => w.trim())                    // Trim whitespace
//     .filter(w => w.length > 2)             // Minimum length 3
//     .filter(w => !stopWords.has(w))        // Remove stop words
//     .filter(w => !/^\d+$/.test(w));        // Remove pure numbers
  
//   // Return unique keywords
//   return [...new Set(words)];
// }

// /**
//  * Score a chunk based on keyword relevance
//  * Uses multiple scoring factors for better accuracy
//  */
// function scoreChunk(chunkText, keywords, originalQuery) {
//   let score = 0;

//   // QUICK FIX: Boost score for any date-like patterns
//   if (/\d{1,2}\/\d{1,2}\/\d{2}/.test(chunkText)) {
//     score += 30;  // Found a date in chunk
//     console.log('[RAG] 📅 Date found in chunk: +30');
//   }
  
//   // If query mentions a month name and chunk has that month
//   const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
//   const queryMonth = months.find(m => originalQuery.toLowerCase().includes(m));
//   if (queryMonth && chunkText.toLowerCase().includes(queryMonth)) {
//     score += 20;
//     console.log('[RAG] 📅 Month match: +20');
//   }
  
//   // Factor 1: Exact keyword matches (highest weight)
//   for (const keyword of keywords) {
//     const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
//     const exactMatches = (chunkText.match(regex) || []).length;
//     score += exactMatches * 10;
//   }
  
//   // Factor 2: Partial keyword matches (medium weight)
//   for (const keyword of keywords) {
//     if (keyword.length < 4) continue; // Skip short words for partial matching
//     const partialMatches = (chunkText.split(keyword).length - 1);
//     score += partialMatches * 3;
//   }
  
//   // Factor 3: Multi-keyword proximity bonus
//   // If multiple keywords appear close together, boost score
//   const matchedKeywords = keywords.filter(kw => chunkText.includes(kw));
//   if (matchedKeywords.length >= 2) {
//     score += matchedKeywords.length * 5;
//   }
  
//   // Factor 4: Phrase matching bonus
//   // If the original query phrase appears (even partially)
//   if (originalQuery.length > 10) {
//     const queryWords = originalQuery.split(/\s+/).filter(w => w.length > 3);
//     const consecutiveMatches = findConsecutiveMatches(chunkText, queryWords);
//     score += consecutiveMatches * 15;
//   }
  
//   // Factor 5: Keyword density
//   // Reward chunks with higher keyword density (but cap it to avoid over-weighting)
//   const keywordDensity = matchedKeywords.length / Math.max(keywords.length, 1);
//   score += Math.min(keywordDensity * 10, 20);
  
//   return score;
// }

// /**
//  * Find consecutive word matches (phrase matching)
//  */
// function findConsecutiveMatches(text, words) {
//   let maxConsecutive = 0;
//   let currentConsecutive = 0;
  
//   for (const word of words) {
//     if (text.includes(word)) {
//       currentConsecutive++;
//       maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
//     } else {
//       currentConsecutive = 0;
//     }
//   }
  
//   return maxConsecutive;
// }

// /**
//  * Escape special regex characters
//  */
// function escapeRegex(string) {
//   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// /**
//  * Build RAG context from relevant chunks
//  * Optimizes for token limits and readability
//  */
// export function buildRAGContext(chunks, maxTokens = 2000) {
//   console.log('[RAG] Building context from', chunks.length, 'chunks');
//   console.log('[RAG] Max tokens:', maxTokens);
  
//   if (chunks.length === 0) {
//     return '';
//   }
  
//   let context = '';
//   let totalTokens = 0;
//   let chunksIncluded = 0;
  
//   for (const chunk of chunks) {
//     const chunkText = chunk.chunk_text;
//     const chunkTokens = estimateTokens(chunkText);
    
//     // Check if adding this chunk would exceed limit
//     if (totalTokens + chunkTokens + 50 > maxTokens) { // +50 for formatting
//       console.log(`[RAG] Token limit reached at chunk ${chunksIncluded + 1}`);
//       break;
//     }
    
//     // Add chunk with formatting
//     context += `\n\n--- Document Excerpt ${chunksIncluded + 1} (Relevance: ${chunk.relevance_score?.toFixed(1) || 'N/A'}) ---\n`;
//     context += chunkText;
    
//     totalTokens += chunkTokens + 50;
//     chunksIncluded++;
//   }
  
//   console.log(`[RAG] Context built: ${chunksIncluded} chunks, ~${totalTokens} tokens`);
  
//   return context.trim();
// }

// /**
//  * Estimate token count from text
//  * Rough approximation: 1 token ≈ 4 characters for English
//  */
// function estimateTokens(text) {
//   return Math.ceil(text.length / 4);
// }

// /**
//  * Build system prompt for RAG-enhanced chat
//  */
// export function buildRAGSystemPrompt(context, documentNames = []) {
//   const docList = documentNames.length > 0 
//     ? `\n\nDocuments referenced: ${documentNames.join(', ')}`
//     : '';
  
//   return `You are a helpful AI assistant with access to specific document context. Your role is to answer questions accurately based on the provided excerpts.

// **IMPORTANT INSTRUCTIONS:**
// 1. Answer questions using ONLY the information in the document excerpts below
// 2. If the answer is not in the provided excerpts, clearly state: "I don't have that information in the provided documents"
// 3. Be specific and cite relevant details from the documents when answering
// 4. If asked about data or numbers, provide exact values from the documents
// 5. Keep answers concise, accurate, and well-formatted
// 6. If multiple excerpts contain relevant information, synthesize them coherently
// 7. Do not make up or infer information that isn't explicitly stated${docList}

// **DOCUMENT CONTEXT:**
// ${context}

// ---

// Now, please answer the user's question based on the above context.`;
// }

// /**
//  * Analyze query to determine if RAG should be used
//  */
// export function shouldUseRAG(query, hasDocuments) {
//   if (!hasDocuments) {
//     return false;
//   }
  
//   // RAG-appropriate query patterns
//   const ragPatterns = [
//     /what (is|are|was|were)/i,
//     /how (does|do|can|to)/i,
//     /when (is|was|did)/i,
//     /where (is|was|can)/i,
//     /who (is|was|are)/i,
//     /why (is|was|did)/i,
//     /tell me about/i,
//     /explain/i,
//     /describe/i,
//     /find/i,
//     /search/i,
//     /look (for|up)/i,
//     /show me/i,
//     /list/i,
//     /summarize/i,
//     /according to/i,
//     /based on/i,
//     /in (the|this) document/i,
//   ];
  
//   return ragPatterns.some(pattern => pattern.test(query));
// }

// /**
//  * Extract document IDs from user selection or conversation context
//  */
// export function getActiveDocumentIds(userDocuments, selectedIds = []) {
//   if (selectedIds && selectedIds.length > 0) {
//     return selectedIds;
//   }
  
//   // Fallback: return all user's documents
//   if (userDocuments && userDocuments.length > 0) {
//     return userDocuments.map(doc => doc.id);
//   }
  
//   return [];
// }

// // Export for testing
// export { extractKeywords, scoreChunk, estimateTokens };
