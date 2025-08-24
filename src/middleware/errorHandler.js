const config = require('../config/config');
const multer = require('multer');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log error for development
  if (config.ENABLE_DETAILED_ERRORS) {
    console.error('Error Details:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    });
  } else {
    console.error('Error:', error.message);
  }

  // Handle specific error types
  if (error instanceof multer.MulterError) {
    err = handleMulterError(error);
  } else if (error.code === '23505' || error.code === '23503') {
    err = handlePostgreSQLError(error);
  } else if (error.name === 'ValidationError') {
    err = handleValidationError(error);
  } else if (error.name === 'CastError') {
    err = handleCastError(error);
  } else if (error.code === 'ENOENT') {
    err = handleFileNotFoundError(error);
  } else if (!error.isOperational) {
    // Programming or unknown error
    err = new AppError('Something went wrong', 500, 'INTERNAL_ERROR');
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'UNKNOWN_ERROR',
    ...(config.ENABLE_DETAILED_ERRORS && { stack: err.stack })
  });
};

// Handle Multer file upload errors
const handleMulterError = (error) => {
  let message = 'File upload error';
  let code = 'FILE_UPLOAD_ERROR';
  
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      message = `File too large. Maximum size is ${config.MAX_FILE_SIZE / (1024 * 1024)}MB`;
      code = 'FILE_TOO_LARGE';
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files uploaded';
      code = 'TOO_MANY_FILES';
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected file field';
      code = 'UNEXPECTED_FILE_FIELD';
      break;
    default:
      message = error.message;
  }
  
  return new AppError(message, 400, code);
};

// Handle PostgreSQL database errors
const handlePostgreSQLError = (error) => {
  let message = 'Database error';
  let code = 'DATABASE_ERROR';
  
  if (error.code === '23505') { // Unique violation
    if (error.detail && error.detail.includes('email')) {
      message = 'Email address is already registered';
      code = 'EMAIL_ALREADY_EXISTS';
    } else {
      message = 'Duplicate entry detected';
      code = 'DUPLICATE_ENTRY';
    }
    return new AppError(message, 409, code);
  }
  
  if (error.code === '23503') { // Foreign key violation
    message = 'Referenced record not found';
    code = 'FOREIGN_KEY_ERROR';
    return new AppError(message, 400, code);
  }
  
  return new AppError(message, 500, code);
};

// Handle validation errors
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(val => val.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

// Handle cast errors (invalid IDs, etc.)
const handleCastError = (error) => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

// Handle file not found errors
const handleFileNotFoundError = (error) => {
  const message = 'File not found';
  return new AppError(message, 404, 'FILE_NOT_FOUND');
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

// Request logging middleware (for development)
const requestLogger = (req, res, next) => {
  if (config.ENABLE_REQUEST_LOGGING) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
  }
  next();
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  requestLogger
};