const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { dbUtils } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const ValidationService = require('../utils/validation');

// Get all user profiles
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const profiles = await dbUtils.all(
    `SELECT id, profile_uuid, profile_name, full_name, email, mobile_numbers, 
     linkedin_url, location, is_default, created_at, updated_at 
     FROM user_profiles WHERE user_id = ? ORDER BY is_default DESC, profile_name ASC`,
    [req.user.userId]
  );

  // Parse mobile_numbers JSON for each profile
  const parsedProfiles = profiles.map(profile => ({
    ...profile,
    mobile_numbers: profile.mobile_numbers ? JSON.parse(profile.mobile_numbers) : []
  }));

  res.json({
    success: true,
    profiles: parsedProfiles
  });
}));

// Get specific user profile
router.get('/:profileUuid', authenticateToken, asyncHandler(async (req, res) => {
  const profileUuid = ValidationService.validateUuid(req.params.profileUuid, 'Profile UUID');

  const profile = await dbUtils.get(
    'SELECT * FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
    [profileUuid, req.user.userId]
  );

  if (!profile) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  // Parse JSON fields
  profile.mobile_numbers = profile.mobile_numbers ? JSON.parse(profile.mobile_numbers) : [];

  res.json({
    success: true,
    profile
  });
}));

// Create user profile
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input data
  const validatedData = ValidationService.validateProfileData(req.body);

  const profileUuid = uuidv4();
  const mobileNumbersJson = JSON.stringify(validatedData.mobileNumbers);

  // Helper function to insert profile
  const insertProfile = async () => {
    const result = await dbUtils.run(
      `INSERT INTO user_profiles 
       (profile_uuid, user_id, profile_name, full_name, email, mobile_numbers, 
        linkedin_url, location, is_default) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profileUuid,
        req.user.userId,
        validatedData.profileName,
        validatedData.fullName,
        validatedData.email,
        mobileNumbersJson,
        validatedData.linkedinUrl,
        validatedData.location,
        validatedData.isDefault ? 1 : 0
      ]
    );

    return result;
  };

  // If this is set as default, unset other defaults first
  if (validatedData.isDefault) {
    await dbUtils.run(
      'UPDATE user_profiles SET is_default = 0 WHERE user_id = ?',
      [req.user.userId]
    );
  }

  const result = await insertProfile();

  res.status(201).json({
    success: true,
    message: 'Profile created successfully',
    profileUuid,
    profileId: result.lastID
  });
}));

// Update user profile
router.put('/:profileUuid', authenticateToken, asyncHandler(async (req, res) => {
  const profileUuid = ValidationService.validateUuid(req.params.profileUuid, 'Profile UUID');
  
  // Validate input data
  const validatedData = ValidationService.validateProfileData(req.body);

  const mobileNumbersJson = JSON.stringify(validatedData.mobileNumbers);

  // Helper function to update profile
  const updateProfile = async () => {
    const result = await dbUtils.run(
      `UPDATE user_profiles SET 
       profile_name = ?, full_name = ?, email = ?, mobile_numbers = ?, 
       linkedin_url = ?, location = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE profile_uuid = ? AND user_id = ?`,
      [
        validatedData.profileName,
        validatedData.fullName,
        validatedData.email,
        mobileNumbersJson,
        validatedData.linkedinUrl,
        validatedData.location,
        validatedData.isDefault ? 1 : 0,
        profileUuid,
        req.user.userId
      ]
    );

    return result;
  };

  // If this is set as default, unset other defaults first
  if (validatedData.isDefault) {
    await dbUtils.run(
      'UPDATE user_profiles SET is_default = 0 WHERE user_id = ? AND profile_uuid != ?',
      [req.user.userId, profileUuid]
    );
  }

  const result = await updateProfile();

  if (result.changes === 0) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
}));

// Delete user profile
router.delete('/:profileUuid', authenticateToken, asyncHandler(async (req, res) => {
  const profileUuid = ValidationService.validateUuid(req.params.profileUuid, 'Profile UUID');

  // Check if profile exists and get its default status
  const profile = await dbUtils.get(
    'SELECT is_default FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
    [profileUuid, req.user.userId]
  );

  if (!profile) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  // Check if there are other profiles before deleting the default
  if (profile.is_default) {
    const profileCount = await dbUtils.get(
      'SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ?',
      [req.user.userId]
    );

    if (profileCount.count > 1) {
      // Set another profile as default before deleting
      await dbUtils.run(
        `UPDATE user_profiles SET is_default = 1 
         WHERE user_id = ? AND profile_uuid != ? 
         ORDER BY created_at ASC LIMIT 1`,
        [req.user.userId, profileUuid]
      );
    }
  }

  // Delete the profile
  const result = await dbUtils.run(
    'DELETE FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
    [profileUuid, req.user.userId]
  );

  if (result.changes === 0) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Profile deleted successfully'
  });
}));

// Set profile as default
router.patch('/:profileUuid/set-default', authenticateToken, asyncHandler(async (req, res) => {
  const profileUuid = ValidationService.validateUuid(req.params.profileUuid, 'Profile UUID');

  // Check if profile exists
  const profile = await dbUtils.get(
    'SELECT id FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
    [profileUuid, req.user.userId]
  );

  if (!profile) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  // Start transaction
  await dbUtils.beginTransaction();

  try {
    // Unset all defaults for this user
    await dbUtils.run(
      'UPDATE user_profiles SET is_default = 0 WHERE user_id = ?',
      [req.user.userId]
    );

    // Set the selected profile as default
    await dbUtils.run(
      'UPDATE user_profiles SET is_default = 1 WHERE profile_uuid = ? AND user_id = ?',
      [profileUuid, req.user.userId]
    );

    // Commit transaction
    await dbUtils.commit();

    res.json({
      success: true,
      message: 'Profile set as default successfully'
    });

  } catch (error) {
    // Rollback transaction
    await dbUtils.rollback();
    throw error;
  }
}));

// Duplicate profile
router.post('/:profileUuid/duplicate', authenticateToken, asyncHandler(async (req, res) => {
  const profileUuid = ValidationService.validateUuid(req.params.profileUuid, 'Profile UUID');
  
  // Get the original profile
  const originalProfile = await dbUtils.get(
    'SELECT * FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
    [profileUuid, req.user.userId]
  );

  if (!originalProfile) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  const newProfileUuid = uuidv4();
  const newProfileName = `${originalProfile.profile_name} (Copy)`;

  // Create duplicate profile
  const result = await dbUtils.run(
    `INSERT INTO user_profiles 
     (profile_uuid, user_id, profile_name, full_name, email, mobile_numbers, 
      linkedin_url, location, is_default) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newProfileUuid,
      req.user.userId,
      newProfileName,
      originalProfile.full_name,
      originalProfile.email,
      originalProfile.mobile_numbers,
      originalProfile.linkedin_url,
      originalProfile.location,
      0 // New profile is not default
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Profile duplicated successfully',
    profileUuid: newProfileUuid,
    profileId: result.lastID
  });
}));

module.exports = router;