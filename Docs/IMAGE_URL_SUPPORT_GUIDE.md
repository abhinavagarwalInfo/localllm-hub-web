# 🎨 Enhanced Document Support - Images, Figma & Web URLs

## 🚀 New Features

Your document manager now supports:

✅ **Images with OCR** - JPG, PNG, GIF, WebP  
✅ **Figma Exports** - Extract text from design files  
✅ **Web URLs** - Scrape and analyze any web page  
✅ **All Previous Formats** - PDF, DOCX, XLSX, CSV, TXT  

---

## 📦 Installation

### Step 1: Install Required NPM Packages

```bash
# Install OCR library for images
npm install tesseract.js

# Install web scraping libraries
npm install jsdom@22.1.0 @mozilla/readability

# Verify existing libraries (should already be installed)
npm list pdfjs-dist mammoth xlsx
```

---

### Step 2: Update Frontend (DocumentManager)

```bash
# 1. Backup current file
cp src/components/DocumentManager.jsx src/components/DocumentManager.jsx.backup

# 2. Install enhanced version
cp DocumentManager_ENHANCED.jsx src/components/DocumentManager.jsx
```

---

### Step 3: Update Backend (Add URL Route)

**In your `server/index.js`:**

1. **Add imports at the top:**

```javascript
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
```

2. **Add the URL fetching route** (after document routes, before Ollama routes):

```javascript
// Copy the entire route from url_fetching_route.js
app.post('/api/fetch-url', requireAuth, requireMinRole('developer'), async (req, res) => {
  // ... (see url_fetching_route.js)
});
```

---

### Step 4: Restart Server

```bash
npm run dev
```

---

## 🎯 How to Use

### 1. **Upload Images (With OCR)**

**Supported formats:** JPG, JPEG, PNG, GIF, WebP

**Steps:**
1. Go to Documents tab
2. Click "Upload Documents & Images"
3. Select any image file
4. System performs OCR to extract text
5. Text is chunked and embedded for RAG

**Best for:**
- Screenshots with text
- Scanned documents
- Infographics with text
- Figma design exports
- Presentation slides as images

**Example:**
```
Upload: screenshot_pricing.png
OCR extracts: "Basic Plan: $29/mo, Pro Plan: $99/mo, Enterprise: Contact Us"
Chat: "What are the pricing tiers?"
Bot: "Based on the image, there are three tiers: Basic ($29/mo), Pro ($99/mo), and Enterprise (contact for pricing)."
```

---

### 2. **Upload Figma Exports**

**Supported formats:** .fig, .png, .jpg (from Figma)

**Steps:**
1. Export design from Figma as PNG/JPG
2. Upload to document manager
3. OCR extracts all visible text
4. Text is indexed for search

**Best for:**
- UI mockups with labels
- Design specs with annotations
- Wireframes with text
- Component libraries

**Example:**
```
Upload: dashboard_mockup.png (from Figma)
OCR extracts: "Welcome Dashboard, New Users: 1,234, Revenue: $45K, Top Products..."
Chat: "What metrics are shown in the dashboard?"
Bot: "The dashboard shows New Users (1,234), Revenue ($45K), and Top Products."
```

---

### 3. **Fetch Web Pages**

**Supported:** Any public web URL

**Steps:**
1. Go to Documents tab
2. Find "Fetch Web Page" section
3. Enter URL: `https://example.com/article`
4. Click "Fetch & Process"
5. System scrapes main content
6. Content is saved as document

**Best for:**
- Blog articles
- News articles
- Documentation pages
- Wikipedia articles
- Product pages

**Features:**
- Uses Mozilla Readability to extract main content
- Removes ads, navigation, footers
- Cleans and formats text
- Preserves article title and metadata

**Example:**
```
Fetch: https://techcrunch.com/2024/article-about-ai
System extracts: Article title, author, main content
Chat: "What does the TechCrunch article say about AI?"
Bot: "According to the article, [provides summary from scraped content]"
```

---

## 🎨 UI Features

### Web URL Section

```
┌─────────────────────────────────────────┐
│ 🌐 Fetch Web Page                       │
├─────────────────────────────────────────┤
│ [https://example.com/article          ] │
│                        [Fetch & Process] │
│                                          │
│ Enter any web page URL to extract and   │
│ analyze its content                      │
└─────────────────────────────────────────┘
```

### Upload Section

```
┌─────────────────────────────────────────┐
│ 📤 Upload Documents & Images             │
├─────────────────────────────────────────┤
│              📁                          │
│    Click to upload or drag and drop     │
│                                          │
│ Supported: PDF, DOCX, XLSX, CSV, TXT,   │
│ Images (JPG, PNG, GIF), Figma exports   │
└─────────────────────────────────────────┘
```

### Document Cards

```
┌──────────────────────────────────┐
│ 🖼️  screenshot.png               │
│                                  │
│ image-ocr     45 chunks          │
│                              [🗑] │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🌐  techcrunch_article          │
│                                  │
│ web-url      128 chunks  Shared  │
│ 🌐 techcrunch.com               │
│                              [🗑] │
└──────────────────────────────────┘
```

---

## 🧪 Testing

### Test 1: Image OCR
```bash
1. Find any screenshot with text
2. Upload to Documents
3. Wait for "OCR Progress: 100%"
4. Check document list - should show "image-ocr"
5. Ask chat: "What text is in the image?"
6. Should get extracted text
```

### Test 2: Figma Export
```bash
1. Export Figma design as PNG
2. Upload to Documents
3. System performs OCR
4. Ask: "What's in the Figma design?"
5. Should describe UI elements with text
```

### Test 3: Web URL
```bash
1. Go to Documents tab
2. Enter URL: https://en.wikipedia.org/wiki/Artificial_intelligence
3. Click "Fetch & Process"
4. Wait for processing
5. Ask: "What does Wikipedia say about AI?"
6. Should answer from Wikipedia content
```

---

## 📊 Processing Flow

### Image Processing:
```
Upload Image
    ↓
Tesseract OCR
    ↓
Extract Text
    ↓
Create Chunks (500 chars)
    ↓
Generate Embeddings
    ↓
Save to Database
    ↓
Ready for RAG
```

### Web URL Processing:
```
Enter URL
    ↓
Fetch HTML
    ↓
Mozilla Readability
    ↓
Extract Main Content
    ↓
Clean Text
    ↓
Create Chunks
    ↓
Generate Embeddings
    ↓
Save to Database
    ↓
Ready for RAG
```

---

## ⚙️ Technical Details

### OCR Configuration

```javascript
Tesseract.recognize(file, 'eng', {
  logger: m => {
    // Shows progress: "OCR Progress: 45%"
  }
})
```

**Supported languages:** English (default)  
**Accuracy:** 85-95% for clear text  
**Speed:** ~5-10 seconds per image  

### Web Scraping

**Technology:** Mozilla Readability  
**Features:**
- Removes ads and navigation
- Extracts main article content
- Preserves formatting
- Gets title and author

**Limitations:**
- Cannot access password-protected pages
- Cannot execute JavaScript
- Cannot access paywalled content
- Some sites block automated access

---

## 🔒 Security & Permissions

### File Upload
- **Who can upload:** Admin, Developer
- **Viewers:** Can only read shared documents
- **Admin documents:** Auto-shared to all users
- **Developer documents:** Private by default

### Web URL Fetching
- **Who can fetch:** Admin, Developer
- **Rate limiting:** 100 requests per 15 minutes
- **Timeout:** 10 seconds per request
- **User-Agent:** Identifies as bot

---

## 📝 File Type Support Matrix

| Type | Extension | OCR | Embedding | RAG |
|------|-----------|-----|-----------|-----|
| PDF | .pdf | ❌ | ✅ | ✅ |
| Word | .docx | ❌ | ✅ | ✅ |
| Excel | .xlsx, .xls | ❌ | ✅ | ✅ |
| CSV | .csv | ❌ | ✅ | ✅ |
| Text | .txt, .md | ❌ | ✅ | ✅ |
| **Images** | **.jpg, .png, .gif** | **✅** | **✅** | **✅** |
| **Figma** | **.fig, .png** | **✅** | **✅** | **✅** |
| **Web** | **URL** | **❌** | **✅** | **✅** |

---

## 💡 Use Cases

### Design Team
```
Upload: Figma designs as PNG
OCR: Extracts button labels, headings, text
Chat: "What buttons are in the checkout flow?"
Bot: Lists all buttons found in design
```

### Content Team
```
Fetch: Blog post URL
System: Extracts article content
Chat: "Summarize the blog post"
Bot: Provides summary from fetched content
```

### Product Team
```
Upload: Screenshots of competitor apps
OCR: Extracts UI text and labels
Chat: "What features does competitor X have?"
Bot: Lists features based on screenshot text
```

### Research Team
```
Fetch: Multiple research articles
System: Indexes all content
Chat: "Compare findings across articles"
Bot: Synthesizes information from all sources
```

---

## 🐛 Troubleshooting

### Issue: OCR not working

**Symptoms:** Image uploads fail or no text extracted

**Solutions:**
1. Check if tesseract.js is installed: `npm list tesseract.js`
2. Try clearer images with readable text
3. Check console for OCR progress
4. Ensure image has actual text (not purely graphical)

### Issue: URL fetch fails

**Symptoms:** "Failed to fetch URL" error

**Common causes:**
1. **CORS issues** - Some sites block external requests
2. **Authentication required** - Page behind login
3. **Paywall** - Content not accessible
4. **JavaScript required** - Site needs JS rendering

**Solutions:**
- Try different URL
- Check if page is publicly accessible
- Verify URL is correct
- Some sites block automated access

### Issue: No text detected in image

**Symptoms:** "No text detected in image"

**Solutions:**
1. Ensure image has visible text
2. Try higher resolution image
3. Check if text is clear and readable
4. Some stylized fonts may not be recognized

---

## 🎯 Best Practices

### For Images:
✅ Use high-resolution images  
✅ Ensure text is clear and readable  
✅ Avoid highly stylized fonts  
✅ Good lighting and contrast  
❌ Don't use blurry or pixelated images  

### For Web URLs:
✅ Use article/blog URLs (not homepages)  
✅ Verify page is publicly accessible  
✅ Use specific article URLs  
✅ Check content is HTML-based  
❌ Don't use JavaScript-heavy SPAs  
❌ Don't use paywalled content  

### For Figma:
✅ Export at 2x or 3x resolution  
✅ Include text layers in export  
✅ Use PNG format for best quality  
✅ Export frames with text annotations  

---

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",      // OCR for images
    "jsdom": "^23.0.0",             // HTML parsing
    "@mozilla/readability": "^0.5.0", // Content extraction
    "pdfjs-dist": "^3.11.174",      // PDF processing
    "mammoth": "^1.6.0",            // DOCX processing
    "xlsx": "^0.18.5"               // Excel processing
  }
}
```

---

## ✅ Success Checklist

After installation:

- [ ] `npm install` completed successfully
- [ ] tesseract.js installed
- [ ] jsdom and @mozilla/readability installed
- [ ] DocumentManager.jsx updated
- [ ] URL route added to server/index.js
- [ ] Server restarted
- [ ] Can upload images
- [ ] OCR works on images
- [ ] Can fetch web URLs
- [ ] Web content is extracted
- [ ] All documents appear in list
- [ ] RAG works with new document types

---

## 🎉 Summary

**New Capabilities:**

✅ **Image OCR** - Extract text from any image  
✅ **Figma Support** - Analyze design exports  
✅ **Web Scraping** - Fetch and index web pages  
✅ **Enhanced RAG** - Query all content types  
✅ **Better UX** - Clean, intuitive interface  

**Supported Total:**
- 8+ file types
- Images with OCR
- Web URLs
- Figma exports

**Your RAG system is now multi-modal!** 🚀
