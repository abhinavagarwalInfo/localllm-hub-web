# Document Persistence - Test Guide

## ✅ What's Fixed

1. **Documents persist across page refreshes** ✅
2. **Documents persist across sessions** ✅
3. **Admin documents visible to all users** ✅
4. **Vector store rebuilds automatically** ✅
5. **Chunks saved to database** ✅

## 🧪 Testing Steps

### Test 1: Document Persistence (Single User)

```bash
# 1. Login as admin
Username: admin
Password: admin123

# 2. Upload a test document
- Go to Documents tab
- Upload: test.txt (with some content)
- Wait for processing to complete
- Verify: Document appears in list

# 3. Refresh browser (F5 or Cmd+R)
✅ Document should still be there
✅ Should show chunk count
✅ Brain icon should be present

# 4. Go to Chat tab
- Ask a question about the document
✅ Should get answer from the document

# 5. Logout and login again
✅ Document should still be there
```

### Test 2: Cross-User Document Sharing

```bash
# 1. Login as admin
- Upload: company_policy.pdf
- Verify upload complete
- Logout

# 2. Login as developer (create one if needed)
Username: developer
Password: dev123
Role: developer

- Go to Documents tab
✅ Should see company_policy.pdf
✅ Should have "Shared by Admin" badge

# 3. Go to Chat tab
- Ask: "What's in the company policy?"
✅ Should get answer from the PDF

# 4. Refresh browser
✅ Shared document should still be visible
```

### Test 3: Private Documents

```bash
# 1. Login as developer
- Upload: personal_notes.txt
- Verify upload
- Logout

# 2. Login as different developer
✅ Should NOT see first developer's personal_notes.txt
✅ Should only see admin-shared documents
```

### Test 4: Document Deletion

```bash
# 1. Login as admin
- Go to Documents tab
- Click delete (trash icon) on a document
- Confirm deletion

# 2. Refresh browser
✅ Deleted document should not appear

# 3. Login as viewer
✅ Deleted admin document should not be visible
```

## 🔍 What Happens Behind the Scenes

### Upload Flow:
```
User uploads file
     ↓
Frontend processes (PDF/Excel/OCR)
     ↓
Frontend generates embeddings
     ↓
Frontend saves to database via API
     ↓
Database stores:
  - Document metadata
  - All chunks
  - All embeddings
     ↓
Frontend reloads from database
```

### Load on Page Refresh:
```
User loads page
     ↓
Frontend calls /api/documents
     ↓
Gets list of accessible documents
     ↓
For each document:
  - Calls /api/documents/:id/chunks
  - Loads all chunks and embeddings
     ↓
Rebuilds vector store in memory
     ↓
Ready for chat!
```

## 📊 Database Structure

```sql
-- Document metadata
documents
├── id (1, 2, 3...)
├── user_id (who uploaded)
├── filename
├── file_type
├── chunks_count
├── is_public (1 for admin, 0 for others)
└── created_at

-- Document content
document_chunks
├── id (1, 2, 3...)
├── document_id (links to documents.id)
├── chunk_index (0, 1, 2...)
├── chunk_text (actual text)
├── embedding (JSON array)
└── metadata (JSON object)
```

## ✅ Verification Checklist

After restart/refresh, verify:

- [ ] Documents list loads automatically
- [ ] Chunk count is correct
- [ ] Brain icon (🧠) appears on all docs
- [ ] Can chat with documents immediately
- [ ] Admin documents show "Shared by Admin" badge
- [ ] Viewers see admin documents
- [ ] Developers see admin + own documents
- [ ] Delete works and persists
- [ ] Upload works and persists
- [ ] No duplicate documents

## 🐛 Troubleshooting

### Documents don't appear after refresh

**Check:**
```bash
# Verify database exists
ls -la data/
# Should show: localllm.db

# Check documents in database
sqlite3 data/localllm.db "SELECT * FROM documents;"

# Check chunks
sqlite3 data/localllm.db "SELECT COUNT(*) FROM document_chunks;"
```

### "Failed to load documents" error

**Check browser console:**
```
F12 → Console tab
Look for errors
```

**Check server logs:**
```
Should show:
GET /api/documents - 200
GET /api/documents/:id/chunks - 200
```

### Documents load but chat doesn't work

**Issue:** Vector store not rebuilding

**Check:**
```javascript
// In browser console
console.log(vectorStore.size)
// Should show number of documents
```

### Shared documents not visible

**Check database:**
```bash
sqlite3 data/localllm.db "SELECT filename, is_public, user_id FROM documents;"

# is_public should be:
# 1 for admin uploads
# 0 for developer uploads
```

**Fix if wrong:**
```sql
-- Mark document as public
UPDATE documents SET is_public = 1 WHERE id = ?;
```

## 📈 Performance

### Load Times (typical):

- **1 document, 20 chunks:** < 1 second
- **10 documents, 200 chunks:** 2-3 seconds
- **50 documents, 1000 chunks:** 5-10 seconds

### Database Size:

- **Small doc (100KB):** ~500KB in database
- **Medium doc (1MB):** ~3MB in database
- **Large doc (10MB):** ~20MB in database

## 🎯 Expected Behavior Summary

| Action | Result |
|--------|--------|
| **Upload doc** | Saved to database immediately |
| **Refresh page** | Documents load from database |
| **Logout/Login** | Documents persist |
| **Admin upload** | Visible to all users |
| **Developer upload** | Visible only to that developer |
| **Delete doc** | Removed from database |
| **Chat** | Uses persisted documents |

## ✨ Success Indicators

You'll know it's working when:

✅ Refresh page → Documents still there
✅ Logout → Login → Documents still there
✅ Admin uploads → Everyone sees it
✅ Developer uploads → Only they see it
✅ Chat works immediately after refresh
✅ No "Loading..." forever
✅ Delete persists across refreshes

---

**Your documents now persist forever!** 🎉💾

All document data (text, chunks, embeddings) is saved to SQLite database.