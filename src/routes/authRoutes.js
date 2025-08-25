const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Simple database connection (for testing)
const { dbUtils } = require('../database/database');

// Simple config
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Test route to verify routes are working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    const { fullName, email, phone, location, password } = req.body;

    // Basic validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ 
        error: 'Full name, email, and password are required',
        received: { fullName: !!fullName, email: !!email, password: !!password }
      });
    }

    // Check if user already exists
    const existingUser = await dbUtils.get(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userUuid = uuidv4();

    // Create user
    const result = await dbUtils.get(
      `INSERT INTO users (user_uuid, full_name, email, phone, location, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userUuid, fullName, email, phone || null, location || null, passwordHash]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: result.id, 
        userUuid, 
        email, 
        fullName 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: result.id,
        userUuid,
        fullName,
        email,
        phone,
        location
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed',
      details: error.message 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', { email: req.body.email });
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await dbUtils.get(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user.id, 
        userUuid: user.user_uuid, 
        email: user.email, 
        fullName: user.full_name 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        userUuid: user.user_uuid,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        location: user.location
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      details: error.message 
    });
  }
});

module.exports = router;