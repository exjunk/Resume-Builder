const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      let errorMessage = 'Invalid or expired token';
      let errorCode = 'AUTH_TOKEN_INVALID';
      
      if (err.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired';
        errorCode = 'AUTH_TOKEN_EXPIRED';
      } else if (err.name === 'JsonWebTokenError') {
        errorMessage = 'Malformed token';
        errorCode = 'AUTH_TOKEN_MALFORMED';
      }
      
      return res.status(403).json({ 
        error: errorMessage,
        code: errorCode
      });
    }
    
    req.user = user;
    next();
  });
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, { 
    expiresIn: config.JWT_EXPIRES_IN 
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken
};