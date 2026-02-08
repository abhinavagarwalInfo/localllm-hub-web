# Document Sharing System

## 📚 How Document Access Works

### Document Visibility Rules

| Uploaded By | Visible To | Who Can Use in Chat |
|-------------|------------|---------------------|
| **Admin** | Everyone | Everyone ✅ |
| **Developer** | Only that developer | Only that developer |
| **Viewer** | - (can't upload) | - |

## 🎯 Use Case

**Perfect for:**
- Company knowledge base (admin uploads)
- Team collaboration (everyone uses same docs)
- Centralized document management
- Shared reference materials

## 📖 Example Scenario

### Setup: Small Company

**Admin uploads:**
- `company_handbook.pdf`
- `product_catalog.xlsx`
- `pricing_policy.docx`

**Developer uploads:**
- `project_alpha_notes.txt` (personal work notes)
- `client_requirements.pdf` (specific project)

### Result:

**Alice (Admin):**
```
Documents visible:
✅ company_handbook.pdf (my upload - shared)
✅ product_catalog.xlsx (my upload - shared)
✅ pricing_policy.docx (my upload - shared)

Can use in chat: All 3 documents
```

**Bob (Developer):**
```
Documents visible:
✅ company_handbook.pdf (shared by admin) 📢
✅ product_catalog.xlsx (shared by admin) 📢
✅ pricing_policy.docx (shared by admin) 📢
✅ project_alpha_notes.txt (my upload - private)
✅ client_requirements.pdf (my upload - private)

Can use in chat: All 5 documents
```

**Carol (Viewer):**
```
Documents visible:
✅ company_handbook.pdf (shared by admin) 📢
✅ product_catalog.xlsx (shared by admin) 📢
✅ pricing_policy.docx (shared by admin) 📢

Can use in chat: All 3 shared documents
```

## 🔍 Visual Indicators

### In Documents Tab:

**Admin-uploaded documents:**
```
📄 company_handbook.pdf  [Shared by Admin]
   50 chunks • 2.3 MB • 23 pages • PDF
   🧠 ✅
```

**Developer personal documents:**
```
📄 my_notes.txt
   12 chunks • 156 KB
   🧠 ✅
```

### In Chat Header:

```
Chat with llama3.2:3b
🧠 5 docs • 3 shared • Semantic search active
```

## ⚙️ How It Works Technically

### 1. Upload Process

**Admin uploads a document:**
```javascript
// In server/index.js
const isPublic = req.user.role === 'admin' ? 1 : 0;

documentQueries.create.run(
  req.user.id,    // Owner: admin
  file.name,
  file.type,
  file.size,
  null,
  0,
  isPublic  // ← Set to 1 for admin, 0 for others
);
```

**Developer uploads a document:**
```javascript
const isPublic = req.user.role === 'admin' ? 1 : 0;
// ↑ Results in 0 for developer, so document is private
```

### 2. Retrieval Process

**When any user views documents:**
```javascript
// Get user's own documents
const userDocs = findByUserId(user.id);

// Get all public documents (admin uploads)
const publicDocs = findPublic(); // WHERE is_public = 1

// Combine both
const allDocs = [...userDocs, ...publicDocs];
```

### 3. Chat Context

**RAG system uses all visible documents:**
```javascript
// Vector store includes:
- User's own documents
- All admin-uploaded (public) documents

// When searching for relevant context:
searchAllDocuments(query) {
  // Searches through:
  // 1. User's personal docs
  // 2. Shared admin docs
  // Returns best matches from both
}
```

## 📊 Database Schema

```sql
documents
├── id
├── user_id          -- Who uploaded it
├── filename
├── is_public        -- 1 if admin upload, 0 otherwise
└── ...

-- Query for user's visible documents:
SELECT * FROM documents 
WHERE user_id = ? OR is_public = 1
```

## 🎨 UI Features

### Documents Tab

**Shows badge for shared documents:**
- Admin sees: All their uploads (no badge needed)
- Developers see: Their docs + Admin docs (with "Shared by Admin" badge)
- Viewers see: Only admin docs (with "Shared by Admin" badge)

### Chat Tab

**Header shows document count:**
```
5 docs • 3 shared • Semantic search active
       ↑
       Number of admin-shared docs
```

## 🔒 Security & Privacy

### What's Protected:
✅ Developer personal documents stay private
✅ Only their own documents are visible to them
✅ Can't access other developer's documents

### What's Shared:
✅ Admin uploads are automatically public
✅ Everyone can use admin docs in chat
✅ Promotes knowledge sharing

## 🛠️ Admin Best Practices

### What to Upload as Admin:

**Good for sharing:**
- Company policies
- Product documentation
- Training materials
- FAQs and guides
- Reference documents
- Templates

**Not for sharing (use developer account):**
- Personal notes
- Work in progress
- Draft documents
- Confidential project files

## 💡 Pro Tips

### For Admins:
1. Create a separate developer account for personal work
2. Use admin account only for company-wide documents
3. Keep shared docs updated and organized
4. Remove outdated shared documents

### For Developers:
1. Your personal uploads stay private
2. You can still upload project-specific docs
3. Benefit from shared company knowledge
4. Chat uses both personal + shared docs

### For Viewers:
1. Access all company knowledge
2. Can't clutter with uploads
3. Always see latest admin-shared docs
4. Perfect for read-only users

## 🔄 Workflow Example

### Onboarding New Employee

**Day 1 - Admin:**
```bash
# Upload company docs
- employee_handbook.pdf ✅ (shared)
- benefits_guide.pdf ✅ (shared)
- org_chart.xlsx ✅ (shared)
```

**Day 1 - New Employee (Developer role):**
```
Logs in → Sees 3 shared documents
Can immediately chat: "What are the vacation policies?"
AI uses employee_handbook.pdf to answer ✅
```

**Week 1 - New Employee uploads:**
```bash
# Upload personal learning notes
- react_notes.txt (private, only they see it)
- project_setup.md (private, only they see it)
```

**Week 2 - Employee chats:**
```
"Help me set up React based on my notes and company standards"
AI uses:
- react_notes.txt (their private doc)
- company coding standards (admin shared doc)
✅ Perfect combination!
```

## 📈 Benefits

### For Organization:
✅ Centralized knowledge management
✅ Consistent information for all users
✅ Easy onboarding
✅ Version control (admin updates shared docs)

### For Users:
✅ Access to company knowledge
✅ Personal workspace for own docs
✅ Combined context in chat (personal + shared)
✅ No permission hassles

### For Admins:
✅ Control over shared knowledge base
✅ Can update docs for everyone
✅ Clear ownership and responsibility

## 🔧 Advanced: Making Developer Docs Shareable

If you want to allow developers to optionally share documents, you can add a "Make Public" button. Contact for implementation!

## ✅ Testing Document Sharing

### Test 1: Admin Upload
```bash
1. Login as admin
2. Upload: company_policy.pdf
3. Logout
4. Login as developer
5. Go to Documents
6. ✅ Should see company_policy.pdf with "Shared by Admin" badge
7. Go to Chat
8. Ask: "What's in the company policy?"
9. ✅ Should get answer from the document
```

### Test 2: Developer Privacy
```bash
1. Login as developer1
2. Upload: personal_notes.txt
3. Logout
4. Login as developer2
5. Go to Documents
6. ✅ Should NOT see developer1's personal_notes.txt
7. ✅ Should only see admin-shared docs
```

### Test 3: Viewer Access
```bash
1. Login as viewer
2. Documents tab should be hidden (can't upload)
3. Go to Chat
4. Ask question using admin-shared docs
5. ✅ Should work perfectly
```

## 🎯 Summary

**Simple Rule:**
```
Admin uploads → Everyone can use ✅
Developer uploads → Only that developer can use
Viewer uploads → Not allowed
```

**Result:**
- Shared company knowledge
- Personal privacy maintained
- Everyone benefits from admin uploads
- Clean, simple permission model

---

**Your team now has a perfect balance of shared knowledge and personal privacy!** 📚🔒

Admin curates the company knowledge base, while developers maintain private workspaces.