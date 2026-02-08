import { useState, useEffect } from 'react';
import { 
  Upload, FileText, Trash2, Download, AlertCircle, Loader2, 
  FileIcon, Image as ImageIcon, Globe, Figma, FileType 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { apiRequest } from '../utils/api';
import './DocumentManager.css';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function DocumentManager({ documents, setDocuments, vectorStore, setVectorStore, embeddings, setEmbeddings, user }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setError(null);
      const response = await apiRequest('/api/documents');
      
      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Response is not JSON');
        return;
      }

      const text = await response.text();
      if (!text) {
        console.warn('Empty response');
        return;
      }

      const data = JSON.parse(text);
      const docs = data.documents || [];

      setDocuments(docs);

      for (const doc of docs) {
        try {
          const chunksResponse = await apiRequest(`/api/documents/${doc.id}/chunks`);
          
          if (chunksResponse.ok) {
            const chunksData = await chunksResponse.json();
            const chunks = chunksData.chunks || [];
            
            const processedChunks = chunks.map(c => ({
              text: c.chunk_text,
              embedding: c.embedding ? (typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding) : [],
              chunkId: c.chunk_index,
              metadata: c.metadata ? (typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata) : {}
            }));

            setVectorStore(prev => new Map(prev).set(doc.filename, processedChunks));
            
            const docEmbeddings = processedChunks
              .map(chunk => chunk.embedding)
              .filter(emb => emb && emb.length > 0);
            
            if (docEmbeddings.length > 0) {
              setEmbeddings(prev => new Map(prev).set(doc.filename, docEmbeddings));
            }
          }
        } catch (err) {
          console.error(`Failed to load chunks for ${doc.filename}:`, err);
        }
      }
    } catch (err) {
      console.error('Load documents error:', err);
      setError('Failed to load documents');
    }
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setFetchingUrl(true);
    setError(null);
    setProcessingStatus('Fetching web page...');

    try {
      const response = await apiRequest('/api/fetch-url', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput })
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch URL');
      }

      const data = await response.json();
      
      const docName = new URL(urlInput).hostname + '_' + Date.now();
      
      await processTextContent(data.content, docName, 'web-url', {
        url: urlInput,
        title: data.title || 'Web Page',
        fetchedAt: new Date().toISOString()
      });

      setUrlInput('');
      setProcessingStatus('Web page processed successfully!');
      
      setTimeout(() => setProcessingStatus(''), 3000);
    } catch (err) {
      console.error('URL fetch error:', err);
      setError(`Failed to fetch URL: ${err.message}`);
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setProcessingStatus('Processing files...');

    try {
      for (const file of files) {
        await processFile(file);
      }
      
      setProcessingStatus('All files processed successfully!');
      setTimeout(() => setProcessingStatus(''), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const processFile = async (file) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    setProcessingStatus(`Processing ${file.name}...`);

    try {
      if (fileType.startsWith('image/') || fileName.endsWith('.fig')) {
        await processImage(file);
      }
      else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        await processPDF(file);
      }
      else if (fileName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
        await processDocx(file);
      }
      else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheetml')) {
        await processExcel(file);
      }
      else if (fileName.endsWith('.csv') || fileType === 'text/csv') {
        await processCsv(file);
      }
      else if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        await processText(file);
      }
      else {
        throw new Error(`Unsupported file type: ${file.name}`);
      }
    } catch (err) {
      throw new Error(`Failed to process ${file.name}: ${err.message}`);
    }
  };

  const processImage = async (file) => {
    setProcessingStatus(`Extracting text from ${file.name} using OCR...`);
    
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProcessingStatus(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      if (!text || text.trim().length < 10) {
        throw new Error('No text detected in image. Image might be purely graphical.');
      }

      const metadata = {
        type: 'image',
        fileType: file.type,
        size: file.size,
        name: file.name,
        isFigma: file.name.toLowerCase().endsWith('.fig') || file.name.toLowerCase().includes('figma'),
        ocrText: text.substring(0, 200) + '...',
        processedAt: new Date().toISOString()
      };

      await processTextContent(text, file.name, 'image-ocr', metadata);
    } catch (err) {
      console.error('Image OCR error:', err);
      throw new Error(`OCR failed: ${err.message}`);
    }
  };

  const processPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      setProcessingStatus(`Processing PDF page ${i}/${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    await processTextContent(fullText, file.name, 'pdf', {
      pages: pdf.numPages,
      size: file.size
    });
  };

  const processDocx = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    await processTextContent(result.value, file.name, 'docx', {
      size: file.size
    });
  };

  const processExcel = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';

    workbook.SheetNames.forEach(sheetName => {
      setProcessingStatus(`Processing Excel sheet: ${sheetName}...`);
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      fullText += `\n\n=== Sheet: ${sheetName} ===\n\n${csv}`;
    });

    await processTextContent(fullText, file.name, 'excel', {
      sheets: workbook.SheetNames.length,
      size: file.size
    });
  };

  const processCsv = async (file) => {
    const text = await file.text();
    await processTextContent(text, file.name, 'csv', {
      size: file.size
    });
  };

  const processText = async (file) => {
    const text = await file.text();
    await processTextContent(text, file.name, 'text', {
      size: file.size
    });
  };

  const processTextContent = async (text, fileName, fileType, metadata = {}) => {
    if (!text || text.trim().length === 0) {
      throw new Error('No text content found');
    }

    setProcessingStatus('Creating text chunks...');
    const chunks = createSmartChunks(text, 500, 50);

    setProcessingStatus('Generating embeddings...');
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunkText, index) => {
        try {
          const embedding = await generateEmbedding(chunkText);
          return {
            text: chunkText,
            embedding,
            metadata: {
              chunkIndex: index,
              source: fileName,
              type: fileType
            }
          };
        } catch (err) {
          console.warn(`Failed to generate embedding for chunk ${index}:`, err);
          return {
            text: chunkText,
            embedding: [],
            metadata: {
              chunkIndex: index,
              source: fileName,
              type: fileType
            }
          };
        }
      })
    );

    setProcessingStatus('Saving to database...');

    const response = await apiRequest('/api/documents/save', {
      method: 'POST',
      body: JSON.stringify({
        name: fileName,
        type: fileType,
        size: text.length,
        chunks: chunksWithEmbeddings,
        metadata
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save document');
    }

    setVectorStore(prev => new Map(prev).set(fileName, chunksWithEmbeddings));
    
    const embedList = chunksWithEmbeddings
      .map(c => c.embedding)
      .filter(e => e && e.length > 0);
    
    if (embedList.length > 0) {
      setEmbeddings(prev => new Map(prev).set(fileName, embedList));
    }

    await loadDocuments();
  };

  const createSmartChunks = (text, chunkSize = 500, overlap = 50) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-overlap / 10).join(' ') + ' ' + sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  };

  const generateEmbedding = async (text) => {
    try {
      const response = await apiRequest('/api/ollama/embeddings', {
        method: 'POST',
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text.substring(0, 2000)
        })
      })

      if (!response.ok) {
        throw new Error('Embedding generation failed');
      }

      const data = await response.json();
      return data.embedding;
    } catch (err) {
      console.warn('Embedding error:', err);
      return [];
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;

    try {
      const response = await apiRequest(`/api/documents/${doc.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setVectorStore(prev => {
        const newMap = new Map(prev);
        newMap.delete(doc.filename);
        return newMap;
      });

      setEmbeddings(prev => {
        const newMap = new Map(prev);
        newMap.delete(doc.filename);
        return newMap;
      });

      await loadDocuments();
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    }
  };

  const getFileIcon = (doc) => {
    const type = doc.file_type?.toLowerCase() || '';
    const metadata = doc.metadata || {};

    if (metadata.isFigma || type === 'image-ocr') return <Figma size={24} />;
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif'].includes(type)) return <ImageIcon size={24} />;
    if (type === 'web-url') return <Globe size={24} />;
    if (type === 'pdf') return <FileText size={24} />;
    return <FileIcon size={24} />;
  };

  return (
    <div className="document-manager">
      <div className="manager-header">
        <h2>
          <FileType size={28} />
          Document Manager
        </h2>
        <p>Upload documents, images, Figma designs, or fetch web pages for AI analysis</p>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {processingStatus && (
        <div className="processing-status">
          <Loader2 size={18} className="spin" />
          <span>{processingStatus}</span>
        </div>
      )}

      {/* Web URL Input */}
      <div className="url-input-section">
        <h3>
          <Globe size={20} />
          Fetch Web Page
        </h3>
        <div className="url-input-container">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/article"
            disabled={fetchingUrl}
          />
          <button
            onClick={handleUrlFetch}
            disabled={fetchingUrl || !urlInput.trim()}
            className="fetch-url-btn"
          >
            {fetchingUrl ? (
              <>
                <Loader2 size={18} className="spin" />
                Fetching...
              </>
            ) : (
              <>
                <Download size={18} />
                Fetch & Process
              </>
            )}
          </button>
        </div>
        <p className="url-hint">
          Enter any web page URL to extract and analyze its content
        </p>
      </div>

      {/* File Upload */}
      <div className="upload-section">
        <h3>
          <Upload size={20} />
          Upload Documents & Images
        </h3>
        <label className="upload-box">
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.fig"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Upload size={40} />
          <p>Click to upload or drag and drop</p>
          <span className="upload-formats">
            Supported: PDF, DOCX, XLSX, CSV, TXT, MD<br />
            Images (JPG, PNG, GIF), Figma exports
          </span>
        </label>
      </div>

      {/* Documents List */}
      <div className="documents-list">
        <h3>
          Your Documents <span>({documents.length})</span>
        </h3>
        
        {documents.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <p>No documents yet</p>
            <span>Upload files or fetch web pages to get started</span>
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map(doc => (
              <div 
                key={doc.id} 
                className="document-card"
                data-type={doc.file_type}
              >
                <div className="doc-icon">
                  {getFileIcon(doc)}
                </div>
                <div className="doc-info">
                  <h4>{doc.filename}</h4>
                  <div className="doc-meta">
                    <span className="doc-type">{doc.file_type}</span>
                    <span className="doc-chunks">{doc.chunks_count} chunks</span>
                    {doc.shared && <span className="doc-shared">Shared</span>}
                  </div>
                  {doc.metadata?.url && (
                    <a 
                      href={doc.metadata.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="doc-url"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe size={12} />
                      {new URL(doc.metadata.url).hostname}
                    </a>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc);
                  }}
                  className="delete-btn"
                  title="Delete document"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentManager;