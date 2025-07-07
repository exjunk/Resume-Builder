const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { dbUtils } = require('../database/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const ValidationService = require('../utils/validation');

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input data
  const validatedData = ValidationService.validateUserRegistration(req.body);
  
  // Check if user already exists
  const existingUser = await dbUtils.get(
    'SELECT id FROM users WHERE email = ?',
    [validatedData.email]
  );

  if (existingUser) {
    throw new AppError('User with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(validatedData.password, 12);
  const userUuid = uuidv4();

  // Create user
  const result = await dbUtils.run(
    `INSERT INTO users (user_uuid, full_name, email, phone, location, password_hash) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userUuid,
      validatedData.fullName,
      validatedData.email,
      validatedData.phone,
      validatedData.location,
      passwordHash
    ]
  );

  // Generate JWT token
  const token = generateToken({
    userId: result.lastID,
    userUuid,
    email: validatedData.email,
    fullName: validatedData.fullName
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    token,
    user: {
      id: result.lastID,
      userUuid,
      fullName: validatedData.fullName,
      email: validatedData.email,
      phone: validatedData.phone,
      location: validatedData.location
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input data
  const validatedData = ValidationService.validateUserLogin(req.body);

  // Find user by email
  const user = await dbUtils.get(
    'SELECT * FROM users WHERE email = ?',
    [validatedData.email]
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(validatedData.password, user.password_hash);
  
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    userUuid: user.user_uuid,
    email: user.email,
    fullName: user.full_name
  });

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
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await dbUtils.get(
    'SELECT id, user_uuid, full_name, email, phone, location, created_at FROM users WHERE id = ?',
    [req.user.userId]
  );

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    user
  });
}));

// Update current user profile
router.put('/me', authenticateToken, asyncHandler(async (req, res) => {
  const { fullName, phone, location } = req.body;
  
  // Validate input data
  const validatedData = {
    fullName: ValidationService.validateRequiredString(fullName, 'Full name', 100),
    phone: ValidationService.validatePhone(phone),
    location: ValidationService.validateOptionalString(location, 'Location', 200)
  };

  const result = await dbUtils.run(
    'UPDATE users SET full_name = ?, phone = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [validatedData.fullName, validatedData.phone, validatedData.location, req.user.userId]
  );

  if (result.changes === 0) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'User profile updated successfully'
  });
}));

// Change password
router.put('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400, 'PASSWORDS_REQUIRED');
  }

  // Validate new password
  ValidationService.validatePassword(newPassword);

  // Get current user with password
  const user = await dbUtils.get(
    'SELECT password_hash FROM users WHERE id = ?',
    [req.user.userId]
  );

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 401, 'CURRENT_PASSWORD_INVALID');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await dbUtils.run(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, req.user.userId]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Logout (client-side token invalidation)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Refresh token
router.post('/refresh', authenticateToken, asyncHandler(async (req, res) => {
  // Verify user still exists
  const user = await dbUtils.get(
    'SELECT id, user_uuid, full_name, email FROM users WHERE id = ?',
    [req.user.userId]
  );

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Generate new token
  const token = generateToken({
    userId: user.id,
    userUuid: user.user_uuid,
    email: user.email,
    fullName: user.full_name
  });

  res.json({
    success: true,
    token,
    message: 'Token refreshed successfully'
  });
}));

module.exports = router;