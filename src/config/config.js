const path = require('path');

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL,
  
  // API Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1/models',
  
  // File Upload Configuration
  UPLOAD_DIR: 'uploads',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  
  // Rate Limiting (if needed in future)
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // Validation Rules
  PASSWORD_MIN_LENGTH: 6,
  PROFILE_NAME_MAX_LENGTH: 100,
  TEMPLATE_NAME_MAX_LENGTH: 100,
  RESUME_TITLE_MAX_LENGTH: 200,
  
  // AI Prompt Configuration
  AI_RESPONSE_TIMEOUT: 30000, // 30 seconds
  AI_MAX_RETRIES: 3,
  
  // Development Settings
  ENABLE_REQUEST_LOGGING: process.env.NODE_ENV === 'development',
  ENABLE_DETAILED_ERRORS: process.env.NODE_ENV === 'development',
};

// Validation
if (config.NODE_ENV === 'production') {
  if (!config.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY is not set in production environment');
  }
  
  if (config.JWT_SECRET === 'your-secret-key-change-in-production') {
    console.error('🚨 JWT_SECRET must be changed in production!');
    process.exit(1);
  }
}

module.exports = config;