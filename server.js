const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');
require('dotenv').config();

// Import modules
const { initDatabase } = require('./src/database/database');
const config = require('./src/config/config');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const templateRoutes = require('./src/routes/templateRoutes');
const resumeRoutes = require('./src/routes/resumeRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const legacyRoutes = require('./src/routes/legacyRoutes');

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Ensure uploads directory exists
fs.ensureDirSync('uploads');

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/resumes', resumeRoutes);

// Legacy/compatibility routes (for frontend compatibility)
app.use('/api', legacyRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    
    if (config.NODE_ENV === 'production') {
      // Production: HTTPS configuration
      try {
        // Try multiple certificate paths for different setups
        let certPath, keyPath;
        
        // Option 1: Subdomain-specific certificates
        try {
          certPath = '/etc/letsencrypt/live/resume.androiddevapps.com/fullchain.pem';
          keyPath = '/etc/letsencrypt/live/resume.androiddevapps.com/privkey.pem';
          fs.accessSync(certPath);
          console.log('✅ Using subdomain-specific SSL certificates');
        } catch (e) {
          // Option 2: Main domain certificates (if wildcard or main domain cert)
          try {
            certPath = '/etc/letsencrypt/live/androiddevapps.com/fullchain.pem';
            keyPath = '/etc/letsencrypt/live/androiddevapps.com/privkey.pem';
            fs.accessSync(certPath);
            console.log('✅ Using main domain SSL certificates');
          } catch (e2) {
            // Option 3: Fallback to HTTP
            console.warn('⚠️  SSL certificates not found, falling back to HTTP');
            http.createServer(app).listen(PORT, '0.0.0.0', () => {
              console.log(`🚀 HTTP Server running on 0.0.0.0:${PORT}`);
            });
            return;
          }
        }
        
        const httpsOptions = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
        
        // Start HTTPS server - EXPLICITLY bind to 0.0.0.0
        https.createServer(httpsOptions, app).listen(443, '0.0.0.0', () => {
          console.log(`🚀 HTTPS Server running on 0.0.0.0:443`);
          console.log(`🌐 Domain: https://resume.androiddevapps.com`);
        });
        
        // Start HTTP server - EXPLICITLY bind to 0.0.0.0
        http.createServer((req, res) => {
          res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
          res.end();
        }).listen(80, '0.0.0.0', () => {
          console.log(`🔀 HTTP Redirect server running on 0.0.0.0:80`);
        });
        
      } catch (sslError) {
        console.warn('⚠️  SSL certificates not found, falling back to HTTP');
        http.createServer(app).listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 HTTP Server running on 0.0.0.0:${PORT}`);
        });
      }
    } else {
      // Development: HTTP server
      http.createServer(app).listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Development server running on http://localhost:${PORT}`);
      });
    }
    
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
    console.log(`🔑 Gemini API configured: ${!!config.GEMINI_API_KEY}`);
    console.log(`💾 Database: ${config.DATABASE_URL ? 'Neon PostgreSQL' : 'Not configured'}`);
    
    if (!config.GEMINI_API_KEY) {
      console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables');
      console.log('   Please add your API key to the .env file');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Export for potential testing
module.exports = { app };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}