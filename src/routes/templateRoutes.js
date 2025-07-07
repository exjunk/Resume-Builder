const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { dbUtils } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const ValidationService = require('../utils/validation');

// Get all resume templates
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const templates = await dbUtils.all(
    `SELECT id, template_uuid, template_name, professional_summary, 
     is_default, created_at, updated_at 
     FROM resume_templates WHERE user_id = ? ORDER BY is_default DESC, template_name ASC`,
    [req.user.userId]
  );

  res.json({
    success: true,
    templates
  });
}));

// Get specific resume template
router.get('/:templateUuid', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');

  const template = await dbUtils.get(
    'SELECT * FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (!template) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  // Parse JSON fields
  template.skills = template.skills ? JSON.parse(template.skills) : [];
  template.experience = template.experience ? JSON.parse(template.experience) : [];
  template.education = template.education ? JSON.parse(template.education) : [];

  res.json({
    success: true,
    template
  });
}));

// Create resume template
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input data
  const validatedData = ValidationService.validateTemplateData(req.body);

  const templateUuid = uuidv4();
  const skillsJson = JSON.stringify(validatedData.skills);
  const experienceJson = JSON.stringify(validatedData.experience);
  const educationJson = JSON.stringify(validatedData.education);

  // Helper function to insert template
  const insertTemplate = async () => {
    const result = await dbUtils.run(
      `INSERT INTO resume_templates 
       (template_uuid, user_id, template_name, resume_content, professional_summary, 
        skills, experience, education, is_default) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateUuid,
        req.user.userId,
        validatedData.templateName,
        validatedData.resumeContent,
        validatedData.professionalSummary,
        skillsJson,
        experienceJson,
        educationJson,
        validatedData.isDefault ? 1 : 0
      ]
    );

    return result;
  };

  // If this is set as default, unset other defaults first
  if (validatedData.isDefault) {
    await dbUtils.run(
      'UPDATE resume_templates SET is_default = 0 WHERE user_id = ?',
      [req.user.userId]
    );
  }

  const result = await insertTemplate();

  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    templateUuid,
    templateId: result.lastID
  });
}));

// Update resume template
router.put('/:templateUuid', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');
  
  // Validate input data
  const validatedData = ValidationService.validateTemplateData(req.body);

  const skillsJson = JSON.stringify(validatedData.skills);
  const experienceJson = JSON.stringify(validatedData.experience);
  const educationJson = JSON.stringify(validatedData.education);

  // Helper function to update template
  const updateTemplate = async () => {
    const result = await dbUtils.run(
      `UPDATE resume_templates SET 
       template_name = ?, resume_content = ?, professional_summary = ?, 
       skills = ?, experience = ?, education = ?, is_default = ?, 
       updated_at = CURRENT_TIMESTAMP 
       WHERE template_uuid = ? AND user_id = ?`,
      [
        validatedData.templateName,
        validatedData.resumeContent,
        validatedData.professionalSummary,
        skillsJson,
        experienceJson,
        educationJson,
        validatedData.isDefault ? 1 : 0,
        templateUuid,
        req.user.userId
      ]
    );

    return result;
  };

  // If this is set as default, unset other defaults first
  if (validatedData.isDefault) {
    await dbUtils.run(
      'UPDATE resume_templates SET is_default = 0 WHERE user_id = ? AND template_uuid != ?',
      [req.user.userId, templateUuid]
    );
  }

  const result = await updateTemplate();

  if (result.changes === 0) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Template updated successfully'
  });
}));

// Delete resume template
router.delete('/:templateUuid', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');

  // Check if template exists and get its default status
  const template = await dbUtils.get(
    'SELECT is_default FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (!template) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  // Check if there are other templates before deleting the default
  if (template.is_default) {
    const templateCount = await dbUtils.get(
      'SELECT COUNT(*) as count FROM resume_templates WHERE user_id = ?',
      [req.user.userId]
    );

    if (templateCount.count > 1) {
      // Set another template as default before deleting
      await dbUtils.run(
        `UPDATE resume_templates SET is_default = 1 
         WHERE user_id = ? AND template_uuid != ? 
         ORDER BY created_at ASC LIMIT 1`,
        [req.user.userId, templateUuid]
      );
    }
  }

  // Delete the template
  const result = await dbUtils.run(
    'DELETE FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (result.changes === 0) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Template deleted successfully'
  });
}));

// Set template as default
router.patch('/:templateUuid/set-default', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');

  // Check if template exists
  const template = await dbUtils.get(
    'SELECT id FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (!template) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  // Start transaction
  await dbUtils.beginTransaction();

  try {
    // Unset all defaults for this user
    await dbUtils.run(
      'UPDATE resume_templates SET is_default = 0 WHERE user_id = ?',
      [req.user.userId]
    );

    // Set the selected template as default
    await dbUtils.run(
      'UPDATE resume_templates SET is_default = 1 WHERE template_uuid = ? AND user_id = ?',
      [templateUuid, req.user.userId]
    );

    // Commit transaction
    await dbUtils.commit();

    res.json({
      success: true,
      message: 'Template set as default successfully'
    });

  } catch (error) {
    // Rollback transaction
    await dbUtils.rollback();
    throw error;
  }
}));

// Duplicate template
router.post('/:templateUuid/duplicate', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');
  
  // Get the original template
  const originalTemplate = await dbUtils.get(
    'SELECT * FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (!originalTemplate) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  const newTemplateUuid = uuidv4();
  const newTemplateName = `${originalTemplate.template_name} (Copy)`;

  // Create duplicate template
  const result = await dbUtils.run(
    `INSERT INTO resume_templates 
     (template_uuid, user_id, template_name, resume_content, professional_summary, 
      skills, experience, education, is_default) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newTemplateUuid,
      req.user.userId,
      newTemplateName,
      originalTemplate.resume_content,
      originalTemplate.professional_summary,
      originalTemplate.skills,
      originalTemplate.experience,
      originalTemplate.education,
      0 // New template is not default
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Template duplicated successfully',
    templateUuid: newTemplateUuid,
    templateId: result.lastID
  });
}));

// Get template preview (content summary)
router.get('/:templateUuid/preview', authenticateToken, asyncHandler(async (req, res) => {
  const templateUuid = ValidationService.validateUuid(req.params.templateUuid, 'Template UUID');

  const template = await dbUtils.get(
    'SELECT template_name, professional_summary, resume_content, created_at FROM resume_templates WHERE template_uuid = ? AND user_id = ?',
    [templateUuid, req.user.userId]
  );

  if (!template) {
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  // Create a preview with limited content
  const contentPreview = template.resume_content ? 
    template.resume_content.substring(0, 300) + (template.resume_content.length > 300 ? '...' : '') : 
    'No content';

  res.json({
    success: true,
    preview: {
      templateName: template.template_name,
      professionalSummary: template.professional_summary || 'No summary provided',
      contentPreview,
      createdAt: template.created_at,
      wordCount: template.resume_content ? template.resume_content.split(/\s+/).length : 0
    }
  });
}));

module.exports = router;