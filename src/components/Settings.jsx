import { useState, useEffect } from 'react';
import { RefreshCw, Download, Server } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './Settings.css';

function SettingsPanel({ selectedModel, setSelectedModel, onRefreshStatus }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await apiRequest('/api/ollama/models');
      const data = await response.json();
      setAvailableModels(data.models || []);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1) + ' GB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3>Ollama Connection</h3>
          <div className="setting-item">
            <label>Server URL</label>
            <div className="server-info">
              <Server size={16} />
              <span>http://localhost:11434</span>
              <button onClick={onRefreshStatus} className="refresh-btn">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <h3>Available Models</h3>
            <button onClick={fetchModels} disabled={isLoadingModels} className="refresh-btn">
              <RefreshCw size={16} className={isLoadingModels ? 'spin' : ''} />
              Refresh
            </button>
          </div>

          {availableModels.length === 0 ? (
            <div className="empty-models">
              <Download size={32} />
              <p>No models found</p>
              <div className="model-instructions">
                <p>Install models using Ollama CLI:</p>
                <code>ollama pull llama3.2:3b</code>
                <code>ollama pull llama3.1:8b</code>
                <code>ollama pull mistral</code>
              </div>
            </div>
          ) : (
            <div className="models-list">
              {availableModels.map((model) => (
                <div
                  key={model.name}
                  className={`model-card ${selectedModel === model.name ? 'selected' : ''}`}
                  onClick={() => setSelectedModel(model.name)}
                >
                  <div className="model-info">
                    <h4>{model.name}</h4>
                    <div className="model-meta">
                      <span>{formatSize(model.size)}</span>
                      <span>•</span>
                      <span>Modified {formatDate(model.modified_at)}</span>
                    </div>
                  </div>
                  {selectedModel === model.name && (
                    <div className="selected-badge">Active</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>About</h3>
          <div className="about-info">
            <p><strong>LocalLLM Hub</strong></p>
            <p>Version 1.0.0</p>
            <p>A privacy-focused local LLM application</p>
            <p className="about-tech">Built with Electron, React, and Ollama</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsPanel;