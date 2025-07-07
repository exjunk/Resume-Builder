const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/config');
const { AppError } = require('./errorHandler');

// Ensure upload directory exists
fs.ensureDirSync(config.UPLOAD_DIR);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${sanitizedBaseName}_${uniqueSuffix}${extension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(
      `Invalid file type. Allowed types: ${config.ALLOWED_FILE_TYPES.join(', ')}`,
      400,
      'INVALID_FILE_TYPE'
    ), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadHandler = upload.single(fieldName);
    
    uploadHandler(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return next(new AppError(
                `File too large. Maximum size is ${config.MAX_FILE_SIZE / (1024 * 1024)}MB`,
                400,
                'FILE_TOO_LARGE'
              ));
            case 'LIMIT_UNEXPECTED_FILE':
              return next(new AppError(
                'Unexpected file field',
                400,
                'UNEXPECTED_FILE_FIELD'
              ));
            case 'LIMIT_FILE_COUNT':
              return next(new AppError(
                'Too many files',
                400,
                'TOO_MANY_FILES'
              ));
            default:
              return next(new AppError(
                'File upload error',
                400,
                'FILE_UPLOAD_ERROR'
              ));
          }
        }
        return next(err);
      }
      
      // Add file validation
      if (req.file) {
        req.file.isValid = validateUploadedFile(req.file);
      }
      
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const uploadHandler = upload.array(fieldName, maxCount);
    
    uploadHandler(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return next(new AppError(
                `File too large. Maximum size is ${config.MAX_FILE_SIZE / (1024 * 1024)}MB`,
                400,
                'FILE_TOO_LARGE'
              ));
            case 'LIMIT_UNEXPECTED_FILE':
              return next(new AppError(
                'Unexpected file field',
                400,
                'UNEXPECTED_FILE_FIELD'
              ));
            case 'LIMIT_FILE_COUNT':
              return next(new AppError(
                `Too many files. Maximum ${maxCount} files allowed`,
                400,
                'TOO_MANY_FILES'
              ));
            default:
              return next(new AppError(
                'File upload error',
                400,
                'FILE_UPLOAD_ERROR'
              ));
          }
        }
        return next(err);
      }
      
      // Add file validation for each uploaded file
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          file.isValid = validateUploadedFile(file);
        });
      }
      
      next();
    });
  };
};

// Validate uploaded file
function validateUploadedFile(file) {
  const validationResult = {
    isValid: true,
    errors: []
  };

  // Check file size
  if (file.size > config.MAX_FILE_SIZE) {
    validationResult.isValid = false;
    validationResult.errors.push('File size exceeds maximum limit');
  }

  // Check file type
  if (!config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    validationResult.isValid = false;
    validationResult.errors.push('Invalid file type');
  }

  // Check if file exists on disk
  if (!fs.existsSync(file.path)) {
    validationResult.isValid = false;
    validationResult.errors.push('File was not saved properly');
  }

  // Additional security checks
  const extension = path.extname(file.originalname).toLowerCase();
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.jar'];
  
  if (dangerousExtensions.includes(extension)) {
    validationResult.isValid = false;
    validationResult.errors.push('Potentially dangerous file type');
  }

  return validationResult;
}

// Clean up uploaded file
async function deleteUploadedFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting uploaded file:', error);
    return false;
  }
}

// Clean up old uploaded files (can be called periodically)
async function cleanupOldFiles(maxAgeHours = 24) {
  try {
    const uploadDir = config.UPLOAD_DIR;
    const files = await fs.readdir(uploadDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

    let deletedCount = 0;

    for (const filename of files) {
      const filePath = path.join(uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    console.log(`Cleaned up ${deletedCount} old uploaded files`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old files:', error);
    return 0;
  }
}

// Get file info
function getFileInfo(file) {
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString(),
    isValid: file.isValid || validateUploadedFile(file)
  };
}

// Parse text from uploaded file (basic implementation)
async function parseFileContent(filePath, mimetype) {
  try {
    switch (mimetype) {
      case 'text/plain':
        return await fs.readFile(filePath, 'utf8');
      
      case 'application/pdf':
        // For PDF parsing, you would need a library like pdf-parse
        // return await parsePDF(filePath);
        throw new AppError('PDF parsing not implemented', 501, 'PDF_PARSING_NOT_IMPLEMENTED');
      
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For Word document parsing, you would need a library like mammoth
        // return await parseWordDocument(filePath);
        throw new AppError('Word document parsing not implemented', 501, 'WORD_PARSING_NOT_IMPLEMENTED');
      
      default:
        throw new AppError('Unsupported file type for content parsing', 400, 'UNSUPPORTED_FILE_TYPE');
    }
  } catch (error) {
    console.error('Error parsing file content:', error);
    throw error;
  }
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  validateUploadedFile,
  deleteUploadedFile,
  cleanupOldFiles,
  getFileInfo,
  parseFileContent
};