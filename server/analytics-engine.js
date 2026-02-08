/**
 * analytics-engine.js
 * 
 * Predictive analytics and time-series forecasting engine
 * ES Module version for use with server/index.js
 */

// ════════════════════════════════════════════════════════════
//  Statistical Functions
// ════════════════════════════════════════════════════════════

function mean(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function variance(arr) {
  const avg = mean(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
}

function standardDeviation(arr) {
  return Math.sqrt(variance(arr));
}

function correlation(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// ════════════════════════════════════════════════════════════
//  Linear Regression
// ════════════════════════════════════════════════════════════

function linearRegression(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

function predict(x, model) {
  return model.slope * x + model.intercept;
}

// ════════════════════════════════════════════════════════════
//  Moving Average (Simple & Exponential)
// ════════════════════════════════════════════════════════════

function simpleMovingAverage(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result.push(mean(slice));
  }
  return result;
}

function exponentialMovingAverage(data, period) {
  const multiplier = 2 / (period + 1);
  const result = [data[0]]; // Start with first value
  
  for (let i = 1; i < data.length; i++) {
    const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    result.push(ema);
  }
  
  return result;
}

// ════════════════════════════════════════════════════════════
//  Trend Detection
// ════════════════════════════════════════════════════════════

function detectTrend(data, windowSize = 7) {
  if (data.length < windowSize * 2) {
    return { trend: 'insufficient_data', confidence: 0 };
  }
  
  const recent = data.slice(-windowSize);
  const previous = data.slice(-windowSize * 2, -windowSize);
  
  const recentAvg = mean(recent);
  const previousAvg = mean(previous);
  
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  
  let trend = 'stable';
  let confidence = 0;
  
  if (Math.abs(change) < 1) {
    trend = 'stable';
    confidence = 1 - Math.abs(change);
  } else if (change > 0) {
    trend = 'upward';
    confidence = Math.min(change / 10, 1); // Cap at 100%
  } else {
    trend = 'downward';
    confidence = Math.min(Math.abs(change) / 10, 1);
  }
  
  return { 
    trend, 
    confidence: Math.round(confidence * 100),
    changePercent: change.toFixed(2)
  };
}

// ════════════════════════════════════════════════════════════
//  Volatility Analysis
// ════════════════════════════════════════════════════════════

function calculateVolatility(data) {
  if (data.length < 2) return { volatility: 0, risk: 'unknown' };
  
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i] - data[i - 1]) / data[i - 1]);
  }
  
  const volatility = standardDeviation(returns) * 100;
  
  let risk = 'low';
  if (volatility > 5) risk = 'extreme';
  else if (volatility > 3) risk = 'high';
  else if (volatility > 1.5) risk = 'medium';
  
  return { 
    volatility: volatility.toFixed(2),
    risk,
    annualizedVolatility: (volatility * Math.sqrt(252)).toFixed(2) // 252 trading days
  };
}

// ════════════════════════════════════════════════════════════
//  Time Series Forecasting (Multiple Methods)
// ════════════════════════════════════════════════════════════

function forecastLinear(data, periods = 7) {
  const x = data.map((_, i) => i);
  const model = linearRegression(x, data);
  
  const predictions = [];
  for (let i = 0; i < periods; i++) {
    const futureX = data.length + i;
    predictions.push(predict(futureX, model));
  }
  
  return predictions;
}

function forecastMovingAverage(data, periods = 7, maWindow = 5) {
  const ma = simpleMovingAverage(data, maWindow);
  const lastMA = ma[ma.length - 1];
  
  // Simple extension: assume last MA continues
  return Array(periods).fill(lastMA);
}

function forecastEMA(data, periods = 7, emaWindow = 5) {
  const ema = exponentialMovingAverage(data, emaWindow);
  const lastEMA = ema[ema.length - 1];
  
  // Project EMA trend
  const trend = lastEMA - ema[ema.length - 2];
  const predictions = [];
  
  for (let i = 0; i < periods; i++) {
    predictions.push(lastEMA + trend * (i + 1));
  }
  
  return predictions;
}

// Ensemble: Combine multiple forecasts
function forecastEnsemble(data, periods = 7) {
  const linearPred = forecastLinear(data, periods);
  const maPred = forecastMovingAverage(data, periods, 5);
  const emaPred = forecastEMA(data, periods, 5);
  
  const ensemble = [];
  for (let i = 0; i < periods; i++) {
    const avg = (linearPred[i] + maPred[i] + emaPred[i]) / 3;
    ensemble.push(avg);
  }
  
  return ensemble;
}

// ════════════════════════════════════════════════════════════
//  Extract Numeric Data from Text
// ════════════════════════════════════════════════════════════

export function extractNumericData(text) {
  const data = {
    prices: [],
    dates: [],
    percentages: [],
    volumes: [],
    metadata: {}
  };
  
  console.log('[Analytics] ============ DATA EXTRACTION START ============');
  console.log('[Analytics] Raw text length:', text.length);
  console.log('[Analytics] First 500 chars:', text.substring(0, 500));
  
  // === UNIVERSAL CSV PARSER ===
  // Works with any CSV format: quoted/unquoted, any column order, any date order
  
  // Check if this looks like CSV data
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    console.log('[Analytics] Not enough lines for CSV, trying fallback extraction');
    return fallbackNumericExtraction(text);
  }
  
  // Parse first line as headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  console.log('[Analytics] Detected headers:', headers);
  
  // Find price-related columns (in order of preference)
  const priceColumnNames = ['price', 'close', 'closing', 'last', 'adj close', 'adjusted'];
  let priceIndex = -1;
  
  for (const priceName of priceColumnNames) {
    priceIndex = headers.findIndex(h => 
      h.toLowerCase().trim().includes(priceName)
    );
    if (priceIndex >= 0) {
      console.log(`[Analytics] Found price column "${headers[priceIndex]}" at index ${priceIndex}`);
      break;
    }
  }
  
  // If no price column found, check if this is actually CSV
  if (priceIndex < 0) {
    // Maybe it's a simple CSV without clear headers - check if first row looks like data
    const firstDataLine = parseCSVLine(lines[1]);
    const hasNumericData = firstDataLine.some(val => {
      const num = parseFloat(val.replace(/[",]/g, ''));
      return !isNaN(num) && num > 100 && num < 1000000;
    });
    
    if (!hasNumericData) {
      console.log('[Analytics] No valid CSV format detected, using fallback');
      return fallbackNumericExtraction(text);
    }
    
    // Assume second column might be price (common in simple CSVs)
    priceIndex = 1;
    console.log('[Analytics] No clear price column, assuming index 1');
  }
  
  // Parse data rows
  const extractedPrices = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue; // Skip empty lines
    
    const values = parseCSVLine(line);
    
    if (values.length <= priceIndex) {
      console.log(`[Analytics] Row ${i}: Not enough columns (${values.length}), skipping`);
      continue;
    }
    
    // Extract and parse price
    const rawPrice = values[priceIndex];
    const cleanPrice = cleanNumericString(rawPrice);
    const price = parseFloat(cleanPrice);
    
    if (!isNaN(price) && price > 0 && price < 10000000) {
      extractedPrices.push(price);
      if (i <= 5) { // Log first 5 for debugging
        console.log(`[Analytics] Row ${i}: "${rawPrice}" -> ${price}`);
      }
    } else {
      console.log(`[Analytics] Row ${i}: Invalid price "${rawPrice}" (parsed as ${price}), skipping`);
    }
  }
  
  console.log('[Analytics] ============ EXTRACTION RESULTS ============');
  console.log('[Analytics] Total valid prices extracted:', extractedPrices.length);
  
  if (extractedPrices.length === 0) {
    console.log('[Analytics] No prices extracted from CSV, trying fallback');
    return fallbackNumericExtraction(text);
  }
  
  console.log('[Analytics] First 5 prices:', extractedPrices.slice(0, 5));
  console.log('[Analytics] Last 5 prices:', extractedPrices.slice(-5));
  console.log('[Analytics] Min price:', Math.min(...extractedPrices));
  console.log('[Analytics] Max price:', Math.max(...extractedPrices));
  console.log('[Analytics] Average price:', (extractedPrices.reduce((a, b) => a + b, 0) / extractedPrices.length).toFixed(2));
  
  // Sanity check: prices should be in a reasonable range
  const minPrice = Math.min(...extractedPrices);
  const maxPrice = Math.max(...extractedPrices);
  const priceRange = maxPrice - minPrice;
  const avgPrice = extractedPrices.reduce((a, b) => a + b, 0) / extractedPrices.length;
  
  // If max price is more than 100x the min, or range > 10x average, filter outliers
  const hasExtremeOutliers = (maxPrice > minPrice * 100) || (priceRange > avgPrice * 10);
  
  if (hasExtremeOutliers) {
    console.log('[Analytics] ⚠️  WARNING: Extreme price range detected!');
    console.log('[Analytics] Range:', priceRange, 'Average:', avgPrice, 'Min:', minPrice, 'Max:', maxPrice);
    console.log('[Analytics] Applying outlier filter...');
    
    // Filter outliers using IQR method
    const filtered = filterOutliers(extractedPrices);
    console.log('[Analytics] After outlier removal:', filtered.length, 'prices remaining');
    
    if (filtered.length >= 3) {
      console.log('[Analytics] New range:', Math.min(...filtered), '-', Math.max(...filtered));
      data.prices = filtered;
    } else {
      console.log('[Analytics] Too few prices after filtering, keeping original');
      data.prices = extractedPrices;
    }
  } else {
    data.prices = extractedPrices;
  }
  
  // Extract percentages (for metadata)
  const percentPattern = /(-?\d+(?:\.\d+)?)\s*%/g;
  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    data.percentages.push(parseFloat(match[1]));
  }
  
  // Extract dates
  const datePattern = /\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/g;
  while ((match = datePattern.exec(text)) !== null) {
    data.dates.push(match[1]);
  }
  
  console.log('[Analytics] ============ EXTRACTION COMPLETE ============\n');
  
  return data;
}

// Helper: Parse a CSV line handling quotes and commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  
  return result;
}

// Helper: Clean numeric string (remove quotes, commas, currency symbols)
function cleanNumericString(str) {
  return str
    .replace(/["']/g, '')      // Remove quotes
    .replace(/,/g, '')         // Remove commas
    .replace(/\$/g, '')        // Remove dollar signs
    .replace(/€/g, '')         // Remove euro signs
    .replace(/£/g, '')         // Remove pound signs
    .replace(/₹/g, '')         // Remove rupee signs
    .trim();
}

// Helper: Filter outliers using IQR method
function filterOutliers(data) {
  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - (1.5 * iqr);
  const upperBound = q3 + (1.5 * iqr);
  
  console.log('[Analytics] IQR outlier filter:', { q1, q3, iqr, lowerBound, upperBound });
  
  return data.filter(val => val >= lowerBound && val <= upperBound);
}

// Fallback: Extract numbers from plain text (when CSV parsing fails)
function fallbackNumericExtraction(text) {
  console.log('[Analytics] Using fallback numeric extraction...');
  
  const data = {
    prices: [],
    dates: [],
    percentages: [],
    volumes: [],
    metadata: {}
  };
  
  // Look for numbers with thousand separators (like "25,776.00")
  const pricePattern = /\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/g;
  let match;
  const candidates = [];
  
  while ((match = pricePattern.exec(text)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 10000000) {
      candidates.push(price);
    }
  }
  
  // If we found reasonable numbers, use them
  if (candidates.length >= 3) {
    data.prices = filterOutliers(candidates);
    console.log('[Analytics] Fallback extracted', data.prices.length, 'prices');
  }
  
  return data;
}

// ════════════════════════════════════════════════════════════
//  Main Analysis Function
// ════════════════════════════════════════════════════════════

export function analyzeTimeSeries(data, options = {}) {
  const {
    forecastPeriods = 7,
    trendWindow = 7,
    method = 'ensemble' // 'linear', 'ma', 'ema', 'ensemble'
  } = options;
  
  console.log('[Analytics] analyzeTimeSeries called with:', {
    dataPoints: data?.length,
    forecastPeriods,
    method,
    firstFew: data?.slice(0, 5),
    lastFew: data?.slice(-5)
  });
  
  if (!Array.isArray(data) || data.length < 3) {
    return {
      error: 'Insufficient data for analysis (minimum 3 data points required)',
      dataPoints: data?.length || 0
    };
  }
  
  // Current statistics
  const currentValue = data[data.length - 1];
  const previousValue = data[data.length - 2];
  const changeValue = currentValue - previousValue;
  const changePercent = (changeValue / previousValue) * 100;
  
  console.log('[Analytics] Current stats:', {
    currentValue,
    previousValue,
    changeValue,
    changePercent
  });
  
  // Trend analysis
  const trend = detectTrend(data, trendWindow);
  console.log('[Analytics] Trend:', trend);
  
  // Volatility
  const volatility = calculateVolatility(data);
  console.log('[Analytics] Volatility:', volatility);
  
  // Forecast
  let forecast = [];
  switch (method) {
    case 'linear':
      forecast = forecastLinear(data, forecastPeriods);
      break;
    case 'ma':
      forecast = forecastMovingAverage(data, forecastPeriods);
      break;
    case 'ema':
      forecast = forecastEMA(data, forecastPeriods);
      break;
    case 'ensemble':
    default:
      forecast = forecastEnsemble(data, forecastPeriods);
  }
  
  console.log('[Analytics] Forecast values:', forecast);
  
  // Calculate forecast confidence (based on recent volatility)
  const recentData = data.slice(-14); // Last 2 weeks
  const recentVolatility = parseFloat(calculateVolatility(recentData).volatility);
  const confidence = Math.max(0, Math.min(100, 100 - recentVolatility * 10));
  
  console.log('[Analytics] Confidence calculation:', {
    recentDataLength: recentData.length,
    recentVolatility,
    confidence
  });
  
  // Support and resistance levels (simple)
  const recent30 = data.slice(-30);
  const support = Math.min(...recent30);
  const resistance = Math.max(...recent30);
  
  console.log('[Analytics] Key levels:', {
    support,
    resistance,
    mean: mean(data)
  });
  
  const result = {
    summary: {
      currentValue: currentValue.toFixed(2),
      change: changeValue.toFixed(2),
      changePercent: changePercent.toFixed(2),
      trend: trend.trend,
      trendConfidence: trend.confidence
    },
    volatility: {
      current: volatility.volatility,
      annualized: volatility.annualizedVolatility,
      risk: volatility.risk
    },
    levels: {
      support: support.toFixed(2),
      resistance: resistance.toFixed(2),
      mean: mean(data).toFixed(2)
    },
    forecast: {
      method,
      periods: forecastPeriods,
      values: forecast.map(v => parseFloat(v.toFixed(2))),
      confidence: Math.round(confidence),
      expectedChange: ((forecast[forecast.length - 1] - currentValue) / currentValue * 100).toFixed(2)
    },
    insights: generateInsights(data, forecast, trend, volatility)
  };
  
  console.log('[Analytics] Final result:', result);
  
  return result;
}

// ════════════════════════════════════════════════════════════
//  AI Insights Generation
// ════════════════════════════════════════════════════════════

function generateInsights(historicalData, forecast, trend, volatility) {
  const insights = [];
  
  // Trend insight
  if (trend.trend === 'upward' && trend.confidence > 60) {
    insights.push(`Strong upward momentum detected (${trend.changePercent}% recent growth)`);
  } else if (trend.trend === 'downward' && trend.confidence > 60) {
    insights.push(`Downward pressure observed (${trend.changePercent}% recent decline)`);
  } else {
    insights.push('Price consolidating in a stable range');
  }
  
  // Volatility insight
  if (volatility.risk === 'extreme') {
    insights.push('⚠️ EXTREME volatility - high risk, consider reducing position size');
  } else if (volatility.risk === 'high') {
    insights.push('⚠️ High volatility detected - use tight stop-losses');
  } else if (volatility.risk === 'low') {
    insights.push('✓ Low volatility - stable trading environment');
  }
  
  // Forecast insight
  const forecastChange = ((forecast[forecast.length - 1] - historicalData[historicalData.length - 1]) / historicalData[historicalData.length - 1]) * 100;
  if (forecastChange > 5) {
    insights.push(`📈 Model predicts ${forecastChange.toFixed(1)}% potential upside`);
  } else if (forecastChange < -5) {
    insights.push(`📉 Model suggests ${Math.abs(forecastChange).toFixed(1)}% potential downside risk`);
  }
  
  return insights;
}

// Export additional functions for external use
export { detectTrend, calculateVolatility };