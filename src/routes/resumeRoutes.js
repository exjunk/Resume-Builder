const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { dbUtils } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const ValidationService = require('../utils/validation');
const aiService = require('../services/aiService');

// Get all user resumes
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  
  let whereClause = 'WHERE user_id = ?';
  let queryParams = [req.user.userId];
  
  if (status) {
    whereClause += ' AND status = ?';
    queryParams.push(status);
  }
  
  const resumes = await dbUtils.all(
    `SELECT id, resume_uuid, resume_title, company_name, job_posting_company, 
     status, created_at, updated_at FROM resumes 
     ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, parseInt(limit), parseInt(offset)]
  );

  // Get total count
  const countResult = await dbUtils.get(
    `SELECT COUNT(*) as total FROM resumes ${whereClause}`,
    queryParams
  );

  res.json({
    success: true,
    resumes,
    pagination: {
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: countResult.total > parseInt(offset) + parseInt(limit)
    }
  });
}));

// Get specific resume
router.get('/:resumeUuid', authenticateToken, asyncHandler(async (req, res) => {
  const resumeUuid = ValidationService.validateUuid(req.params.resumeUuid, 'Resume UUID');

  const resume = await dbUtils.get(
    'SELECT * FROM resumes WHERE resume_uuid = ? AND user_id = ?',
    [resumeUuid, req.user.userId]
  );

  if (!resume) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  res.json({
    success: true,
    resume
  });
}));

// Create new resume
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input data
  const validatedData = ValidationService.validateResumeData(req.body);
  
  const { profileId, templateId } = req.body;

  const resumeUuid = uuidv4();

  const result = await dbUtils.run(
    `INSERT INTO resumes 
     (resume_uuid, user_id, profile_id, template_id, resume_title, company_name, job_id, job_url, 
      job_posting_company, job_description, original_resume_content, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [
      resumeUuid,
      req.user.userId,
      profileId || null,
      templateId || null,
      validatedData.resumeTitle,
      validatedData.companyName,
      validatedData.jobId,
      validatedData.jobUrl,
      validatedData.jobPostingCompany || validatedData.companyName,
      validatedData.jobDescription,
      validatedData.originalResumeContent
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Resume created successfully',
    resumeUuid,
    resumeId: result.lastID
  });
}));

// Update resume
router.put('/:resumeUuid', authenticateToken, asyncHandler(async (req, res) => {
  const resumeUuid = ValidationService.validateUuid(req.params.resumeUuid, 'Resume UUID');
  
  const { optimizedResumeContent, status } = req.body;
  
  // If updating with optimized content
  if (optimizedResumeContent) {
    const result = await dbUtils.run(
      'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
      [optimizedResumeContent, status || 'optimized', resumeUuid, req.user.userId]
    );

    if (result.changes === 0) {
      throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Resume updated successfully'
    });
    return;
  }

  // If updating basic resume data
  const validatedData = ValidationService.validateResumeData(req.body);
  const { profileId, templateId } = req.body;

  const result = await dbUtils.run(
    `UPDATE resumes SET 
     profile_id = ?, template_id = ?, resume_title = ?, company_name = ?, job_id = ?, job_url = ?, 
     job_posting_company = ?, job_description = ?, original_resume_content = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE resume_uuid = ? AND user_id = ?`,
    [
      profileId || null,
      templateId || null,
      validatedData.resumeTitle,
      validatedData.companyName,
      validatedData.jobId,
      validatedData.jobUrl,
      validatedData.jobPostingCompany || validatedData.companyName,
      validatedData.jobDescription,
      validatedData.originalResumeContent,
      resumeUuid,
      req.user.userId
    ]
  );

  if (result.changes === 0) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Resume updated successfully'
  });
}));

// Delete resume
router.delete('/:resumeUuid', authenticateToken, asyncHandler(async (req, res) => {
  const resumeUuid = ValidationService.validateUuid(req.params.resumeUuid, 'Resume UUID');

  const result = await dbUtils.run(
    'DELETE FROM resumes WHERE resume_uuid = ? AND user_id = ?',
    [resumeUuid, req.user.userId]
  );

  if (result.changes === 0) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Resume deleted successfully'
  });
}));

// AI Resume Optimization Endpoint
router.post('/optimize', authenticateToken, asyncHandler(async (req, res) => {
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

// Save structured resume data
router.post('/save-structured', authenticateToken, asyncHandler(async (req, res) => {
  const { resumeUuid, structuredData } = req.body;

  if (!resumeUuid || !structuredData) {
    throw new AppError('Resume UUID and structured data are required', 400, 'MISSING_REQUIRED_DATA');
  }

  const resumeUuidValidated = ValidationService.validateUuid(resumeUuid, 'Resume UUID');
  const optimizedContent = JSON.stringify(structuredData, null, 2);

  const result = await dbUtils.run(
    'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
    [optimizedContent, 'optimized', resumeUuidValidated, req.user.userId]
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

// Duplicate resume
router.post('/:resumeUuid/duplicate', authenticateToken, asyncHandler(async (req, res) => {
  const resumeUuid = ValidationService.validateUuid(req.params.resumeUuid, 'Resume UUID');
  
  // Get the original resume
  const originalResume = await dbUtils.get(
    'SELECT * FROM resumes WHERE resume_uuid = ? AND user_id = ?',
    [resumeUuid, req.user.userId]
  );

  if (!originalResume) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  const newResumeUuid = uuidv4();
  const newResumeTitle = `${originalResume.resume_title} (Copy)`;

  // Create duplicate resume
  const result = await dbUtils.run(
    `INSERT INTO resumes 
     (resume_uuid, user_id, profile_id, template_id, resume_title, company_name, job_id, job_url, 
      job_posting_company, job_description, original_resume_content, optimized_resume_content, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newResumeUuid,
      req.user.userId,
      originalResume.profile_id,
      originalResume.template_id,
      newResumeTitle,
      originalResume.company_name,
      originalResume.job_id,
      originalResume.job_url,
      originalResume.job_posting_company,
      originalResume.job_description,
      originalResume.original_resume_content,
      originalResume.optimized_resume_content,
      'draft' // New resume starts as draft
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Resume duplicated successfully',
    resumeUuid: newResumeUuid,
    resumeId: result.lastID
  });
}));

// Get resume statistics
router.get('/stats/overview', authenticateToken, asyncHandler(async (req, res) => {
  // Get total count by status
  const statusStats = await dbUtils.all(
    'SELECT status, COUNT(*) as count FROM resumes WHERE user_id = ? GROUP BY status',
    [req.user.userId]
  );

  // Get recent activity (last 30 days)
  const recentActivity = await dbUtils.get(
    `SELECT COUNT(*) as count FROM resumes 
     WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`,
    [req.user.userId]
  );

  // Get most used companies
  const topCompanies = await dbUtils.all(
    `SELECT company_name, COUNT(*) as count FROM resumes 
     WHERE user_id = ? GROUP BY company_name ORDER BY count DESC LIMIT 5`,
    [req.user.userId]
  );

  res.json({
    success: true,
    stats: {
      statusBreakdown: statusStats,
      recentActivity: recentActivity.count,
      topCompanies
    }
  });
}));

module.exports = router;