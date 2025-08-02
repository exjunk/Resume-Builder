const express = require('express');
const router = express.Router();

const { asyncHandler } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');
const { getDatabase } = require('../database/database');
const config = require('../config/config');

// Basic health check
router.get('/', asyncHandler(async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    }
  };

  // Check database connection
  try {
    const db = getDatabase();
    await new Promise((resolve, reject) => {
      db.get('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    healthCheck.database = { status: 'Connected', type: 'SQLite' };
  } catch (error) {
    healthCheck.database = { status: 'Error', error: error.message };
    healthCheck.status = 'ERROR';
  }

  // Check AI services
  try {
    const aiStatus = await aiService.testConnections();
    healthCheck.aiServices = {
      gemini: {
        configured: !!config.GEMINI_API_KEY,
        status: aiStatus.gemini.connected ? 'Connected' : 'Error',
        model: aiStatus.gemini.model,
        ...(aiStatus.gemini.error && { error: aiStatus.gemini.error }),
        ...(aiStatus.gemini.testResponse && { testResponse: aiStatus.gemini.testResponse })
      },
      openai: {
        configured: !!config.OPENAI_API_KEY,
        status: aiStatus.openai.connected ? 'Connected' : 'Error',
        model: aiStatus.openai.model,
        ...(aiStatus.openai.error && { error: aiStatus.openai.error }),
        ...(aiStatus.openai.testResponse && { testResponse: aiStatus.openai.testResponse })
      }
    };
    
    // Determine overall AI status
    const geminiConnected = aiStatus.gemini.connected;
    const openaiConnected = aiStatus.openai.connected;
    
    if (!geminiConnected && !openaiConnected) {
      healthCheck.status = 'DEGRADED';
      healthCheck.aiServices.overall = 'No AI services available';
    } else if (!geminiConnected || !openaiConnected) {
      healthCheck.status = 'DEGRADED';
      healthCheck.aiServices.overall = 'Partial AI services available';
    } else {
      healthCheck.aiServices.overall = 'All AI services available';
    }
  } catch (error) {
    healthCheck.aiServices = {
      error: error.message,
      overall: 'Error testing AI services'
    };
    healthCheck.status = 'DEGRADED';
  }

  const statusCode = healthCheck.status === 'OK' ? 200 : 
                    healthCheck.status === 'DEGRADED' ? 200 : 503;

  res.status(statusCode).json(healthCheck);
}));

// Detailed system information
router.get('/system', asyncHandler(async (req, res) => {
  const systemInfo = {
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    uptime: process.uptime(),
    loadAverage: process.loadavg ? process.loadavg() : null,
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
      external: process.memoryUsage().external,
      arrayBuffers: process.memoryUsage().arrayBuffers
    },
    cpuUsage: process.cpuUsage(),
    environment: {
      nodeEnv: config.NODE_ENV,
      port: config.PORT,
      hasGeminiKey: !!config.GEMINI_API_KEY,
      geminiModel: config.GEMINI_MODEL,
      hasOpenAIKey: !!config.OPENAI_API_KEY,
      openaiModel: config.OPENAI_MODEL
    }
  };

  res.json({
    success: true,
    system: systemInfo
  });
}));

// Database health check
router.get('/database', asyncHandler(async (req, res) => {
  const db = getDatabase();
  
  const dbHealth = {
    status: 'Unknown',
    path: config.DB_PATH,
    tables: [],
    stats: {}
  };

  try {
    // Test basic connection
    await new Promise((resolve, reject) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get table information
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });

    dbHealth.tables = tables;

    // Get basic statistics for main tables
    const mainTables = ['users', 'user_profiles', 'resume_templates', 'resumes'];
    
    for (const table of mainTables) {
      if (tables.includes(table)) {
        try {
          const count = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });
          dbHealth.stats[table] = { count };
        } catch (error) {
          dbHealth.stats[table] = { error: error.message };
        }
      }
    }

    dbHealth.status = 'Connected';
    
  } catch (error) {
    dbHealth.status = 'Error';
    dbHealth.error = error.message;
  }

  const statusCode = dbHealth.status === 'Connected' ? 200 : 503;
  
  res.status(statusCode).json({
    success: dbHealth.status === 'Connected',
    database: dbHealth
  });
}));

// AI service health check
router.get('/ai', asyncHandler(async (req, res) => {
  const aiHealth = {
    gemini: {
      configured: !!config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
      timeout: config.AI_RESPONSE_TIMEOUT,
      maxRetries: config.AI_MAX_RETRIES
    },
    openai: {
      configured: !!config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
      timeout: config.AI_RESPONSE_TIMEOUT,
      maxRetries: config.AI_MAX_RETRIES
    }
  };

  // Check if any AI service is configured
  const hasAnyAI = aiHealth.gemini.configured || aiHealth.openai.configured;

  if (!hasAnyAI) {
    return res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Not Configured',
        error: 'No AI API keys found in environment variables'
      }
    });
  }

  try {
    const connectionTest = await aiService.testConnections();
    
    // Update Gemini status
    aiHealth.gemini.status = connectionTest.gemini.connected ? 'Connected' : 'Error';
    aiHealth.gemini.testResponse = connectionTest.gemini.testResponse;
    if (connectionTest.gemini.error) {
      aiHealth.gemini.error = connectionTest.gemini.error;
    }

    // Update OpenAI status
    aiHealth.openai.status = connectionTest.openai.connected ? 'Connected' : 'Error';
    aiHealth.openai.testResponse = connectionTest.openai.testResponse;
    if (connectionTest.openai.error) {
      aiHealth.openai.error = connectionTest.openai.error;
    }

    // Determine overall status
    const geminiConnected = connectionTest.gemini.connected;
    const openaiConnected = connectionTest.openai.connected;
    
    if (!geminiConnected && !openaiConnected) {
      aiHealth.overall = 'No AI services available';
      aiHealth.status = 'Error';
    } else if (!geminiConnected || !openaiConnected) {
      aiHealth.overall = 'Partial AI services available';
      aiHealth.status = 'Degraded';
    } else {
      aiHealth.overall = 'All AI services available';
      aiHealth.status = 'Connected';
    }

    const statusCode = (geminiConnected || openaiConnected) ? 200 : 503;
    
    res.status(statusCode).json({
      success: geminiConnected || openaiConnected,
      ai: aiHealth
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Error',
        error: error.message
      }
    });
  }
}));

// Individual AI service health checks
router.get('/ai/gemini', asyncHandler(async (req, res) => {
  const aiHealth = {
    configured: !!config.GEMINI_API_KEY,
    model: config.GEMINI_MODEL,
    timeout: config.AI_RESPONSE_TIMEOUT,
    maxRetries: config.AI_MAX_RETRIES
  };

  if (!aiHealth.configured) {
    return res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Not Configured',
        error: 'GEMINI_API_KEY not found in environment variables'
      }
    });
  }

  try {
    const connectionTest = await aiService.testGeminiConnection();
    
    aiHealth.status = connectionTest.connected ? 'Connected' : 'Error';
    aiHealth.testResponse = connectionTest.testResponse;
    
    if (connectionTest.error) {
      aiHealth.error = connectionTest.error;
    }

    const statusCode = connectionTest.connected ? 200 : 503;
    
    res.status(statusCode).json({
      success: connectionTest.connected,
      ai: aiHealth
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Error',
        error: error.message
      }
    });
  }
}));

router.get('/ai/openai', asyncHandler(async (req, res) => {
  const aiHealth = {
    configured: !!config.OPENAI_API_KEY,
    model: config.OPENAI_MODEL,
    timeout: config.AI_RESPONSE_TIMEOUT,
    maxRetries: config.AI_MAX_RETRIES
  };

  if (!aiHealth.configured) {
    return res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Not Configured',
        error: 'OPENAI_API_KEY not found in environment variables'
      }
    });
  }

  try {
    const connectionTest = await aiService.testOpenAIConnection();
    
    aiHealth.status = connectionTest.connected ? 'Connected' : 'Error';
    aiHealth.testResponse = connectionTest.testResponse;
    
    if (connectionTest.error) {
      aiHealth.error = connectionTest.error;
    }

    const statusCode = connectionTest.connected ? 200 : 503;
    
    res.status(statusCode).json({
      success: connectionTest.connected,
      ai: aiHealth
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      ai: {
        ...aiHealth,
        status: 'Error',
        error: error.message
      }
    });
  }
}));

// Readiness probe (for orchestration systems like Kubernetes)
router.get('/ready', asyncHandler(async (req, res) => {
  const checks = [];
  let allReady = true;

  // Database check
  try {
    const db = getDatabase();
    await new Promise((resolve, reject) => {
      db.get('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    checks.push({ service: 'database', status: 'ready' });
  } catch (error) {
    checks.push({ service: 'database', status: 'not_ready', error: error.message });
    allReady = false;
  }

  // AI services check (optional for readiness)
  const hasAnyAI = config.GEMINI_API_KEY || config.OPENAI_API_KEY;
  
  if (hasAnyAI) {
    try {
      const aiStatus = await aiService.testConnections();
      const geminiConnected = aiStatus.gemini.connected;
      const openaiConnected = aiStatus.openai.connected;
      
      checks.push({ 
        service: 'ai_gemini', 
        status: geminiConnected ? 'ready' : 'not_ready',
        configured: !!config.GEMINI_API_KEY,
        ...(aiStatus.gemini.error && { error: aiStatus.gemini.error })
      });
      
      checks.push({ 
        service: 'ai_openai', 
        status: openaiConnected ? 'ready' : 'not_ready',
        configured: !!config.OPENAI_API_KEY,
        ...(aiStatus.openai.error && { error: aiStatus.openai.error })
      });
      
      // AI service failure doesn't make the app not ready, but we note it
      if (!geminiConnected && !openaiConnected) {
        checks.push({ 
          service: 'ai_overall', 
          status: 'not_ready', 
          note: 'No AI services available but app can still function'
        });
      } else if (!geminiConnected || !openaiConnected) {
        checks.push({ 
          service: 'ai_overall', 
          status: 'degraded', 
          note: 'Partial AI services available'
        });
      } else {
        checks.push({ 
          service: 'ai_overall', 
          status: 'ready', 
          note: 'All AI services available'
        });
      }
    } catch (error) {
      checks.push({ 
        service: 'ai_overall', 
        status: 'not_ready', 
        error: error.message,
        note: 'AI services unavailable but app can still function'
      });
    }
  } else {
    checks.push({ 
      service: 'ai_overall', 
      status: 'not_configured',
      note: 'No AI services configured'
    });
  }

  const statusCode = allReady ? 200 : 503;
  
  res.status(statusCode).json({
    ready: allReady,
    timestamp: new Date().toISOString(),
    checks
  });
}));

// Liveness probe (for orchestration systems like Kubernetes)
router.get('/live', (req, res) => {
  // Simple liveness check - if the server can respond, it's alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;