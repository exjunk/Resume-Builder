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
    healthCheck.database = { status: 'Connected', type: 'PostgreSQL (Neon)' };
  } catch (error) {
    healthCheck.database = { status: 'Error', error: error.message };
    healthCheck.status = 'ERROR';
  }

  // Check AI service
  try {
    const aiStatus = await aiService.testConnection();
    healthCheck.aiService = {
      configured: !!config.GEMINI_API_KEY,
      status: aiStatus.connected ? 'Connected' : 'Error',
      model: aiStatus.model,
      ...(aiStatus.error && { error: aiStatus.error }),
      ...(aiStatus.testResponse && { testResponse: aiStatus.testResponse })
    };
    
    if (!aiStatus.connected) {
      healthCheck.status = 'DEGRADED';
    }
  } catch (error) {
    healthCheck.aiService = {
      configured: !!config.GEMINI_API_KEY,
      status: 'Error',
      error: error.message
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
      geminiModel: config.GEMINI_MODEL
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
    type: 'PostgreSQL (Neon)',
    configured: !!config.DATABASE_URL,
    tables: [],
    stats: {}
  };

  try {
    // Test basic connection
    const testResult = await db.query('SELECT NOW() as test');
    dbHealth.serverTime = testResult.rows[0].test;

    // Get table information
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tablesResult.rows.map(row => row.table_name);
    dbHealth.tables = tables;

    // Get basic statistics for main tables
    const mainTables = ['users', 'user_profiles', 'resume_templates', 'resumes'];
    
    for (const table of mainTables) {
      if (tables.includes(table)) {
        try {
          const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
          dbHealth.stats[table] = { count: parseInt(countResult.rows[0].count) };
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
    const connectionTest = await aiService.testConnection();
    
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

  // AI service check (optional for readiness)
  if (config.GEMINI_API_KEY) {
    try {
      const aiStatus = await aiService.testConnection();
      checks.push({ 
        service: 'ai', 
        status: aiStatus.connected ? 'ready' : 'not_ready',
        ...(aiStatus.error && { error: aiStatus.error })
      });
      
      // AI service failure doesn't make the app not ready, but we note it
      if (!aiStatus.connected) {
        checks[checks.length - 1].note = 'AI service unavailable but app can still function';
      }
    } catch (error) {
      checks.push({ 
        service: 'ai', 
        status: 'not_ready', 
        error: error.message,
        note: 'AI service unavailable but app can still function'
      });
    }
  } else {
    checks.push({ 
      service: 'ai', 
      status: 'not_configured',
      note: 'AI service not configured'
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