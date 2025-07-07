const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database setup
const DB_PATH = path.join(__dirname, 'database', 'resume_optimizer.db');
let db;

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Ensure database directory exists
    fs.ensureDirSync(path.dirname(DB_PATH));
    
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('📁 Connected to SQLite database');
      
      // Create tables
      db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_uuid TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          location TEXT,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Resumes table
        db.run(`CREATE TABLE IF NOT EXISTS resumes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resume_uuid TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL,
          resume_title TEXT NOT NULL,
          company_name TEXT NOT NULL,
          job_id TEXT,
          job_url TEXT,
          job_posting_company TEXT,
          job_description TEXT NOT NULL,
          original_resume_content TEXT NOT NULL,
          optimized_resume_content TEXT,
          status TEXT DEFAULT 'draft',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )`);

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(user_uuid)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_resumes_uuid ON resumes(resume_uuid)`);
        
        console.log('✅ Database tables created/verified');
        resolve();
      });
    });
  });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt, .pdf, .doc, and .docx files are allowed.'));
    }
  }
});

// Gemini API integration
async function callGeminiAPI(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key not found in environment variables');
  }

  const modelName = 'gemini-1.5-flash';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || 'Gemini API request failed';
      } catch {
        errorMessage = `API request failed with status ${response.status}: ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

// Test Gemini API connectivity
async function testGeminiAPI() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return { connected: false, error: 'API key not configured' };
  }

  try {
    const testPrompt = "Hello, this is a test. Please respond with 'API is working!'";
    const response = await callGeminiAPI(testPrompt);
    
    return { 
      connected: true, 
      model: 'gemini-1.5-flash',
      testResponse: response.substring(0, 100) + (response.length > 100 ? '...' : '')
    };
  } catch (error) {
    return { 
      connected: false, 
      error: error.message,
      model: 'gemini-1.5-flash'
    };
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  const geminiStatus = await testGeminiAPI();
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    geminiConnection: geminiStatus,
    database: 'Connected'
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, location, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const userUuid = uuidv4();

        db.run(
          'INSERT INTO users (user_uuid, full_name, email, phone, location, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
          [userUuid, fullName, email, phone || null, location || null, passwordHash],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create user' });
            }

            const token = jwt.sign(
              { userId: this.lastID, userUuid, email, fullName },
              JWT_SECRET,
              { expiresIn: '7d' }
            );

            res.status(201).json({
              message: 'User created successfully',
              token,
              user: { id: this.lastID, userUuid, fullName, email, phone, location }
            });
          }
        );
      } catch (error) {
        console.error('Hash error:', error);
        res.status(500).json({ error: 'Failed to process password' });
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        try {
          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          
          if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
          }

          const token = jwt.sign(
            { userId: user.id, userUuid: user.user_uuid, email: user.email, fullName: user.full_name },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
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
          console.error('Password comparison error:', error);
          res.status(500).json({ error: 'Authentication failed' });
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// User Routes
app.get('/api/users/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, user_uuid, full_name, email, phone, location, created_at FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

app.put('/api/users/me', authenticateToken, (req, res) => {
  try {
    const { fullName, phone, location } = req.body;

    db.run(
      'UPDATE users SET full_name = ?, phone = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [fullName, phone || null, location || null, req.user.userId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update user' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully' });
      }
    );
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Resume Routes
app.get('/api/resumes', authenticateToken, (req, res) => {
  db.all(
    `SELECT id, resume_uuid, resume_title, company_name, job_posting_company, 
     status, created_at, updated_at FROM resumes 
     WHERE user_id = ? ORDER BY updated_at DESC`,
    [req.user.userId],
    (err, resumes) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ resumes });
    }
  );
});

app.get('/api/resumes/:resumeUuid', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM resumes WHERE resume_uuid = ? AND user_id = ?',
    [req.params.resumeUuid, req.user.userId],
    (err, resume) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      res.json({ resume });
    }
  );
});

app.post('/api/resumes', authenticateToken, (req, res) => {
  try {
    const {
      resumeTitle,
      companyName,
      jobId,
      jobUrl,
      jobPostingCompany,
      jobDescription,
      originalResumeContent
    } = req.body;

    if (!resumeTitle || !companyName || !jobDescription || !originalResumeContent) {
      return res.status(400).json({ 
        error: 'Resume title, company name, job description, and resume content are required' 
      });
    }

    const resumeUuid = uuidv4();

    db.run(
      `INSERT INTO resumes 
       (resume_uuid, user_id, resume_title, company_name, job_id, job_url, 
        job_posting_company, job_description, original_resume_content, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        resumeUuid,
        req.user.userId,
        resumeTitle,
        companyName,
        jobId || null,
        jobUrl || null,
        jobPostingCompany || companyName,
        jobDescription,
        originalResumeContent
      ],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save resume' });
        }

        res.status(201).json({
          message: 'Resume saved successfully',
          resumeUuid,
          resumeId: this.lastID
        });
      }
    );
  } catch (error) {
    console.error('Save resume error:', error);
    res.status(500).json({ error: 'Failed to save resume' });
  }
});

app.put('/api/resumes/:resumeUuid', authenticateToken, (req, res) => {
  try {
    const { optimizedResumeContent, status } = req.body;

    db.run(
      'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
      [optimizedResumeContent, status || 'optimized', req.params.resumeUuid, req.user.userId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update resume' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Resume not found' });
        }

        res.json({ message: 'Resume updated successfully' });
      }
    );
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

app.delete('/api/resumes/:resumeUuid', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM resumes WHERE resume_uuid = ? AND user_id = ?',
    [req.params.resumeUuid, req.user.userId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete resume' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      res.json({ message: 'Resume deleted successfully' });
    }
  );
});

// Enhanced resume optimization endpoint
app.post('/api/optimize-resume', authenticateToken, async (req, res) => {
  try {
    const { resumeUuid, jobDescription, resumeText, personalInfo, saveAsNew } = req.body;

    // Validation
    if (!jobDescription || !resumeText) {
      return res.status(400).json({ 
        error: 'Job description and resume text are required' 
      });
    }

    if (!personalInfo || !personalInfo.fullName || !personalInfo.email) {
      return res.status(400).json({ 
        error: 'Personal information with full name and email are required' 
      });
    }

    // Create detailed prompt for ATS optimization with formatting instructions
    const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer. Your task is to rewrite the provided resume to maximize ATS compatibility and keyword matching for the specific job description.

IMPORTANT INSTRUCTIONS:
1. Rewrite the resume content to closely match the job requirements
2. Include relevant keywords from the job description naturally
3. Use standard resume section headers (PROFESSIONAL SUMMARY, EXPERIENCE, SKILLS, EDUCATION)
4. Format in a clean, ATS-friendly structure with proper markdown formatting
5. Quantify achievements where possible with specific numbers and percentages
6. Tailor the professional summary to the specific role
7. Ensure all technical skills mentioned in the job posting are included if relevant
8. Use action verbs and industry-specific terminology
9. Keep the same factual information but optimize presentation
10. Make it comprehensive but concise

FORMATTING REQUIREMENTS:
- Use ## for major section headers (PROFESSIONAL SUMMARY, EXPERIENCE, etc.)
- Use **bold** for job titles, company names, and important keywords
- Use bullet points (•) for achievements and responsibilities
- Use *italic* for dates and locations
- Maintain clean, professional structure
- Include quantified achievements (numbers, percentages, dollar amounts)

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME CONTENT:
${resumeText}

PERSONAL INFORMATION:
Name: ${personalInfo.fullName}
Email: ${personalInfo.email}
Phone: ${personalInfo.phone || 'Not provided'}
Location: ${personalInfo.location || 'Not provided'}

Please generate a complete, ATS-optimized resume that would score highly for this specific job. Format it as a professional resume with proper markdown formatting for headers, bold text, and bullet points. Do not include any explanations or comments, just the optimized resume content with proper formatting.`;

    // Call Gemini API
    const optimizedContent = await callGeminiAPI(prompt);
    
    // Format the final resume
    const finalResume = `${personalInfo.fullName}
${personalInfo.email} | ${personalInfo.phone || ''} | ${personalInfo.location || ''}

${optimizedContent}`;

    // If resumeUuid is provided, update existing resume
    if (resumeUuid && !saveAsNew) {
      db.run(
        'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
        [finalResume, 'optimized', resumeUuid, req.user.userId],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update resume' });
          }

          res.json({
            success: true,
            optimizedResume: finalResume,
            resumeUuid,
            timestamp: new Date().toISOString(),
            message: 'Resume optimized and saved successfully'
          });
        }
      );
    } else {
      // Return optimized content without saving (for new resumes or previews)
      res.json({
        success: true,
        optimizedResume: finalResume,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Resume optimization error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to optimize resume' 
    });
  }
});

// File upload endpoint
app.post('/api/upload-resume', upload.single('resume'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({ 
      message: 'File uploaded successfully',
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});


// Add this new endpoint to your existing server.js file

// Enhanced resume optimization endpoint with JSON structure
app.post('/api/optimize-resume-json', authenticateToken, async (req, res) => {
  try {
    const { resumeUuid, jobDescription, resumeText, personalInfo, saveAsNew } = req.body;

    // Validation
    if (!jobDescription || !resumeText) {
      return res.status(400).json({ 
        error: 'Job description and resume text are required' 
      });
    }

    if (!personalInfo || !personalInfo.fullName || !personalInfo.email) {
      return res.status(400).json({ 
        error: 'Personal information with full name and email are required' 
      });
    }

    // Create detailed prompt for structured JSON response
    const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer. Your task is to analyze the provided resume and job description, then create an optimized resume in a specific JSON format.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any explanations, markdown, or text outside the JSON structure.

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME CONTENT:
${resumeText}

PERSONAL INFORMATION:
Name: ${personalInfo.fullName}
Email: ${personalInfo.email}
Phone: ${personalInfo.phone || 'Not provided'}
Location: ${personalInfo.location || 'Not provided'}

Analyze the job description and optimize the resume content to match the requirements. Return a JSON object with this exact structure:

{
  "name": "Full Name",
  "email": "email@example.com",
  "mobileNumbers": ["primary phone", "secondary phone if applicable"],
  "linkedinUrl": "https://linkedin.com/in/profile or generate appropriate one",
  "professionalSummary": "2-3 sentence ATS-optimized professional summary tailored to the job",
  "professionalExperience": [
    {
      "jobName": "Company Name",
      "term": "Start Date - End Date",
      "jobDesignation": "Job Title",
      "jobDetails": [
        "Achievement 1 with quantified results",
        "Achievement 2 with quantified results",
        "Achievement 3 with quantified results"
      ]
    }
  ],
  "skills": [
    {
      "skillName": "Technical Skills",
      "skills": ["skill1", "skill2", "skill3"]
    },
    {
      "skillName": "Programming Languages",
      "skills": ["language1", "language2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "collegeName": "Institution Name",
      "tenure": "Start Year - End Year"
    }
  ]
}

Focus on:
1. Including keywords from the job description
2. Quantifying achievements with numbers/percentages
3. Using action verbs and industry terminology
4. Making skills highly relevant to the job requirements
5. Ensuring the professional summary directly addresses the role
6. Organizing experience in reverse chronological order

Respond with ONLY the JSON object, nothing else.`;

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(prompt);
    
    // Clean the response to ensure it's valid JSON
    let cleanedResponse = geminiResponse.trim();
    
    // Remove any markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any leading/trailing text that isn't JSON
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
    }

    let optimizedResumeData;
    try {
      optimizedResumeData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Gemini Response:', geminiResponse);
      
      // Fallback: create a structured response from the text
      optimizedResumeData = {
        name: personalInfo.fullName,
        email: personalInfo.email,
        mobileNumbers: personalInfo.phone ? [personalInfo.phone] : [],
        linkedinUrl: "",
        professionalSummary: "Professional summary to be optimized",
        professionalExperience: [],
        skills: [],
        education: []
      };
    }

    // Ensure the response has the correct structure
    const structuredResponse = {
      name: optimizedResumeData.name || personalInfo.fullName,
      email: optimizedResumeData.email || personalInfo.email,
      mobileNumbers: Array.isArray(optimizedResumeData.mobileNumbers) ? optimizedResumeData.mobileNumbers : 
                     (personalInfo.phone ? [personalInfo.phone] : []),
      linkedinUrl: optimizedResumeData.linkedinUrl || "",
      professionalSummary: optimizedResumeData.professionalSummary || "",
      professionalExperience: Array.isArray(optimizedResumeData.professionalExperience) ? 
                             optimizedResumeData.professionalExperience : [],
      skills: Array.isArray(optimizedResumeData.skills) ? optimizedResumeData.skills : [],
      education: Array.isArray(optimizedResumeData.education) ? optimizedResumeData.education : []
    };

    // If resumeUuid is provided, save the structured data
    if (resumeUuid && !saveAsNew) {
      const optimizedContent = JSON.stringify(structuredResponse, null, 2);
      
      db.run(
        'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
        [optimizedContent, 'optimized', resumeUuid, req.user.userId],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update resume' });
          }

          res.json({
            success: true,
            optimizedResumeData: structuredResponse,
            resumeUuid,
            timestamp: new Date().toISOString(),
            message: 'Resume optimized and saved successfully'
          });
        }
      );
    } else {
      // Return optimized content without saving
      res.json({
        success: true,
        optimizedResumeData: structuredResponse,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Resume optimization error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to optimize resume' 
    });
  }
});

// New endpoint to save structured resume data
app.post('/api/save-structured-resume', authenticateToken, async (req, res) => {
  try {
    const { resumeUuid, structuredData } = req.body;

    if (!resumeUuid || !structuredData) {
      return res.status(400).json({ error: 'Resume UUID and structured data are required' });
    }

    const optimizedContent = JSON.stringify(structuredData, null, 2);

    db.run(
      'UPDATE resumes SET optimized_resume_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE resume_uuid = ? AND user_id = ?',
      [optimizedContent, 'optimized', resumeUuid, req.user.userId],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save structured resume' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Resume not found' });
        }

        res.json({
          success: true,
          message: 'Structured resume saved successfully',
          timestamp: new Date().toISOString()
        });
      }
    );
  } catch (error) {
    console.error('Save structured resume error:', error);
    res.status(500).json({ error: 'Failed to save structured resume' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 ATS Resume Optimizer Server running on http://localhost:${PORT}`);
      console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
      console.log(`🔑 Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
      console.log(`💾 Database: ${DB_PATH}`);
      
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables');
        console.log('   Please add your API key to the .env file');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (db) {
    db.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (db) {
    db.close();
  }
  process.exit(0);
});

// Export for potential testing
module.exports = { app, initDatabase };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

