const express = require('express');
const router = express.Router();

const { dbUtils } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');

// Legacy route: /api/optimize-resume-json (for frontend compatibility)
router.post('/optimize-resume-json', authenticateToken, asyncHandler(async (req, res) => {
  const { 
    resumeUuid, 
    jobDescription, 
    resumeText, 
    personalInfo, 
    profileUuid, 
    templateUuid, 
    saveAsNew 
  } = req.body;

  // Validation
  if (!jobDescription) {
    throw new AppError('Job description is required', 400, 'JOB_DESCRIPTION_REQUIRED');
  }

  let finalPersonalInfo = personalInfo;
  let finalResumeText = resumeText || '';

  // If profileUuid is provided, fetch profile data
  if (profileUuid) {
    const profile = await dbUtils.get(
      'SELECT * FROM user_profiles WHERE profile_uuid = ? AND user_id = ?',
      [profileUuid, req.user.userId]
    );

    if (profile) {
      const mobileNumbers = JSON.parse(profile.mobile_numbers || '[]');
      finalPersonalInfo = {
        fullName: profile.full_name,
        email: profile.email,
        phone: mobileNumbers[0] || '',
        location: profile.location,
        linkedinUrl: profile.linkedin_url
      };
    }
  }

  // If templateUuid is provided, fetch template data
  if (templateUuid && !finalResumeText.trim()) {
    const template = await dbUtils.get(
      'SELECT * FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
      [templateUuid, req.user.userId]
    );

    if (template && template.resume_content) {
      finalResumeText = template.resume_content;
    }
  }

  // If still no resume text, create a basic template
  if (!finalResumeText.trim()) {
    finalResumeText = `${finalPersonalInfo?.fullName || 'Professional'}

Professional Summary:
Experienced professional seeking new opportunities in a challenging role.

Experience:
[Previous work experience to be enhanced based on job requirements]

Skills:
[Technical and soft skills relevant to the position]

Education:
[Educational background and certifications]
`;
  }

  if (!finalPersonalInfo || !finalPersonalInfo.fullName || !finalPersonalInfo.email) {
    throw new AppError(
      'Personal information with full name and email are required. Please select a profile.',
      400,
      'PERSONAL_INFO_REQUIRED'
    );
  }

  console.log('Processing resume optimization with:', {
    profileUuid,
    templateUuid,
    personalInfoName: finalPersonalInfo.fullName,
    resumeTextLength: finalResumeText.length,
    jobDescriptionLength: jobDescription.length
  });

  // Call AI service for optimization
  const structuredResponse = await aiService.optimizeResume(
    jobDescription,
    finalResumeText,
    finalPersonalInfo
  );

  // If resumeUuid is provided, save the structured data
  if (resumeUuid && !saveAsNew) {
    const optimizedContent = JSON.stringify(structuredResponse, null, 2);
    
    const result = await dbUtils.run(
      'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
      [optimizedContent, 'optimized', resumeUuid, req.user.userId]
    );

    if (result.changes === 0) {
      throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
    }

    res.json({
      success: true,
      optimizedResumeData: structuredResponse,
      resumeUuid,
      timestamp: new Date().toISOString(),
      message: 'Resume optimized and saved successfully'
    });
  } else {
    // Return optimized content without saving
    res.json({
      success: true,
      optimizedResumeData: structuredResponse,
      timestamp: new Date().toISOString()
    });
  }
}));

// Legacy route: /api/save-structured-resume (for frontend compatibility)
router.post('/save-structured-resume', authenticateToken, asyncHandler(async (req, res) => {
  const { resumeUuid, structuredData } = req.body;

  if (!resumeUuid || !structuredData) {
    throw new AppError('Resume UUID and structured data are required', 400, 'MISSING_REQUIRED_DATA');
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(resumeUuid)) {
    throw new AppError('Invalid resume UUID format', 400, 'INVALID_UUID');
  }

  const optimizedContent = JSON.stringify(structuredData, null, 2);

  const result = await dbUtils.run(
    'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
    [optimizedContent, 'optimized', resumeUuid, req.user.userId]
  );

  if (result.changes === 0) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Structured resume saved successfully',
    timestamp: new Date().toISOString()
  });
}));

// Legacy route: /api/upload-resume (for frontend compatibility)
const { uploadSingle } = require('../middleware/upload');

router.post('/upload-resume', authenticateToken, uploadSingle('resume'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED');
  }

  // Validate the uploaded file
  if (!req.file.isValid || !req.file.isValid.isValid) {
    throw new AppError('Invalid file uploaded', 400, 'INVALID_FILE');
  }

  res.json({
    success: true,
    message: 'File uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    }
  });
}));

module.exports = router;