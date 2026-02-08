# 📦 LocalLLM Hub - Document Upload Size Limits Guide

**Version:** 2.0.0  
**Last Updated:** January 2026  
**Author:** LocalLLM Hub Team

---

## 📋 Table of Contents

1. [Current Upload Limits](#current-upload-limits)
2. [Configuration Details](#configuration-details)
3. [How to Change Limits](#how-to-change-limits)
4. [System Constraints](#system-constraints)
5. [Performance Guidelines](#performance-guidelines)
6. [Recommended Limits by Use Case](#recommended-limits-by-use-case)
7. [Implementation Examples](#implementation-examples)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Current Upload Limits

### File Upload Size

The current maximum file size for uploads is configured in `server/index.js`:

```javascript
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
```

**Current Limit:** `50 MB per file`

### Request Body Size

JSON and form data limits are also set to match:

```javascript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

**Body Limit:** `50 MB`

---

## ⚙️ Configuration Details

### Where Limits are Defined

| Configuration | Location | Current Value | Purpose |
|---------------|----------|---------------|---------|
| **File Upload** | `server/index.js` (line ~60) | 50 MB | Maximum file size |
| **JSON Body** | `server/index.js` (line ~50) | 50 MB | API request size |
| **URL Encoded** | `server/index.js` (line ~51) | 50 MB | Form data size |
| **Chunk Size** | `DocumentManager.jsx` | 500 chars | Text chunking |
| **Embedding Input** | `DocumentManager.jsx` | 2000 chars | Ollama limit |

### File Types Supported

All file types have the same size limit:

- **Documents:** PDF, DOCX, XLSX, CSV, TXT, MD
- **Images:** JPG, PNG, GIF, WebP (with OCR)
- **Design:** Figma exports (PNG with OCR)
- **Web:** Any public URL

---

## 🔧 How to Change Limits

### Option 1: Standard Increase (100 MB)

Suitable for most professional use cases.

**Edit `server/index.js`:**

```javascript
// Increase file upload limit to 100 MB
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 },  // 100 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Increase request body limits
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
```

**Restart the server:**
```bash
npm run dev
```

### Option 2: Large Files (500 MB)

For enterprise or research applications.

```javascript
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
```

### Option 3: Very Large Files (1 GB+)

**⚠️ Warning:** Only use on high-performance servers.

```javascript
app.use(fileUpload({
  limits: { fileSize: 1024 * 1024 * 1024 },  // 1 GB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
```

### Option 4: Environment-Based Configuration

**Create `server/config.js`:**

```javascript
/**
 * Upload configuration based on environment
 */
export const UPLOAD_CONFIG = {
  development: {
    maxFileSize: 50 * 1024 * 1024,      // 50 MB
    maxFiles: 10,
    description: 'Development environment'
  },
  
  production: {
    maxFileSize: 200 * 1024 * 1024,     // 200 MB
    maxFiles: 50,
    description: 'Production environment'
  },
  
  enterprise: {
    maxFileSize: 1024 * 1024 * 1024,    // 1 GB
    maxFiles: 100,
    description: 'Enterprise environment'
  }
};

export const getUploadConfig = () => {
  const env = process.env.UPLOAD_ENV || process.env.NODE_ENV || 'development';
  return UPLOAD_CONFIG[env] || UPLOAD_CONFIG.development;
};
```

**Use in `server/index.js`:**

```javascript
import { getUploadConfig } from './config.js';

const config = getUploadConfig();

app.use(fileUpload({
  limits: { 
    fileSize: config.maxFileSize,
    files: config.maxFiles
  },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
```

**Set environment:**

```bash
# Development (50 MB)
export UPLOAD_ENV=development
npm run dev

# Production (200 MB)
export UPLOAD_ENV=production
npm run server

# Enterprise (1 GB)
export UPLOAD_ENV=enterprise
npm run server
```

---

## 🖥️ System Constraints

### 1. Ollama Embedding Limits

Each text chunk sent to Ollama for embedding has a hard limit:

```javascript
// In DocumentManager.jsx
const response = await fetch('/api/ollama/embeddings', {
  method: 'POST',
  body: JSON.stringify({
    model: 'nomic-embed-text',
    prompt: text.substring(0, 2000)  // ⚠️ Limited to 2000 chars
  })
});
```

**Embedding Limit:** `2000 characters per chunk`

Even if you upload a 1 GB file, it will be processed in 500-character chunks, and each chunk's embedding will use only the first 2000 characters.

### 2. Database Constraints

SQLite theoretical limits:

| Constraint | Limit |
|------------|-------|
| **Maximum Database Size** | 281 TB |
| **Maximum Text Field** | 1 GB |
| **Maximum BLOB** | 1 GB |
| **Maximum Row Size** | 1 GB |
| **Practical Limit** | Available disk space |

**Your database structure:**

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT,              -- Up to 1 GB per chunk
  embedding TEXT,                -- ~3-4 KB JSON array
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Memory Requirements

Approximate RAM needed for processing:

| File Size | RAM Required | Processing Time |
|-----------|--------------|-----------------|
| 10 MB | ~30-50 MB | ~30 seconds |
| 50 MB | ~150-200 MB | ~2-3 minutes |
| 100 MB | ~300-400 MB | ~5-6 minutes |
| 200 MB | ~600-800 MB | ~10-12 minutes |
| 500 MB | ~1.5-2 GB | ~25-30 minutes |
| 1 GB | ~3-4 GB | ~50-60 minutes |
| 2 GB | ~6-8 GB | ~2 hours |

**Your System:** MacBook M2 Pro with 32GB RAM

✅ **Can handle:** Up to 2 GB files comfortably  
⚠️ **Recommended max:** 500 MB for optimal performance

### 4. Temporary Storage

Files are temporarily stored during processing:

```javascript
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'  // macOS: /tmp, Linux: /tmp, Windows: %TEMP%
}));
```

**Ensure sufficient disk space:**
- Minimum: 2x largest file size
- Recommended: 5x largest file size

**Example:** For 500 MB files, have at least 2.5 GB free in `/tmp`

---

## ⚡ Performance Guidelines

### Processing Time by File Type

#### PDF Files

| Pages | File Size | Extraction | Chunking | Embedding | Total |
|-------|-----------|------------|----------|-----------|-------|
| 10 | ~2 MB | 5 sec | 1 sec | 10 sec | **~16 sec** |
| 50 | ~10 MB | 20 sec | 3 sec | 30 sec | **~53 sec** |
| 100 | ~20 MB | 40 sec | 5 sec | 60 sec | **~1.7 min** |
| 500 | ~100 MB | 3 min | 10 sec | 5 min | **~8 min** |
| 1000 | ~200 MB | 6 min | 20 sec | 10 min | **~16 min** |

#### DOCX Files

| Pages | File Size | Extraction | Chunking | Embedding | Total |
|-------|-----------|------------|----------|-----------|-------|
| 10 | ~500 KB | 2 sec | 1 sec | 5 sec | **~8 sec** |
| 50 | ~2 MB | 5 sec | 2 sec | 15 sec | **~22 sec** |
| 100 | ~5 MB | 10 sec | 3 sec | 30 sec | **~43 sec** |
| 500 | ~25 MB | 40 sec | 8 sec | 2 min | **~3 min** |

#### Excel Files

| Rows | File Size | Extraction | Chunking | Embedding | Total |
|------|-----------|------------|----------|-----------|-------|
| 1,000 | ~500 KB | 3 sec | 1 sec | 5 sec | **~9 sec** |
| 10,000 | ~5 MB | 10 sec | 3 sec | 20 sec | **~33 sec** |
| 100,000 | ~50 MB | 1 min | 10 sec | 3 min | **~4.5 min** |

#### Images (OCR)

| Resolution | File Size | OCR | Chunking | Embedding | Total |
|------------|-----------|-----|----------|-----------|-------|
| 1920x1080 | ~500 KB | 5 sec | 1 sec | 3 sec | **~9 sec** |
| 3840x2160 | ~2 MB | 10 sec | 1 sec | 5 sec | **~16 sec** |
| 7680x4320 | ~8 MB | 20 sec | 2 sec | 8 sec | **~30 sec** |

**OCR Accuracy:** 85-95% for clear text

#### Web URLs

| Content | Size | Fetch | Extract | Chunking | Embedding | Total |
|---------|------|-------|---------|----------|-----------|-------|
| Article | ~50 KB | 2 sec | 1 sec | 1 sec | 5 sec | **~9 sec** |
| Long Post | ~200 KB | 3 sec | 1 sec | 2 sec | 10 sec | **~16 sec** |
| Documentation | ~1 MB | 5 sec | 2 sec | 3 sec | 20 sec | **~30 sec** |

---

## 🎯 Recommended Limits by Use Case

### Personal Use

**Target Users:** Individual users, small projects

```javascript
maxFileSize: 50 * 1024 * 1024  // 50 MB
```

**Pros:**
- ✅ Fast processing (2-3 minutes max)
- ✅ Low memory usage (~200 MB)
- ✅ Handles most documents
- ✅ Quick responses

**Best For:**
- Research papers (10-50 pages)
- Business documents
- Personal notes
- Code documentation

### Small Team / Startup

**Target Users:** 5-10 users, collaborative work

```javascript
maxFileSize: 100 * 1024 * 1024  // 100 MB
```

**Pros:**
- ✅ Handles larger PDFs
- ✅ Multi-sheet Excel files
- ✅ High-res images
- ✅ Reasonable processing time (5-6 minutes)

**Best For:**
- Company reports
- Financial statements
- Marketing materials
- Design mockups

### Professional / Agency

**Target Users:** 10-50 users, heavy usage

```javascript
maxFileSize: 200 * 1024 * 1024  // 200 MB
```

**Pros:**
- ✅ Large document collections
- ✅ High-resolution scans
- ✅ Complex spreadsheets
- ⚠️ Processing: 10-12 minutes

**Best For:**
- Legal documents
- Medical records
- Architectural plans
- Large datasets

### Enterprise / Research

**Target Users:** 50+ users, institutional use

```javascript
maxFileSize: 500 * 1024 * 1024  // 500 MB
```

**Pros:**
- ✅ Archive-quality documents
- ✅ Multi-document collections
- ✅ Academic papers
- ⚠️ Processing: 25-30 minutes
- ⚠️ High RAM usage (1.5-2 GB)

**Requirements:**
- 16GB+ RAM recommended
- 32GB+ RAM ideal
- Fast SSD storage
- Dedicated processing queue

**Best For:**
- Research institutions
- University libraries
- Government archives
- Corporate knowledge bases

### Data Center / Cloud

**Target Users:** Unlimited users, cloud deployment

```javascript
maxFileSize: 1024 * 1024 * 1024  // 1 GB
```

**Pros:**
- ✅ Massive document processing
- ✅ Batch operations
- ⚠️ Processing: 50-60 minutes
- ⚠️ Very high RAM usage (3-4 GB per file)

**Requirements:**
- 64GB+ RAM
- High-performance SSD
- Load balancing
- Processing queue system
- Monitoring & alerts

**Best For:**
- Cloud service providers
- Document processing services
- Large enterprises
- Data analytics platforms

---

## 💻 Implementation Examples

### Example 1: Basic Limit Increase

**File:** `server/index.js`

```javascript
import express from 'express';
import fileUpload from 'express-fileupload';

const app = express();

// Increase to 100 MB
app.use(fileUpload({
  limits: { 
    fileSize: 100 * 1024 * 1024  // 100 MB
  },
  useTempFiles: true,
  tempFileDir: '/tmp/',
  debug: process.env.NODE_ENV === 'development'
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
```

### Example 2: Environment-Based Configuration

**File:** `server/config.js`

```javascript
/**
 * Upload configuration factory
 */
export class UploadConfig {
  static environments = {
    development: {
      maxFileSize: 50 * 1024 * 1024,
      maxFiles: 10,
      allowedTypes: ['pdf', 'docx', 'txt'],
      tempDir: '/tmp/',
      debug: true
    },
    
    production: {
      maxFileSize: 200 * 1024 * 1024,
      maxFiles: 50,
      allowedTypes: ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'png'],
      tempDir: '/var/tmp/uploads/',
      debug: false
    },
    
    enterprise: {
      maxFileSize: 1024 * 1024 * 1024,
      maxFiles: 100,
      allowedTypes: '*',
      tempDir: '/mnt/uploads/',
      debug: false
    }
  };

  static getConfig(env = process.env.NODE_ENV) {
    return this.environments[env] || this.environments.development;
  }

  static formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}
```

**File:** `server/index.js`

```javascript
import { UploadConfig } from './config.js';

const uploadConfig = UploadConfig.getConfig();

console.log(`📦 Upload Config: ${UploadConfig.formatSize(uploadConfig.maxFileSize)} max`);

app.use(fileUpload({
  limits: { 
    fileSize: uploadConfig.maxFileSize,
    files: uploadConfig.maxFiles
  },
  useTempFiles: true,
  tempFileDir: uploadConfig.tempDir,
  debug: uploadConfig.debug
}));
```

### Example 3: Role-Based Limits

Different limits for different user roles.

**File:** `server/middleware/upload-limits.js`

```javascript
/**
 * Role-based upload limit middleware
 */
export const getRoleLimits = (role) => {
  const limits = {
    viewer: {
      maxFileSize: 10 * 1024 * 1024,     // 10 MB
      maxFiles: 5,
      message: 'Viewers limited to 10 MB per file'
    },
    developer: {
      maxFileSize: 100 * 1024 * 1024,    // 100 MB
      maxFiles: 25,
      message: 'Developers can upload up to 100 MB'
    },
    admin: {
      maxFileSize: 500 * 1024 * 1024,    // 500 MB
      maxFiles: 100,
      message: 'Admins can upload up to 500 MB'
    }
  };

  return limits[role] || limits.viewer;
};

export const checkUploadLimit = (req, res, next) => {
  const userRole = req.user.role;
  const limits = getRoleLimits(userRole);
  
  if (!req.files || !req.files.files) {
    return next();
  }

  const files = Array.isArray(req.files.files) 
    ? req.files.files 
    : [req.files.files];

  // Check each file
  for (const file of files) {
    if (file.size > limits.maxFileSize) {
      return res.status(413).json({
        error: 'File too large',
        filename: file.name,
        size: file.size,
        limit: limits.maxFileSize,
        message: limits.message
      });
    }
  }

  // Check total files
  if (files.length > limits.maxFiles) {
    return res.status(413).json({
      error: 'Too many files',
      count: files.length,
      limit: limits.maxFiles,
      message: `Maximum ${limits.maxFiles} files allowed`
    });
  }

  next();
};
```

**Usage:**

```javascript
import { checkUploadLimit } from './middleware/upload-limits.js';

app.post('/api/upload', 
  requireAuth, 
  checkUploadLimit,  // Check role-based limits
  async (req, res) => {
    // Process upload
  }
);
```

### Example 4: Progress Tracking for Large Files

**File:** `src/components/DocumentManager.jsx`

```javascript
const uploadWithProgress = async (file) => {
  const formData = new FormData();
  formData.append('files', file);

  // Create XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percentComplete);
        setProcessingStatus(`Uploading: ${percentComplete}%`);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    // Send request
    xhr.open('POST', '/api/upload', true);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
};
```

---

## 🚨 Error Handling

### Server-Side Validation

**File:** `server/index.js`

```javascript
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    // Check if files exist
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const files = Array.isArray(req.files.files) 
      ? req.files.files 
      : [req.files.files];

    const MAX_SIZE = 50 * 1024 * 1024;  // 50 MB
    const MAX_FILES = 10;

    // Validate file count
    if (files.length > MAX_FILES) {
      return res.status(413).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        count: files.length,
        maxFiles: MAX_FILES,
        message: `You can upload maximum ${MAX_FILES} files at once`
      });
    }

    // Validate each file size
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        const maxSizeMB = (MAX_SIZE / 1024 / 1024).toFixed(0);
        
        return res.status(413).json({ 
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          filename: file.name,
          size: file.size,
          sizeFormatted: `${fileSizeMB} MB`,
          maxSize: MAX_SIZE,
          maxSizeFormatted: `${maxSizeMB} MB`,
          message: `File "${file.name}" (${fileSizeMB} MB) exceeds maximum size of ${maxSizeMB} MB`
        });
      }

      // Validate file type
      const allowedTypes = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'png'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExt)) {
        return res.status(415).json({
          error: 'Unsupported file type',
          code: 'UNSUPPORTED_TYPE',
          filename: file.name,
          type: fileExt,
          allowedTypes: allowedTypes,
          message: `File type ".${fileExt}" is not supported`
        });
      }
    }

    // Process files...
    const uploadedFiles = [];
    for (const file of files) {
      const fileData = {
        name: file.name,
        type: file.name.split('.').pop().toLowerCase(),
        content: file.data.toString('base64'),
        size: file.size
      };
      uploadedFiles.push(fileData);
    }

    res.json({ 
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Handle specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large',
        code: 'LIMIT_EXCEEDED',
        message: 'Upload exceeds maximum file size limit'
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ 
        error: 'Too many files',
        code: 'LIMIT_EXCEEDED',
        message: 'Upload exceeds maximum file count'
      });
    }

    res.status(500).json({ 
      error: 'Upload failed',
      code: 'SERVER_ERROR',
      message: error.message 
    });
  }
});
```

### Client-Side Validation

**File:** `src/components/DocumentManager.jsx`

```javascript
const validateFile = (file) => {
  const MAX_SIZE = 50 * 1024 * 1024;  // 50 MB
  const ALLOWED_TYPES = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'jpg', 'png', 'gif'];

  // Check size
  if (file.size > MAX_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    throw new Error(
      `File "${file.name}" is too large (${sizeMB} MB). Maximum size is 50 MB.`
    );
  }

  // Check type
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_TYPES.includes(ext)) {
    throw new Error(
      `File type ".${ext}" is not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`
    );
  }

  // Check if file is empty
  if (file.size === 0) {
    throw new Error(`File "${file.name}" is empty.`);
  }

  return true;
};

const handleFileUpload = async (e) => {
  const files = Array.from(e.target.files);
  
  if (files.length === 0) return;

  setError(null);

  try {
    // Validate all files first
    for (const file of files) {
      validateFile(file);
    }

    setUploading(true);
    setProcessingStatus('Uploading files...');

    // Process files
    for (const file of files) {
      await processFile(file);
    }

    setProcessingStatus('All files processed successfully!');
    setTimeout(() => setProcessingStatus(''), 3000);

  } catch (err) {
    console.error('Upload error:', err);
    setError(err.message);
  } finally {
    setUploading(false);
    e.target.value = '';  // Clear file input
  }
};
```

### User-Friendly Error Messages

**File:** `src/components/DocumentManager.jsx`

```javascript
// Show limit in UI
<div className="upload-section">
  <h3>
    <Upload size={20} />
    Upload Documents & Images
  </h3>
  
  <div className="upload-limits">
    <p className="limit-info">
      📦 <strong>Maximum file size:</strong> 50 MB per file
    </p>
    <p className="limit-info">
      📁 <strong>Maximum files:</strong> 10 files at once
    </p>
    <p className="limit-info">
      📋 <strong>Supported formats:</strong> PDF, DOCX, XLSX, CSV, TXT, MD, Images
    </p>
  </div>

  <label className="upload-box">
    <input
      type="file"
      multiple
      accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.jpg,.png,.gif"
      onChange={handleFileUpload}
      disabled={uploading}
    />
    {/* ... */}
  </label>
</div>

// Display errors clearly
{error && (
  <div className="error-message">
    <AlertCircle size={18} />
    <div className="error-content">
      <strong>Upload Error</strong>
      <p>{error}</p>
    </div>
  </div>
)}
```

---

## ✅ Best Practices

### 1. Always Validate on Both Sides

**Why:** Security and user experience

```javascript
// Client-side: Quick feedback
if (file.size > MAX_SIZE) {
  alert('File too large!');
  return;
}

// Server-side: Security enforcement
if (file.size > MAX_SIZE) {
  return res.status(413).json({ error: 'File too large' });
}
```

### 2. Show Limits to Users

**Why:** Prevents failed uploads

```javascript
<div className="upload-info">
  <p>Maximum file size: {formatBytes(MAX_SIZE)}</p>
  <p>Allowed types: {ALLOWED_TYPES.join(', ')}</p>
</div>
```

### 3. Provide Progress Feedback

**Why:** Better UX for large files

```javascript
// Show progress bar
<div className="upload-progress">
  <div 
    className="progress-bar" 
    style={{ width: `${uploadProgress}%` }}
  />
  <span>{uploadProgress}%</span>
</div>
```

### 4. Handle Errors Gracefully

**Why:** Clear error messages help users

```javascript
try {
  await uploadFile(file);
} catch (error) {
  if (error.code === 'FILE_TOO_LARGE') {
    setError(`File is too large. Please compress it or split into smaller files.`);
  } else if (error.code === 'UNSUPPORTED_TYPE') {
    setError(`This file type is not supported. Please convert to PDF or DOCX.`);
  } else {
    setError(`Upload failed: ${error.message}`);
  }
}
```

### 5. Use Appropriate Limits

**Why:** Balance performance and functionality

| Use Case | Recommended Limit | Reason |
|----------|------------------|--------|
| Personal | 50 MB | Fast, sufficient for most docs |
| Small Team | 100 MB | Handles larger files, still fast |
| Professional | 200 MB | Enterprise docs, reasonable time |
| Enterprise | 500 MB | Archives, high-end server needed |

### 6. Monitor Server Resources

**Why:** Prevent server overload

```javascript
// Add monitoring
import os from 'os';

app.post('/api/upload', async (req, res) => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMem = totalMem - freeMem;
  
  // Reject if memory usage > 80%
  if (usedMem / totalMem > 0.8) {
    return res.status(503).json({
      error: 'Server busy',
      message: 'Server is currently processing other requests. Please try again in a moment.'
    });
  }
  
  // Process upload...
});
```

### 7. Implement Rate Limiting

**Why:** Prevent abuse

```javascript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,  // 10 uploads per 15 minutes
  message: 'Too many uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/upload', uploadLimiter, async (req, res) => {
  // Process upload...
});
```

### 8. Clean Up Temporary Files

**Why:** Prevent disk space issues

```javascript
import fs from 'fs';

app.post('/api/upload', async (req, res) => {
  const tempFiles = [];
  
  try {
    // Process files...
    tempFiles.push(req.files.files.tempFilePath);
    
    // ... processing logic ...
    
  } finally {
    // Always clean up
    for (const tempFile of tempFiles) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }
    }
  }
});
```

### 9. Log Upload Activity

**Why:** Debugging and security

```javascript
app.post('/api/upload', requireAuth, async (req, res) => {
  const files = req.files.files;
  
  // Log upload attempt
  console.log(`Upload attempt by user ${req.user.id}:`, {
    fileCount: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    timestamp: new Date().toISOString()
  });
  
  // Log to database
  activityQueries.log.run(
    req.user.id,
    'DOCUMENT_UPLOAD',
    `Uploaded ${files.length} file(s)`,
    req.ip
  );
  
  // Process upload...
});
```

### 10. Provide File Size Formatting

**Why:** Human-readable sizes

```javascript
/**
 * Format bytes to human-readable size
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Usage
console.log(formatBytes(1024));       // "1 KB"
console.log(formatBytes(1048576));    // "1 MB"
console.log(formatBytes(52428800));   // "50 MB"
```

---

## 🔍 Troubleshooting

### Issue 1: "File Too Large" Error

**Symptoms:**
- Upload fails immediately
- Browser shows "413 Payload Too Large"
- Error message: "Request entity too large"

**Solutions:**

```javascript
// 1. Check server limit
console.log('Current limit:', app._router.stack
  .find(r => r.name === 'fileUpload')
  ?.handle?.limits?.fileSize
);

// 2. Increase limits
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 3. Restart server
npm run dev
```

### Issue 2: Upload Timeout

**Symptoms:**
- Large files timeout during upload
- Connection resets
- "Request timeout" error

**Solutions:**

```javascript
// Increase timeout in server
import timeout from 'connect-timeout';

app.use(timeout('300s'));  // 5 minutes

app.post('/api/upload', (req, res) => {
  if (!req.timedout) {
    // Process upload
  }
});
```

### Issue 3: Out of Memory

**Symptoms:**
- Server crashes during large file processing
- "JavaScript heap out of memory" error

**Solutions:**

```bash
# 1. Increase Node.js memory limit
node --max-old-space-size=4096 server/index.js

# Or in package.json
{
  "scripts": {
    "server": "node --max-old-space-size=4096 server/index.js"
  }
}
```

```javascript
// 2. Process files in batches
const processBatch = async (files, batchSize = 3) => {
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(processFile));
    
    // Force garbage collection between batches
    if (global.gc) {
      global.gc();
    }
  }
};
```

### Issue 4: Temporary Directory Full

**Symptoms:**
- "ENOSPC: no space left on device"
- Upload fails mid-process

**Solutions:**

```bash
# 1. Check temp directory space
df -h /tmp

# 2. Clean temp files
rm -rf /tmp/tmp-*

# 3. Use different directory with more space
mkdir -p /var/uploads/temp
```

```javascript
// 4. Configure different temp directory
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/var/uploads/temp/'  // Directory with more space
}));
```

### Issue 5: Nginx Reverse Proxy Limiting

**Symptoms:**
- Works locally but fails through Nginx
- 413 error from Nginx

**Solution:**

Edit Nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Increase client body size limit
    client_max_body_size 200M;
    
    # Increase timeouts
    client_body_timeout 300s;
    client_header_timeout 300s;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # Increase proxy timeouts
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        
        # Increase buffer sizes
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

Restart Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Issue 6: Frontend Request Timeout

**Symptoms:**
- Upload starts but times out
- No progress updates

**Solution:**

```javascript
// Increase fetch timeout
const uploadWithTimeout = async (file, timeoutMs = 300000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return await response.json();

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout - file may be too large or connection is slow');
    }
    throw error;
  }
};
```

---

## 📊 Quick Reference

### Default Limits

| Setting | Value | Location |
|---------|-------|----------|
| Max File Size | 50 MB | `server/index.js` |
| Max Request Body | 50 MB | `server/index.js` |
| Max Files Per Upload | Unlimited | Can be configured |
| Chunk Size | 500 chars | `DocumentManager.jsx` |
| Embedding Input | 2000 chars | `DocumentManager.jsx` |
| Temp Directory | `/tmp/` | `server/index.js` |

### Size Conversion

| Bytes | KB | MB | GB |
|-------|----|----|-----|
| 1,024 | 1 | 0.001 | 0.000001 |
| 1,048,576 | 1,024 | 1 | 0.001 |
| 52,428,800 | 51,200 | 50 | 0.05 |
| 104,857,600 | 102,400 | 100 | 0.1 |
| 524,288,000 | 512,000 | 500 | 0.5 |
| 1,073,741,824 | 1,048,576 | 1,024 | 1 |

### Recommended Limits by System RAM

| System RAM | Recommended Max File Size | Safe Concurrent Uploads |
|------------|--------------------------|------------------------|
| 8 GB | 50 MB | 2 |
| 16 GB | 100 MB | 3-4 |
| 32 GB | 500 MB | 5-6 |
| 64 GB | 1 GB | 8-10 |
| 128 GB | 2 GB | 10-15 |

### Processing Time Estimates

| File Size | PDF | DOCX | XLSX | Image OCR |
|-----------|-----|------|------|-----------|
| 10 MB | ~30 sec | ~15 sec | ~20 sec | ~40 sec |
| 50 MB | ~3 min | ~1 min | ~2 min | ~10 min |
| 100 MB | ~5 min | ~2 min | ~4 min | ~20 min |
| 500 MB | ~25 min | ~10 min | ~20 min | ~2 hours |

---

## 📞 Support

For questions or issues:

- **Documentation:** See README.md
- **GitHub Issues:** [github.com/yourusername/localllm-hub/issues](https://github.com/yourusername/localllm-hub/issues)
- **Email:** support@yourdomain.com

---

## 📝 Changelog

### Version 2.0.0 (Current)
- Default limit: 50 MB
- Support for 8+ file formats
- OCR for images
- Web URL fetching
- Role-based access control

### Future Enhancements
- [ ] Dynamic limit adjustment based on system resources
- [ ] Resumable uploads for very large files
- [ ] Compression before upload
- [ ] Background processing queue
- [ ] Multi-part upload for files > 1 GB

---

## 📄 License

MIT License - See LICENSE file for details

---

**Document Version:** 1.0.0  
**Last Updated:** January 30, 2026  
**Generated for:** LocalLLM Hub v2.0.0

---

<div align="center">

**For the latest documentation, visit:**  
[https://github.com/yourusername/localllm-hub](https://github.com/yourusername/localllm-hub)

</div>
