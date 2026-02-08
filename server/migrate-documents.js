#!/usr/bin/env node

/**
 * migrate-documents.js
 * 
 * Migration script to:
 * 1. Add original_content column to documents table
 * 2. Reconstruct original content for existing CSV documents
 * 3. Verify migration success
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../data/localllm.db');

console.log('📊 Document Migration Script');
console.log('='.repeat(60));
console.log('Database:', dbPath);
console.log('='.repeat(60));
console.log('');

const db = new Database(dbPath);

// Step 1: Add original_content column if it doesn't exist
console.log('Step 1: Checking database schema...');

try {
  const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
  const hasOriginalContent = tableInfo.some(col => col.name === 'original_content');
  
  if (hasOriginalContent) {
    console.log('✅ Column "original_content" already exists');
  } else {
    console.log('➕ Adding column "original_content" to documents table...');
    db.prepare('ALTER TABLE documents ADD COLUMN original_content TEXT').run();
    console.log('✅ Column added successfully');
  }
} catch (error) {
  console.error('❌ Error checking/adding column:', error.message);
  process.exit(1);
}

console.log('');

// Step 2: Get all documents that need migration
console.log('Step 2: Finding documents that need migration...');

const documentsToMigrate = db.prepare(`
  SELECT id, filename, file_type, chunks_count
  FROM documents
  WHERE original_content IS NULL
  AND (file_type LIKE '%csv%' OR file_type = 'text/plain' OR filename LIKE '%.csv')
`).all();

console.log(`Found ${documentsToMigrate.length} CSV documents to migrate`);
console.log('');

if (documentsToMigrate.length === 0) {
  console.log('✅ No documents need migration. All done!');
  db.close();
  process.exit(0);
}

// Step 3: Migrate each document
console.log('Step 3: Migrating documents...');
console.log('');

let successCount = 0;
let failureCount = 0;

for (const doc of documentsToMigrate) {
  console.log(`Migrating: ${doc.filename} (ID: ${doc.id})`);
  console.log(`  Chunks: ${doc.chunks_count}`);
  
  try {
    // Get all chunks for this document
    const chunks = db.prepare(`
      SELECT chunk_text
      FROM document_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `).all(doc.id);
    
    if (chunks.length === 0) {
      console.log('  ⚠️  No chunks found, skipping');
      failureCount++;
      continue;
    }
    
    console.log(`  Retrieved ${chunks.length} chunks`);
    
    // Reconstruct original content
    // For CSV files, join without extra newlines to preserve original format
    const originalContent = chunks.map(c => c.chunk_text).join('');
    
    console.log(`  Reconstructed content: ${originalContent.length} characters`);
    
    // Verify it looks like valid CSV
    const lines = originalContent.split('\n').filter(l => l.trim());
    const firstLine = lines[0] || '';
    const hasCommas = firstLine.includes(',');
    const looksLikeCSV = hasCommas && lines.length > 1;
    
    if (!looksLikeCSV) {
      console.log('  ⚠️  Content does not look like valid CSV, but saving anyway');
    } else {
      console.log(`  ✓ Valid CSV detected (${lines.length} lines)`);
    }
    
    // Update document with original content
    const result = db.prepare(`
      UPDATE documents
      SET original_content = ?
      WHERE id = ?
    `).run(originalContent, doc.id);
    
    if (result.changes === 1) {
      console.log('  ✅ Successfully migrated');
      successCount++;
    } else {
      console.log('  ❌ Update failed');
      failureCount++;
    }
    
  } catch (error) {
    console.error(`  ❌ Error migrating document ${doc.id}:`, error.message);
    failureCount++;
  }
  
  console.log('');
}

// Step 4: Summary
console.log('='.repeat(60));
console.log('Migration Summary:');
console.log('='.repeat(60));
console.log(`Total documents: ${documentsToMigrate.length}`);
console.log(`✅ Successfully migrated: ${successCount}`);
console.log(`❌ Failed: ${failureCount}`);
console.log('');

// Step 5: Verification
console.log('Step 4: Verifying migration...');
console.log('');

const verifyResults = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(original_content) as with_content,
    COUNT(*) - COUNT(original_content) as without_content
  FROM documents
  WHERE file_type LIKE '%csv%' OR file_type = 'text/plain' OR filename LIKE '%.csv'
`).get();

console.log('CSV Documents Status:');
console.log(`  Total: ${verifyResults.total}`);
console.log(`  With original_content: ${verifyResults.with_content}`);
console.log(`  Without original_content: ${verifyResults.without_content}`);
console.log('');

// Show sample of migrated documents
console.log('Sample of migrated documents:');
const samples = db.prepare(`
  SELECT id, filename, 
         SUBSTR(original_content, 1, 100) as content_preview,
         LENGTH(original_content) as content_length
  FROM documents
  WHERE original_content IS NOT NULL
  LIMIT 5
`).all();

for (const sample of samples) {
  console.log(`  ${sample.filename} (ID: ${sample.id})`);
  console.log(`    Length: ${sample.content_length} chars`);
  console.log(`    Preview: ${sample.content_preview.replace(/\n/g, ' ')}...`);
  console.log('');
}

db.close();

if (failureCount > 0) {
  console.log('⚠️  Migration completed with some failures. Please review the errors above.');
  process.exit(1);
} else {
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Deploy the updated index.js with original_content support');
  console.log('2. Test predictions with existing documents');
  console.log('3. For best results, consider re-uploading important CSV files');
  process.exit(0);
}
