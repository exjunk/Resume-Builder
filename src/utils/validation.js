const config = require('../config/config');
const { AppError } = require('../middleware/errorHandler');

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Phone validation regex (international format)
const PHONE_REGEX = /^[\+]?[0-9\s\-\(\)]{10,20}$/;

// URL validation regex
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// LinkedIn URL validation regex
const LINKEDIN_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;

class ValidationService {
  // Validate email format
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');
    }
    
    if (!EMAIL_REGEX.test(email.trim())) {
      throw new AppError('Invalid email format', 400, 'EMAIL_INVALID_FORMAT');
    }
    
    return email.trim().toLowerCase();
  }

  // Validate password strength
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new AppError('Password is required', 400, 'PASSWORD_REQUIRED');
    }
    
    if (password.length < config.PASSWORD_MIN_LENGTH) {
      throw new AppError(
        `Password must be at least ${config.PASSWORD_MIN_LENGTH} characters long`,
        400,
        'PASSWORD_TOO_SHORT'
      );
    }
    
    return password;
  }

  // Validate phone number
  static validatePhone(phone) {
    if (!phone) return null; // Phone is optional
    
    if (typeof phone !== 'string') {
      throw new AppError('Phone must be a string', 400, 'PHONE_INVALID_TYPE');
    }
    
    const cleanPhone = phone.trim();
    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      throw new AppError('Invalid phone number format', 400, 'PHONE_INVALID_FORMAT');
    }
    
    return cleanPhone || null;
  }

  // Validate URL
  static validateUrl(url) {
    if (!url) return null; // URL is optional
    
    if (typeof url !== 'string') {
      throw new AppError('URL must be a string', 400, 'URL_INVALID_TYPE');
    }
    
    const cleanUrl = url.trim();
    if (cleanUrl && !URL_REGEX.test(cleanUrl)) {
      throw new AppError('Invalid URL format', 400, 'URL_INVALID_FORMAT');
    }
    
    return cleanUrl || null;
  }

  // Validate LinkedIn URL
  static validateLinkedInUrl(url) {
    if (!url) return null; // LinkedIn URL is optional
    
    if (typeof url !== 'string') {
      throw new AppError('LinkedIn URL must be a string', 400, 'LINKEDIN_URL_INVALID_TYPE');
    }
    
    const cleanUrl = url.trim();
    if (cleanUrl && !LINKEDIN_REGEX.test(cleanUrl)) {
      throw new AppError('Invalid LinkedIn URL format', 400, 'LINKEDIN_URL_INVALID_FORMAT');
    }
    
    return cleanUrl || null;
  }

  // Validate required string field
  static validateRequiredString(value, fieldName, maxLength = null) {
    if (!value || typeof value !== 'string') {
      throw new AppError(`${fieldName} is required`, 400, `${fieldName.toUpperCase()}_REQUIRED`);
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
      throw new AppError(`${fieldName} cannot be empty`, 400, `${fieldName.toUpperCase()}_EMPTY`);
    }
    
    if (maxLength && trimmed.length > maxLength) {
      throw new AppError(
        `${fieldName} cannot exceed ${maxLength} characters`,
        400,
        `${fieldName.toUpperCase()}_TOO_LONG`
      );
    }
    
    return trimmed;
  }

  // Validate optional string field
  static validateOptionalString(value, fieldName, maxLength = null) {
    if (!value) return null;
    
    if (typeof value !== 'string') {
      throw new AppError(`${fieldName} must be a string`, 400, `${fieldName.toUpperCase()}_INVALID_TYPE`);
    }
    
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    if (maxLength && trimmed.length > maxLength) {
      throw new AppError(
        `${fieldName} cannot exceed ${maxLength} characters`,
        400,
        `${fieldName.toUpperCase()}_TOO_LONG`
      );
    }
    
    return trimmed;
  }

  // Validate JSON array field
  static validateJsonArray(value, fieldName) {
    if (!value) return [];
    
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new AppError(`${fieldName} must be an array`, 400, `${fieldName.toUpperCase()}_NOT_ARRAY`);
        }
        return parsed;
      } catch (error) {
        throw new AppError(`${fieldName} contains invalid JSON`, 400, `${fieldName.toUpperCase()}_INVALID_JSON`);
      }
    }
    
    if (Array.isArray(value)) {
      return value;
    }
    
    throw new AppError(`${fieldName} must be an array`, 400, `${fieldName.toUpperCase()}_NOT_ARRAY`);
  }

  // Validate mobile numbers array
  static validateMobileNumbers(mobileNumbers) {
    if (!mobileNumbers) return [];
    
    const numbers = this.validateJsonArray(mobileNumbers, 'Mobile numbers');
    
    return numbers.map((number, index) => {
      if (typeof number !== 'string') {
        throw new AppError(
          `Mobile number at index ${index} must be a string`,
          400,
          'MOBILE_NUMBER_INVALID_TYPE'
        );
      }
      
      const validatedNumber = this.validatePhone(number);
      if (!validatedNumber) {
        throw new AppError(
          `Mobile number at index ${index} is invalid`,
          400,
          'MOBILE_NUMBER_INVALID'
        );
      }
      
      return validatedNumber;
    }).filter(Boolean);
  }

  // Validate UUID format
  static validateUuid(uuid, fieldName = 'UUID') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuid || typeof uuid !== 'string') {
      throw new AppError(`${fieldName} is required`, 400, `${fieldName.toUpperCase()}_REQUIRED`);
    }
    
    if (!uuidRegex.test(uuid)) {
      throw new AppError(`Invalid ${fieldName} format`, 400, `${fieldName.toUpperCase()}_INVALID_FORMAT`);
    }
    
    return uuid;
  }

  // Validate boolean field
  static validateBoolean(value, fieldName, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }
    
    if (typeof value === 'number') {
      return Boolean(value);
    }
    
    throw new AppError(
      `${fieldName} must be a boolean value`,
      400,
      `${fieldName.toUpperCase()}_INVALID_TYPE`
    );
  }

  // Validate user registration data
  static validateUserRegistration(data) {
    return {
      fullName: this.validateRequiredString(data.fullName, 'Full name', 100),
      email: this.validateEmail(data.email),
      phone: this.validatePhone(data.phone),
      location: this.validateOptionalString(data.location, 'Location', 200),
      password: this.validatePassword(data.password)
    };
  }

  // Validate user login data
  static validateUserLogin(data) {
    return {
      email: this.validateEmail(data.email),
      password: this.validateRequiredString(data.password, 'Password')
    };
  }

  // Validate profile data
  static validateProfileData(data) {
    return {
      profileName: this.validateRequiredString(data.profileName, 'Profile name', config.PROFILE_NAME_MAX_LENGTH),
      fullName: this.validateRequiredString(data.fullName, 'Full name', 100),
      email: this.validateEmail(data.email),
      mobileNumbers: this.validateMobileNumbers(data.mobileNumbers),
      linkedinUrl: this.validateLinkedInUrl(data.linkedinUrl),
      location: this.validateOptionalString(data.location, 'Location', 200),
      isDefault: this.validateBoolean(data.isDefault, 'Is default')
    };
  }

  // Validate template data
  static validateTemplateData(data) {
    return {
      templateName: this.validateRequiredString(data.templateName, 'Template name', config.TEMPLATE_NAME_MAX_LENGTH),
      resumeContent: this.validateRequiredString(data.resumeContent, 'Resume content'),
      professionalSummary: this.validateOptionalString(data.professionalSummary, 'Professional summary'),
      skills: this.validateJsonArray(data.skills, 'Skills'),
      experience: this.validateJsonArray(data.experience, 'Experience'),
      education: this.validateJsonArray(data.education, 'Education'),
      isDefault: this.validateBoolean(data.isDefault, 'Is default')
    };
  }

  // Validate resume data
  static validateResumeData(data) {
    return {
      resumeTitle: this.validateRequiredString(data.resumeTitle, 'Resume title', config.RESUME_TITLE_MAX_LENGTH),
      companyName: this.validateRequiredString(data.companyName, 'Company name', 200),
      jobId: this.validateOptionalString(data.jobId, 'Job ID', 100),
      jobUrl: this.validateUrl(data.jobUrl),
      jobPostingCompany: this.validateOptionalString(data.jobPostingCompany, 'Job posting company', 200),
      jobDescription: this.validateRequiredString(data.jobDescription, 'Job description'),
      originalResumeContent: this.validateRequiredString(data.originalResumeContent, 'Resume content')
    };
  }
}

module.exports = ValidationService;