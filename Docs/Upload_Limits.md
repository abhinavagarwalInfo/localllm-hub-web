Looking at the project code, here are the document upload limits:
📊 Current Upload Limits
File Upload Size Limit
javascript

// In server/index.js
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

Current Limit: 50 MB per file
Request Body Size Limit
javascript

// In server/index.js
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

Body Limit: 50 MB
🔧 How to Change Upload Limits
Option 1: Increase to 100 MB

Edit server/index.js:
javascript

// File upload limit
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 },  // 100 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Request body limits
app.use(express.json({ limit: '100mb' }));
app.use(express.urlcodencoded({ extended: true, limit: '100mb' }));

Option 2: Increase to 500 MB
javascript

app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

Option 3: Remove Limit (Not Recommended)
javascript

app.use(fileUpload({
  limits: { fileSize: Infinity },  // No limit
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ extended: true, limit: '50gb' }));

⚠️ Important Considerations
1. Ollama Embedding Limits
javascript

// In DocumentManager.jsx - embedding generation
body: JSON.stringify({
  model: 'nomic-embed-text',
  prompt: text.substring(0, 2000)  // Limited to 2000 chars per chunk
})

Embedding per chunk: 2000 characters max

Even if you upload a 1 GB file, each chunk is limited to 2000 characters for embedding generation.
2. Database Constraints

SQLite has these limits:

    Maximum database size: 281 TB (theoretical)
    Maximum text field: 1 GB
    Practical limit: Depends on disk space

Chunks table stores:

    chunk_text - TEXT (up to 1 GB per chunk)
    embedding - TEXT (JSON array, ~3-4 KB per embedding)

3. Memory Constraints

Processing large files requires RAM:
File Size	Estimated RAM Needed
50 MB	~150-200 MB
100 MB	~300-400 MB
500 MB	~1.5-2 GB
1 GB	~3-4 GB

Your System: M2 Pro with 32GB RAM ✅ (Can handle large files)
4. Processing Time

Approximate processing times:
Operation	50 MB File	100 MB File	500 MB File
PDF Text Extraction	~30 sec	~60 sec	~5 min
Chunking	~5 sec	~10 sec	~30 sec
Embedding Generation	~2 min	~4 min	~20 min
Total	~3 min	~5 min	~25 min
🎯 Recommended Limits by Use Case
General Use (Current)
javascript

fileSize: 50 * 1024 * 1024  // 50 MB

    ✅ Good for most PDFs, documents
    ✅ Fast processing
    ✅ Reasonable memory usage

Heavy Documents
javascript

fileSize: 200 * 1024 * 1024  // 200 MB

    ✅ Large PDFs with images
    ✅ Big Excel files
    ✅ High-resolution OCR images

Archive/Research
javascript

fileSize: 1024 * 1024 * 1024  // 1 GB

    ✅ Academic papers collections
    ✅ Large datasets
    ⚠️ Slower processing
    ⚠️ Higher RAM usage

Enterprise
javascript

fileSize: 5 * 1024 * 1024 * 1024  // 5 GB

    ✅ Corporate document archives
    ⚠️ Requires high-end server
    ⚠️ Very slow processing
    ⚠️ Consider batch processing

📝 Complete Configuration Example

Create server/config.js:
javascript

/**
 * Upload configuration
 * @module server/config
 */

/**
 * File upload limits based on environment
 * @constant
 */
export const UPLOAD_CONFIG = {
  // Development - smaller limits for testing
  development: {
    maxFileSize: 50 * 1024 * 1024,  // 50 MB
    maxFiles: 10,
    allowedTypes: ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'png']
  },
  
  // Production - larger limits
  production: {
    maxFileSize: 200 * 1024 * 1024,  // 200 MB
    maxFiles: 50,
    allowedTypes: ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'png', 'gif', 'webp']
  },
  
  // Enterprise - very large limits
  enterprise: {
    maxFileSize: 1024 * 1024 * 1024,  // 1 GB
    maxFiles: 100,
    allowedTypes: '*'
  }
};

/**
 * Get config for current environment
 */
export const getUploadConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return UPLOAD_CONFIG[env] || UPLOAD_CONFIG.development;
};

Then use in server/index.js:
javascript

import { getUploadConfig } from './config.js';

const uploadConfig = getUploadConfig();

app.use(fileUpload({
  limits: { 
    fileSize: uploadConfig.maxFileSize,
    files: uploadConfig.maxFiles
  },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.json({ limit: `${uploadConfig.maxFileSize}` }));
app.use(express.urlencoded({ 
  extended: true, 
  limit: `${uploadConfig.maxFileSize}` 
}));

🚨 Error Handling for Large Files

Add better error messages:
javascript

// In server/index.js - upload route
app.post('/api/upload', requireAuth, requireMinRole('developer'), async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
    const maxSize = 50 * 1024 * 1024;  // 50 MB

    // Check file sizes
    for (const file of files) {
      if (file.size > maxSize) {
        return res.status(413).json({ 
          error: 'File too large',
          filename: file.name,
          size: file.size,
          maxSize: maxSize,
          message: `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum size of ${(maxSize / 1024 / 1024).toFixed(0)} MB`
        });
      }
    }

    // Process files...
    
  } catch (error) {
    if (error.message.includes('File too large')) {
      return res.status(413).json({ 
        error: 'File too large',
        message: 'Upload exceeds maximum file size limit'
      });
    }
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

💡 Best Practices
1. Show Limit to Users

In DocumentManager.jsx:
javascript

<div className="upload-section">
  <h3>Upload Documents & Images</h3>
  <p className="upload-limit">Maximum file size: 50 MB per file</p>
  {/* ... upload box ... */}
</div>

2. Validate on Frontend
javascript

const handleFileUpload = async (e) => {
  const files = Array.from(e.target.files);
  const MAX_SIZE = 50 * 1024 * 1024;  // 50 MB

  // Check sizes before upload
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      setError(`File "${file.name}" is too large. Maximum size is 50 MB.`);
      e.target.value = '';  // Clear input
      return;
    }
  }

  // Proceed with upload...
};

3. Show Progress for Large Files
javascript

const uploadLargeFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      setUploadProgress(percentCompleted);
    }
  });
};

📊 Summary
Current Limits:

    File Size: 50 MB per file ✅
    Request Body: 50 MB ✅
    Chunk Size: 500 characters ✅
    Embedding Input: 2000 characters per chunk ✅

Recommended Changes:

    General Use: Keep at 50 MB
    Power Users: Increase to 100-200 MB
    Enterprise: 500 MB - 1 GB with proper server

To Change:

    Edit fileSize limit in server/index.js
    Update express.json() and express.urlencoded() limits
    Add frontend validation
    Update user-facing messages
    Test with large files

Your system (M2 Pro, 32GB RAM) can easily handle files up to 500 MB without issues! 🚀
