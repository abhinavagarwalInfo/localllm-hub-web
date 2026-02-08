# 🔧 Fix for JSDOM/Parse5 Error

## ❌ The Error

```
Error [ERR_REQUIRE_ESM]: require() of ES Module parse5/dist/index.js not supported
```

This happens because of version incompatibility between `jsdom` and `parse5`.

## ✅ Solution

### Option 1: Use Compatible Versions (RECOMMENDED)

```bash
# Uninstall current versions
npm uninstall jsdom @mozilla/readability

# Install compatible versions
npm install jsdom@22.1.0 @mozilla/readability
```

**Why?** JSDOM v22 is compatible with the latest parse5, while v23+ has ESM issues.

---

### Option 2: Alternative - Use cheerio instead of jsdom

If Option 1 doesn't work, use cheerio (lightweight alternative):

```bash
# Uninstall jsdom
npm uninstall jsdom

# Install cheerio and node-html-parser
npm install cheerio node-html-parser
```

Then update the server code (see below).

---

## 📝 Updated Server Code (Using Cheerio - Option 2)

If you choose Option 2, replace the URL fetching route with this:

```javascript
import * as cheerio from 'cheerio';

// ==================== WEB URL FETCHING ROUTE (CHEERIO VERSION) ====================

app.post('/api/fetch-url', requireAuth, requireMinRole('developer'), async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`📡 Fetching URL: ${url}`);

    // Fetch the web page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LocalLLMBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML with cheerio
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer, ads
    $('script, style, nav, footer, aside, .ad, .advertisement, #comments').remove();

    // Try to get main content
    let content = '';
    const title = $('title').text() || $('h1').first().text() || validUrl.hostname;
    
    // Try to find main content area
    const mainSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '.content'
    ];

    for (const selector of mainSelectors) {
      const mainContent = $(selector).first();
      if (mainContent.length > 0) {
        content = mainContent.text();
        break;
      }
    }

    // Fallback: get body text
    if (!content || content.trim().length < 100) {
      content = $('body').text();
    }

    // Clean the text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (!content || content.length < 100) {
      return res.status(400).json({ 
        error: 'Could not extract meaningful content from URL.' 
      });
    }

    // Add title and metadata
    const fullContent = `
# ${title}

URL: ${url}
Fetched: ${new Date().toISOString()}

---

${content}
    `.trim();

    console.log(`✅ Extracted ${fullContent.length} characters from ${url}`);

    // Log activity
    activityQueries.log.run(
      req.user.id,
      'URL_FETCHED',
      `Fetched URL: ${url}`,
      req.ip
    );

    res.json({
      content: fullContent,
      title: title,
      url: url,
      excerpt: content.substring(0, 200) + '...',
      length: fullContent.length
    });

  } catch (error) {
    console.error('❌ URL fetch error:', error);
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Request timed out. The website might be slow or unreachable.' 
      });
    }

    if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
      return res.status(403).json({ 
        error: 'Access denied. The website might require authentication or block automated access.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch URL',
      message: error.message 
    });
  }
});
```

---

## 🚀 Complete Fix Steps

### Step 1: Choose Your Option

**Option 1 (Recommended):**
```bash
npm uninstall jsdom @mozilla/readability
npm install jsdom@22.1.0 @mozilla/readability
```

**Option 2 (If Option 1 fails):**
```bash
npm uninstall jsdom @mozilla/readability
npm install cheerio node-html-parser
```

### Step 2: Update server/index.js

**For Option 1:** Keep the current code (with JSDOM)

**For Option 2:** Replace the import and route with the cheerio version above

### Step 3: Restart Server
```bash
npm run dev
```

---

## ✅ Verification

After fixing, you should see:
```
╔════════════════════════════════════════════════════════════╗
║     🚀 LocalLLM Hub Server Running (Multi-User) 🚀        ║
║  Web Fetch:     ✅ ENABLED (Admin/Developer)               ║
╚════════════════════════════════════════════════════════════╝
```

No more errors!

---

## 🧪 Test It

```bash
curl -X POST http://localhost:3001/api/fetch-url \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url":"https://example.com"}'
```

Should return extracted content, not errors.

---

## 📊 Which Option to Choose?

| Option | Pros | Cons |
|--------|------|------|
| **Option 1** (jsdom@22) | Better content extraction, Readability integration | Larger dependency |
| **Option 2** (cheerio) | Lightweight, faster, no ESM issues | Simpler extraction (no Readability) |

**Recommendation:** Try Option 1 first. If you still get errors, use Option 2.

---

## 🐛 Still Having Issues?

If both options fail, check:

1. **Node.js version:**
   ```bash
   node --version  # Should be v18+
   ```

2. **Clear node_modules:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check package.json has "type": "module"**

---

Let me know which option you choose and I can provide the complete updated file!
