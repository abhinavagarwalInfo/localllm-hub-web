import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, LineChart, BarChart3, Target, Brain, Zap, Activity } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './Predictions.css';

function Predictions({ documents = [], user }) {
  const [selectedDocument, setSelectedDocument] = useState('');
  const [manualData, setManualData] = useState('');
  const [forecastPeriods, setForecastPeriods] = useState(7);
  const [forecastMethod, setForecastMethod] = useState('ensemble');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Debug logging
  useEffect(() => {
    console.log('[Predictions] Documents received:', documents);
    console.log('[Predictions] Documents count:', documents?.length || 0);
  }, [documents]);

  const forecastOptions = [
    { value: 3, label: '3 Days' },
    { value: 7, label: '7 Days' },
    { value: 14, label: '14 Days' },
    { value: 30, label: '30 Days' }
  ];

  const methodOptions = [
    { value: 'ensemble', label: 'Ensemble (Best)', description: 'Combines all methods for highest accuracy' },
    { value: 'linear', label: 'Linear Regression', description: 'Best for steady trends' },
    { value: 'ema', label: 'Exponential MA', description: 'Emphasizes recent data' },
    { value: 'ma', label: 'Moving Average', description: 'Smooths out noise' }
  ];

  const handleRunPrediction = async () => {
    setError('');
    setResults(null);

    // Parse manual data
    let dataArray = [];
    if (manualData.trim()) {
      dataArray = manualData
        .split(',')
        .map(val => parseFloat(val.trim()))
        .filter(val => !isNaN(val));
    }

    if (dataArray.length < 3) {
      setError('Please enter at least 3 comma-separated numbers (e.g., 100, 105, 103, 110)');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest('/api/analytics/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataArray,
          options: {
            forecastPeriods: parseInt(forecastPeriods),
            method: forecastMethod
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data);
      } else {
        setError(data.error || 'Prediction failed');
      }
    } catch (err) {
      console.error('[Predictions] Error:', err);
      setError('Error running prediction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!selectedDocument) {
      setError('Please select a document');
      return;
    }

    setError('');
    setResults(null);
    setLoading(true);

    try {
      console.log('[Predictions] Analyzing document:', selectedDocument);
      
      const response = await apiRequest('/api/analytics/predict-from-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: parseInt(selectedDocument),
          options: {
            forecastPeriods: parseInt(forecastPeriods),
            method: forecastMethod
          }
        })
      });

      const data = await response.json();
      console.log('[Predictions] Response:', data);

      if (response.ok) {
        setResults(data);
      } else {
        setError(data.error || data.message || 'Document analysis failed');
        if (data.hint) {
          setError(prev => `${prev}\n\nHint: ${data.hint}`);
        }
      }
    } catch (err) {
      console.error('[Predictions] Error:', err);
      setError('Error analyzing document: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'upward':
        return <TrendingUp className="trend-icon up" />;
      case 'downward':
        return <TrendingDown className="trend-icon down" />;
      default:
        return <Minus className="trend-icon stable" />;
    }
  };

  const getRiskBadge = (risk) => {
    const badges = {
      low: { color: 'green', icon: '✓', label: 'Low Risk' },
      medium: { color: 'yellow', icon: '⚠', label: 'Medium Risk' },
      high: { color: 'orange', icon: '⚠', label: 'High Risk' },
      extreme: { color: 'red', icon: '⚠⚠', label: 'Extreme Risk' }
    };

    const badge = badges[risk] || badges.medium;
    return (
      <span className={`risk-badge risk-${badge.color}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  return (
    <div className="predictions-container">
      <div className="predictions-header">
        <div>
          <h2>
            <Brain size={28} />
            Predictive Analytics
          </h2>
          <p>AI-powered forecasting and trend analysis</p>
        </div>
      </div>

      <div className="predictions-content">
        {/* Input Section */}
        <div className="prediction-inputs">
          <div className="input-section">
            <h3>
              <Target size={20} />
              Data Source
            </h3>

            {/* Method 1: Analyze Document */}
            <div className="input-group">
              <label>Analyze Uploaded Document</label>
              <div className="input-row">
                <select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select a document...</option>
                  {Array.isArray(documents) && documents.length > 0 ? (
                    documents.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename || doc.name || `Document ${doc.id}`} ({doc.file_type || doc.type || 'file'})
                      </option>
                    ))
                  ) : (
                    <option disabled>No documents uploaded yet</option>
                  )}
                </select>
                <button
                  onClick={handleAnalyzeDocument}
                  disabled={!selectedDocument || loading}
                  className="analyze-btn"
                >
                  <LineChart size={18} />
                  Analyze Document
                </button>
              </div>
              <p className="help-text">
                Automatically extracts prices and numeric data from your document
                {documents && documents.length > 0 && ` (${documents.length} documents available)`}
              </p>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            {/* Method 2: Manual Entry */}
            <div className="input-group">
              <label>Enter Data Manually</label>
              <textarea
                value={manualData}
                onChange={(e) => setManualData(e.target.value)}
                placeholder="Enter comma-separated values (e.g., 100, 102, 105, 103, 108, 110, 115)"
                rows={3}
                disabled={loading}
              />
              <p className="help-text">
                Minimum 3 values required • More data = better accuracy
              </p>
            </div>

            <button
              onClick={handleRunPrediction}
              disabled={!manualData.trim() || loading}
              className="predict-btn primary"
            >
              <Zap size={20} />
              Run Prediction
            </button>
          </div>

          {/* Configuration */}
          <div className="config-section">
            <h3>
              <Activity size={20} />
              Configuration
            </h3>

            <div className="input-group">
              <label>Forecast Period</label>
              <div className="radio-group">
                {forecastOptions.map(option => (
                  <label key={option.value} className="radio-option">
                    <input
                      type="radio"
                      name="forecast-period"
                      value={option.value}
                      checked={forecastPeriods === option.value}
                      onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
                      disabled={loading}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Forecast Method</label>
              <select
                value={forecastMethod}
                onChange={(e) => setForecastMethod(e.target.value)}
                disabled={loading}
              >
                {methodOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="help-text method-description">
                {methodOptions.find(m => m.value === forecastMethod)?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <AlertTriangle size={20} />
            <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Running predictive analysis...</p>
          </div>
        )}

        {/* Results Display */}
        {results && !loading && (
          <div className="prediction-results">
            {/* Summary Cards */}
            <div className="results-grid">
              <div className="result-card summary-card">
                <h4>Current Status</h4>
                <div className="card-content">
                  <div className="stat-large">
                    {results.summary.currentValue}
                    <span className={`change ${parseFloat(results.summary.changePercent) >= 0 ? 'positive' : 'negative'}`}>
                      {parseFloat(results.summary.changePercent) >= 0 ? '+' : ''}
                      {results.summary.changePercent}%
                    </span>
                  </div>
                  <div className="trend-display">
                    {getTrendIcon(results.summary.trend)}
                    <span className="trend-label">
                      {results.summary.trend.charAt(0).toUpperCase() + results.summary.trend.slice(1)} Trend
                    </span>
                    <span className="confidence-badge">
                      {results.summary.trendConfidence}% confidence
                    </span>
                  </div>
                </div>
              </div>

              <div className="result-card">
                <h4>Volatility Analysis</h4>
                <div className="card-content">
                  <div className="stat-row">
                    <span>Current:</span>
                    <strong>{results.volatility.current}%</strong>
                  </div>
                  <div className="stat-row">
                    <span>Annualized:</span>
                    <strong>{results.volatility.annualized}%</strong>
                  </div>
                  <div className="stat-row">
                    <span>Risk Level:</span>
                    {getRiskBadge(results.volatility.risk)}
                  </div>
                </div>
              </div>

              <div className="result-card">
                <h4>Key Levels</h4>
                <div className="card-content">
                  <div className="stat-row">
                    <span>Support:</span>
                    <strong className="support">{results.levels.support}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Resistance:</span>
                    <strong className="resistance">{results.levels.resistance}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Mean:</span>
                    <strong>{results.levels.mean}</strong>
                  </div>
                </div>
              </div>

              <div className="result-card forecast-card">
                <h4>Forecast Summary</h4>
                <div className="card-content">
                  <div className="stat-row">
                    <span>Method:</span>
                    <strong>{results.forecast.method.toUpperCase()}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Periods:</span>
                    <strong>{results.forecast.periods} days</strong>
                  </div>
                  <div className="stat-row">
                    <span>Expected Change:</span>
                    <strong className={parseFloat(results.forecast.expectedChange) >= 0 ? 'positive' : 'negative'}>
                      {parseFloat(results.forecast.expectedChange) >= 0 ? '+' : ''}
                      {results.forecast.expectedChange}%
                    </strong>
                  </div>
                  <div className="confidence-meter">
                    <span>Confidence:</span>
                    <div className="meter-bar">
                      <div 
                        className={`meter-fill ${getConfidenceColor(results.forecast.confidence)}`}
                        style={{ width: `${results.forecast.confidence}%` }}
                      >
                        {results.forecast.confidence}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Forecast Values */}
            <div className="forecast-values-section">
              <h3>
                <BarChart3 size={20} />
                Predicted Values
              </h3>
              <div className="forecast-chart">
                {results.forecast.values.map((value, index) => (
                  <div key={index} className="forecast-bar">
                    <div className="bar-label">Day {index + 1}</div>
                    <div className="bar-container">
                      <div 
                        className="bar-fill"
                        style={{ 
                          height: `${(value / Math.max(...results.forecast.values)) * 100}%` 
                        }}
                        title={value}
                      >
                        <span className="bar-value">{value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            {results.insights && results.insights.length > 0 && (
              <div className="insights-section">
                <h3>
                  <Brain size={20} />
                  AI Insights
                </h3>
                <div className="insights-list">
                  {results.insights.map((insight, index) => (
                    <div key={index} className="insight-item">
                      <div className="insight-icon">💡</div>
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Metadata (if from document) */}
            {results.documentData && (
              <div className="metadata-section">
                <h4>Data Source</h4>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <span>Document ID:</span>
                    <strong>{results.documentData.documentId}</strong>
                  </div>
                  <div className="metadata-item">
                    <span>Data Points:</span>
                    <strong>{results.documentData.dataPoints}</strong>
                  </div>
                  {results.documentData.dateRange && (
                    <>
                      <div className="metadata-item">
                        <span>First Date:</span>
                        <strong>{results.documentData.dateRange.first}</strong>
                      </div>
                      <div className="metadata-item">
                        <span>Last Date:</span>
                        <strong>{results.documentData.dateRange.last}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!results && !loading && !error && (
          <div className="empty-state">
            <Brain size={64} />
            <h3>Ready for Prediction</h3>
            <p>Select a document or enter data manually to start forecasting</p>
            <div className="example-data">
              <h4>Quick Example:</h4>
              <p>Try these sample stock prices:</p>
              <code>150, 152, 151, 155, 157, 156, 158, 160, 162, 164</code>
              <button 
                onClick={() => setManualData('150, 152, 151, 155, 157, 156, 158, 160, 162, 164')}
                className="load-example-btn"
              >
                Load Example
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Predictions;