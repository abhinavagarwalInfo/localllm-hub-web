# Document Sharing - Quick Reference

## ⚡ Quick Overview

```
┌─────────────────────────────────────────────────────────┐
│                  DOCUMENT VISIBILITY                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Admin Uploads     →  📢 Everyone sees & uses          │
│  Developer Uploads →  🔒 Only that developer sees      │
│  Viewer Uploads    →  ❌ Not allowed                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📊 Visual Example

### Admin Account
```
┌────────────────────────────────────┐
│ 👤 Admin                           │
├────────────────────────────────────┤
│ Documents:                         │
│ ✅ handbook.pdf        [My upload] │
│ ✅ policies.docx       [My upload] │
│ ✅ catalog.xlsx        [My upload] │
└────────────────────────────────────┘
                ↓
        📢 SHARED WITH ALL
                ↓
┌────────────────────────────────────┐
│ 💻 Developer (Bob)                 │
├────────────────────────────────────┤
│ Documents:                         │
│ ✅ handbook.pdf    [Shared by Admin]│
│ ✅ policies.docx   [Shared by Admin]│
│ ✅ catalog.xlsx    [Shared by Admin]│
│ ✅ my_notes.txt    [My private doc] │
└────────────────────────────────────┘
                ↓
        📢 ADMIN DOCS SHARED
        🔒 PERSONAL DOCS PRIVATE
                ↓
┌────────────────────────────────────┐
│ 👁️ Viewer (Carol)                  │
├────────────────────────────────────┤
│ Documents:                         │
│ ✅ handbook.pdf    [Shared by Admin]│
│ ✅ policies.docx   [Shared by Admin]│
│ ✅ catalog.xlsx    [Shared by Admin]│
│                                    │
│ (Can't see Bob's my_notes.txt)     │
└────────────────────────────────────┘
```

## 🎯 Chat Context

### Admin Chat
```
💬 Chat uses:
├─ handbook.pdf      (my upload)
├─ policies.docx     (my upload)
└─ catalog.xlsx      (my upload)

Total: 3 documents
```

### Developer Chat
```
💬 Chat uses:
├─ handbook.pdf      (shared from admin) 📢
├─ policies.docx     (shared from admin) 📢
├─ catalog.xlsx      (shared from admin) 📢
├─ my_notes.txt      (my private doc) 🔒
└─ project_plan.pdf  (my private doc) 🔒

Total: 5 documents (3 shared + 2 private)
```

### Viewer Chat
```
💬 Chat uses:
├─ handbook.pdf      (shared from admin) 📢
├─ policies.docx     (shared from admin) 📢
└─ catalog.xlsx      (shared from admin) 📢

Total: 3 documents (all shared)
```

## ✅ What Changed

### Before Fix:
```
❌ Admin uploads → Only admin could use
❌ Each user had isolated documents
❌ No knowledge sharing
```

### After Fix:
```
✅ Admin uploads → Everyone can use
✅ Shared company knowledge base
✅ Developers keep personal docs private
✅ Viewers access all shared knowledge
```

## 🔧 Technical Changes

### 1. Upload Endpoint
```javascript
// Automatically mark admin uploads as public
const isPublic = req.user.role === 'admin' ? 1 : 0;
```

### 2. Document Retrieval
```javascript
// Get user's docs + all public docs
const userDocs = getUserDocs(userId);
const publicDocs = getPublicDocs(); // Admin uploads
return [...userDocs, ...publicDocs];
```

### 3. UI Indicator
```javascript
// Show badge on shared docs
{doc.shared && <span>Shared by Admin</span>}
```

## 📝 Testing Commands

```bash
# Test as Admin
1. Login: admin / admin123
2. Upload: company_handbook.pdf
3. Verify: See in Documents tab

# Test as Developer
1. Login: developer user
2. Check Documents tab
3. ✅ Should see company_handbook.pdf with "Shared by Admin"
4. Upload: personal_notes.txt
5. ✅ Should see both docs

# Test as Viewer
1. Login: viewer user
2. Check Documents tab (if visible) or Chat
3. ✅ Should see company_handbook.pdf
4. ❌ Should NOT see developer's personal_notes.txt
5. Chat should work with shared docs
```

## 🎨 UI Changes

### Documents Tab Header
```
Before: "3 documents"
After:  "5 docs • 3 shared • Semantic search active"
              ↑ Shows count of shared docs
```

### Document List
```
Before:
📄 handbook.pdf
   50 chunks • 2.3 MB

After:
📄 handbook.pdf  [Shared by Admin] ← New badge
   50 chunks • 2.3 MB
```

## 💡 Best Practices

### Admin:
```
✅ DO upload: Company-wide documents
✅ DO upload: Training materials
✅ DO upload: Policies and procedures
❌ DON'T upload: Personal work
❌ DON'T upload: Drafts
```

### Developer:
```
✅ DO upload: Personal notes
✅ DO upload: Project-specific docs
✅ DO upload: Work in progress
ℹ️ KNOW: Your uploads stay private
ℹ️ KNOW: You can use admin docs too
```

### Viewer:
```
✅ DO use: All shared docs in chat
ℹ️ KNOW: Can't upload (read-only)
ℹ️ KNOW: See all admin knowledge
```

## 🚀 Benefits

### Organization:
✅ Single source of truth (admin curates)
✅ Consistent information for all
✅ Easy onboarding
✅ Knowledge preservation

### Users:
✅ Instant access to company knowledge
✅ Personal workspace maintained
✅ No permission requests needed
✅ Both shared + personal docs in chat

## ⚠️ Important Notes

1. **Admin docs are automatically shared**
   - Can't make them private
   - Consider this when uploading

2. **Developer docs are automatically private**
   - Only that developer sees them
   - Can't share with others (yet)

3. **Viewers are read-only**
   - Can chat with all shared docs
   - Cannot upload anything

4. **RAG uses all visible docs**
   - Shared admin docs
   - Personal docs (if developer)
   - Best context from both

## 📞 Quick Help

**"Can developers share docs?"**
→ Not yet. Only admin uploads are shared.

**"Can I make my admin doc private?"**
→ No. Admin uploads are always shared. Use a developer account for private docs.

**"Can viewers upload?"**
→ No. Viewers are read-only.

**"How do I know which docs are shared?"**
→ Look for "Shared by Admin" badge in Documents tab.

**"Do shared docs use my quota?"**
→ No quotas currently. All users can access shared docs freely.

---

**Perfect balance: Shared knowledge + Personal privacy** 🎯

Admin = Company librarian 📚
Developer = Personal workspace + library access 🔒📖
Viewer = Library patron 👁️📖