/**
 * HTTP Client Wrapper
 * Handles HTTP requests with fallback options
 */

let httpClient = null;

// Initialize HTTP client with proper fallback chain
function initializeHttpClient() {
  // Option 1: Try node-fetch
  try {
    const fetch = require('node-fetch');
    httpClient = fetch;
    console.log('✅ Using node-fetch for HTTP requests');
    return;
  } catch (error) {
    console.warn('⚠️ node-fetch not available:', error.message);
  }

  // Option 2: Try built-in fetch (Node 18+)
  try {
    if (typeof fetch !== 'undefined' && fetch) {
      httpClient = fetch;
      console.log('✅ Using built-in fetch for HTTP requests');
      return;
    }
  } catch (error) {
    console.warn('⚠️ Built-in fetch not available:', error.message);
  }

  // Option 3: Use https module fallback
  try {
    console.warn('⚠️ No fetch available, using https module fallback');
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    httpClient = async (url, options = {}) => {
      return new Promise((resolve, reject) => {
        try {
          const parsedUrl = new URL(url);
          const protocol = parsedUrl.protocol === 'https:' ? https : http;
          
          const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || 30000
          };

          const req = protocol.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              const response = {
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                statusText: res.statusMessage || '',
                headers: new Map(Object.entries(res.headers || {})),
                url: url,
                async text() { 
                  return data; 
                },
                async json() { 
                  try {
                    return JSON.parse(data);
                  } catch (parseError) {
                    throw new Error(`Invalid JSON response: ${parseError.message}`);
                  }
                }
              };
              
              resolve(response);
            });
          });

          req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${options.timeout || 30000}ms`));
          });

          // Set timeout
          if (options.timeout) {
            req.setTimeout(options.timeout);
          }

          // Write body if provided
          if (options.body) {
            if (typeof options.body === 'string') {
              req.write(options.body);
            } else {
              req.write(JSON.stringify(options.body));
            }
          }

          req.end();
        } catch (error) {
          reject(new Error(`Request setup failed: ${error.message}`));
        }
      });
    };
    
    console.log('✅ Using https module fallback for HTTP requests');
    return;
  } catch (error) {
    console.error('❌ Failed to initialize https fallback:', error.message);
  }

  // If all else fails, throw an error
  throw new Error('No HTTP client could be initialized');
}

// Initialize the client
try {
  initializeHttpClient();
} catch (error) {
  console.error('❌ Failed to initialize any HTTP client:', error.message);
  httpClient = null;
}

// Wrapper function with error handling and retries
async function makeRequest(url, options = {}) {
  if (!httpClient) {
    throw new Error('HTTP client not initialized. Please check your Node.js environment.');
  }

  try {
    // Add default timeout if not specified
    const requestOptions = {
      timeout: 30000,
      ...options,
      headers: {
        'User-Agent': 'ATS-Resume-Optimizer/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    console.log(`🌐 Making ${requestOptions.method || 'GET'} request to: ${url}`);
    
    const response = await httpClient(url, requestOptions);
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    // Check if response is ok
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `HTTP ${response.status}`;
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ HTTP request failed:', error.message);
    
    // Add more context to the error
    const enhancedError = new Error(`HTTP request to ${url} failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.url = url;
    enhancedError.options = options;
    
    throw enhancedError;
  }
}

// Test function to verify HTTP client works
async function testHttpClient() {
  try {
    console.log('🔍 Testing HTTP client...');
    
    if (!httpClient) {
      console.error('❌ HTTP client is not initialized');
      return false;
    }
    
    // Test with a simple request to a reliable endpoint
    const testUrl = 'https://httpbin.org/get';
    const response = await makeRequest(testUrl, {
      method: 'GET',
      timeout: 10000
    });
    
    const data = await response.json();
    console.log('✅ HTTP client test successful:', {
      url: data.url,
      userAgent: data.headers['User-Agent']
    });
    return true;
    
  } catch (error) {
    console.error('❌ HTTP client test failed:', error.message);
    return false;
  }
}

// Get information about which client is being used
function getClientInfo() {
  if (!httpClient) {
    return { type: 'none', available: false, error: 'No HTTP client initialized' };
  }

  // Try to determine which client we're using
  let clientType = 'unknown';
  
  try {
    // Check if it's node-fetch
    const nodeFetch = require('node-fetch');
    if (httpClient === nodeFetch) {
      clientType = 'node-fetch';
    }
  } catch (e) {
    // node-fetch not available
  }
  
  if (typeof fetch !== 'undefined' && httpClient === fetch) {
    clientType = 'built-in-fetch';
  } else if (httpClient.toString().includes('https.request')) {
    clientType = 'https-fallback';
  }
  
  return {
    type: clientType,
    available: true,
    isFunction: typeof httpClient === 'function'
  };
}

// Export both CommonJS and ES modules style
module.exports = {
  makeRequest,
  testHttpClient,
  getClientInfo,
  isReady: () => httpClient !== null
};

// Also export as default for ES modules compatibility
module.exports.default = module.exports;