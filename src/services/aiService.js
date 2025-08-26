const config = require('../config/config');
const { AppError } = require('../middleware/errorHandler');
const https = require('https');
const { URL } = require('url');

class AIService {
  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL;
    this.baseUrl = config.GEMINI_API_URL;
    this.timeout = config.AI_RESPONSE_TIMEOUT || 30000;
    this.maxRetries = config.AI_MAX_RETRIES || 3;
  }

  // Direct HTTP request implementation to bypass httpClient issues
  async makeHTTPRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url);
        
        const requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: options.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ATS-Resume-Optimizer/1.0',
            ...options.headers
          },
          timeout: options.timeout || this.timeout
        };

        console.log(`🌐 Making ${requestOptions.method} request to: ${parsedUrl.hostname}${requestOptions.path}`);

        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log(`📡 Response status: ${res.statusCode} ${res.statusMessage}`);
            
            const response = {
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage || '',
              headers: res.headers,
              url: url,
              async json() { 
                try {
                  return JSON.parse(data);
                } catch (parseError) {
                  throw new Error(`Invalid JSON response: ${parseError.message}`);
                }
              },
              async text() { 
                return data; 
              }
            };
            
            if (!response.ok) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              return;
            }
            
            resolve(response);
          });
        });

        req.on('error', (error) => {
          console.error('❌ HTTPS request error:', error.message);
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.on('timeout', () => {
          console.error('❌ Request timeout');
          req.destroy();
          reject(new Error(`Request timeout after ${options.timeout || this.timeout}ms`));
        });

        // Set timeout
        req.setTimeout(options.timeout || this.timeout);

        // Write body if provided
        if (options.body) {
          req.write(options.body);
        }

        req.end();
      } catch (error) {
        console.error('❌ Request setup error:', error.message);
        reject(new Error(`Request setup failed: ${error.message}`));
      }
    });
  }

  // Test HTTP client functionality
  async testConnection() {
    if (!this.apiKey) {
      return { 
        connected: false, 
        error: 'API key not configured',
        model: this.model
      };
    }

    try {
      console.log('🔍 Testing Gemini API connection...');
      
      const testPrompt = "Hello, this is a test. Please respond with 'API is working!'";
      
      // Direct API call for testing
      const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
      
      const payload = {
        contents: [{
          parts: [{
            text: testPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      };

      const response = await this.makeHTTPRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      const data = await response.json();
      const testResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Test completed';
      
      console.log('✅ Gemini API connection test successful');
      
      return { 
        connected: true, 
        model: this.model,
        testResponse: testResponse.substring(0, 100) + (testResponse.length > 100 ? '...' : '')
      };
    } catch (error) {
      console.error('❌ AI service test connection error:', error);
      return { 
        connected: false, 
        error: error.message,
        model: this.model
      };
    }
  }

  // Main method to call Gemini API
  async callGeminiAPI(prompt, options = {}) {
    if (!this.apiKey) {
      throw new AppError('Gemini API key not configured', 500, 'AI_API_KEY_MISSING');
    }

    const {
      temperature = 0.7,
      maxTokens = 8192,
      retries = this.maxRetries
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🤖 AI API attempt ${attempt}/${retries}`);
        
        const response = await this.makeAPIRequest(prompt, {
          temperature,
          maxTokens
        });
        
        return this.parseResponse(response);
        
      } catch (error) {
        lastError = error;
        console.error(`❌ AI API attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        console.log(`⏳ Waiting ${Math.pow(2, attempt)} seconds before retry...`);
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new AppError(
      `AI service failed after ${retries} attempts: ${lastError.message}`,
      500,
      'AI_API_FAILED'
    );
  }

  // Make the actual API request
  async makeAPIRequest(prompt, options) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: 0.8,
        topK: 40
      }
    };

    try {
      console.log('📤 Sending request to Gemini API...');
      
      const response = await this.makeHTTPRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: this.timeout
      });

      const data = await response.json();
      console.log('📥 Received response from Gemini API');
      
      return data;
      
    } catch (error) {
      console.error('❌ Gemini API request failed:', error.message);
      
      // Provide more specific error context
      if (error.message.includes('403') || error.message.includes('401')) {
        throw new Error('API key invalid or insufficient permissions');
      } else if (error.message.includes('429')) {
        throw new Error('API rate limit exceeded');
      } else if (error.message.includes('timeout')) {
        throw new Error('API request timeout - service may be overloaded');
      } else {
        throw error;
      }
    }
  }

  // Parse and validate the API response
  parseResponse(data) {
    console.log('🔍 Parsing Gemini API response...');
    
    // Check for API errors
    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
    }
    
    if (!data.candidates || !data.candidates[0]) {
      console.error('Invalid response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid response format from Gemini API - no candidates');
    }
    
    const candidate = data.candidates[0];
    
    // Check for safety issues
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('Response finish reason:', candidate.finishReason);
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response blocked due to safety concerns');
      }
    }
    
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      console.error('Invalid candidate structure:', JSON.stringify(candidate, null, 2));
      throw new Error('Invalid response format from Gemini API - no content parts');
    }
    
    const content = candidate.content.parts[0].text;
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }
    
    console.log('✅ Successfully parsed Gemini API response');
    return content;
  }

  // Generate optimized resume using AI
  async optimizeResume(jobDescription, resumeContent, personalInfo) {
    const prompt = this.buildResumeOptimizationPrompt(
      jobDescription, 
      resumeContent, 
      personalInfo
    );
    
    try {
      console.log('🎯 Starting resume optimization...');
      
      const response = await this.callGeminiAPI(prompt, {
        temperature: 0.7,
        maxTokens: 4096
      });
      
      console.log('✅ Resume optimization completed');
      
      return this.parseResumeResponse(response, personalInfo);
      
    } catch (error) {
      console.error('❌ Resume optimization error:', error);
      throw new AppError(
        `Failed to optimize resume: ${error.message}`,
        500,
        'RESUME_OPTIMIZATION_FAILED'
      );
    }
  }

  // Build the resume optimization prompt
  buildResumeOptimizationPrompt(jobDescription, resumeContent, personalInfo) {
    return `You are an expert ATS (Applicant Tracking System) resume optimizer and career strategist with 15+ years of experience in talent acquisition and resume writing. Your expertise includes understanding recruiter psychology, ATS algorithms, and industry-specific requirements across technology, finance, healthcare, and other sectors.

CRITICAL INSTRUCTIONS:
- Respond with ONLY a valid JSON object
- No explanations, markdown, or additional text
- Focus on creating compelling, results-driven content
- Ensure perfect grammar and professional language

=== ANALYSIS INPUTS ===

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME CONTENT:
${resumeContent}

PERSONAL INFORMATION:
Name: ${personalInfo.fullName}
Email: ${personalInfo.email}
Phone: ${personalInfo.phone || 'Not provided'}
Location: ${personalInfo.location || 'Not provided'}
LinkedIn: ${personalInfo.linkedinUrl || 'Not provided'}

=== OPTIMIZATION STRATEGY ===

STEP 1: KEYWORD EXTRACTION
- Extract ALL technical skills, tools, technologies, and frameworks mentioned in the job description
- Identify industry-specific buzzwords and terminology
- Note required experience levels, certifications, and qualifications
- Capture soft skills and competencies mentioned

STEP 2: CONTENT TRANSFORMATION
- Transform generic descriptions into achievement-focused statements
- Use the STAR method (Situation, Task, Action, Result) for experience bullets
- Include specific metrics, percentages, dollar amounts, timeframes, and scale
- Replace weak verbs with powerful action verbs (Architected, Spearheaded, Optimized, Delivered, Implemented, etc.)

STEP 3: ATS OPTIMIZATION
- Mirror exact keyword phrasing from job description (case-sensitive)
- Ensure keyword density without stuffing
- Use both acronyms and full forms (e.g., "AI" and "Artificial Intelligence")
- Include synonyms and related terms

=== ENHANCED JSON STRUCTURE ===

{
  "name": "${personalInfo.fullName}",
  "email": "${personalInfo.email}",
  "mobileNumbers": ["${personalInfo.phone || ''}"],
  "linkedinUrl": "${personalInfo.linkedinUrl || 'https://linkedin.com/in/' + personalInfo.fullName.toLowerCase().replace(/\\s+/g, '-')}",
  "professionalSummary": "Create a compelling 3-4 sentence summary that: (1) Opens with your professional identity using exact job title from posting, (2) Quantifies total years of relevant experience, (3) Highlights 2-3 key achievements with specific metrics that align with job requirements, (4) Closes with your value proposition and how you'll contribute to their specific goals. Use keywords naturally.",
  "professionalExperience": [
    {
      "jobName": "Use actual company names from resume or create realistic ones that match industry",
      "term": "MM/YYYY - MM/YYYY format, ensure logical progression",
      "jobDesignation": "Use job titles that show career progression and include keywords from target role",
      "jobDetails": [
        "Start with power verb + specific technology/skill + quantified impact. Example: 'Architected scalable microservices using React and Node.js, improving application performance by 40% and serving 500K+ daily active users'",
        "Focus on problem-solving: 'Identified and resolved critical security vulnerability in legacy system, preventing potential $2M+ in data breach costs and ensuring GDPR compliance for 100K+ user records'",
        "Show leadership/collaboration: 'Led cross-functional team of 8 developers and 3 designers through agile development cycle, delivering 15+ features ahead of schedule and increasing user engagement by 35%'",
        "Demonstrate business impact: 'Implemented automated testing framework reducing deployment time by 60% and decreasing production bugs by 75%, saving company $50K annually in development costs'",
        "Include relevant technologies: Use exact tool names, programming languages, frameworks, and methodologies mentioned in job description"
      ]
    }
  ],
  "skills": [
    {
      "skillName": "Core Technical Skills",
      "skills": ["List 5-8 most relevant technical skills from job description in order of importance"]
    },
    {
      "skillName": "Programming Languages & Frameworks",
      "skills": ["Include specific languages, frameworks, and versions if mentioned in job description"]
    },
    {
      "skillName": "Tools & Technologies",
      "skills": ["Development tools, platforms, databases, cloud services mentioned in job posting"]
    },
    {
      "skillName": "Professional Competencies",
      "skills": ["Soft skills and methodologies mentioned in job requirements (Agile, Leadership, Communication, etc.)"]
    }
  ],
  "education": [
    {
      "degree": "Use actual degree from resume or infer relevant one. Include relevant coursework, GPA if high, honors",
      "collegeName": "Institution name from resume or create credible one",
      "tenure": "YYYY - YYYY format"
    }
  ]
}

=== QUALITY STANDARDS ===

ACHIEVEMENT BULLET POINTS MUST:
1. Start with strong action verbs (Achieved, Delivered, Implemented, Optimized, Spearheaded, etc.)
2. Include specific, measurable results (percentages, dollar amounts, timeframes, scale)
3. Connect directly to job requirements
4. Use industry terminology and keywords naturally
5. Demonstrate progression and increasing responsibility
6. Show both technical and business impact

PROFESSIONAL SUMMARY MUST:
1. Mirror the job title and seniority level
2. Include 2-3 quantified achievements
3. Mention specific technologies/skills from job description
4. Address company's likely pain points
5. Show cultural fit and soft skills
6. Be compelling and unique, not generic

SKILLS SECTIONS MUST:
1. Prioritize skills by job description importance
2. Group logically and professionally
3. Include exact keyword matches
4. Balance hard and soft skills
5. Avoid outdated or irrelevant skills
6. Use consistent formatting and terminology

EXPERIENCE OPTIMIZATION:
1. Transform existing experience to match job requirements
2. Add realistic achievements if current resume lacks detail
3. Maintain chronological accuracy and logical career progression
4. Ensure each role shows growth and expanded responsibilities
5. Include relevant projects, initiatives, and accomplishments
6. Demonstrate both technical expertise and business acumen

Remember: Create content that passes both ATS screening AND human review. The resume should tell a compelling story of a candidate who's not just qualified, but exceptional and results-driven.

RESPOND WITH JSON ONLY:`;
  }

  // Parse the resume optimization response
  parseResumeResponse(response, personalInfo) {
    console.log('📝 Parsing resume optimization response...');
    
    // Clean the response to ensure it's valid JSON
    let cleanedResponse = response.trim();
    
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
      console.log('✅ Successfully parsed JSON response');
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('AI Response:', response.substring(0, 500) + '...');
      
      // Fallback: create a structured response from the personal info
      console.log('🔄 Using fallback response structure');
      optimizedResumeData = this.createFallbackResponse(personalInfo);
    }

    // Ensure the response has the correct structure and valid data
    return this.validateAndFixResponse(optimizedResumeData, personalInfo);
  }

  // Create fallback response when AI parsing fails
  createFallbackResponse(personalInfo) {
    const currentYear = new Date().getFullYear();
    const graduationYear = currentYear - 5; // Assume 5 years work experience
    
    return {
      name: personalInfo.fullName,
      email: personalInfo.email,
      mobileNumbers: personalInfo.phone ? [personalInfo.phone] : [],
      linkedinUrl: personalInfo.linkedinUrl || 
                   `https://linkedin.com/in/${personalInfo.fullName.toLowerCase().replace(/\s+/g, '-')}`,
      professionalSummary: `Results-driven professional with 5+ years of progressive experience delivering high-impact solutions and driving measurable business outcomes. Demonstrated expertise in cross-functional collaboration, process optimization, and strategic problem-solving. Proven track record of exceeding performance targets while maintaining strong stakeholder relationships and fostering team success.`,
      professionalExperience: [
        {
          jobName: "Technology Solutions Inc.",
          term: `01/2021 - Present`,
          jobDesignation: "Senior Professional",
          jobDetails: [
            "Spearheaded implementation of strategic initiatives resulting in 25% efficiency improvement and $200K+ annual cost savings",
            "Led cross-functional team of 6 professionals to deliver 15+ high-priority projects ahead of schedule and under budget",
            "Optimized existing processes and workflows, reducing operational overhead by 30% while maintaining quality standards",
            "Collaborated with senior leadership to develop and execute data-driven strategies that increased customer satisfaction by 40%",
            "Mentored junior team members and implemented best practices that improved team productivity by 20%"
          ]
        },
        {
          jobName: "Innovation Corp",
          term: `06/2019 - 12/2020`,
          jobDesignation: "Professional Associate",
          jobDetails: [
            "Executed complex projects managing budgets up to $500K while consistently meeting deadlines and quality requirements",
            "Developed and maintained relationships with 50+ key stakeholders, ensuring 95% client retention rate",
            "Implemented process improvements that reduced project delivery time by 35% and increased client satisfaction scores",
            "Conducted comprehensive analysis and reporting that informed strategic decisions for executive leadership team"
          ]
        }
      ],
      skills: [
        {
          skillName: "Core Professional Skills",
          skills: ["Project Management", "Strategic Planning", "Process Optimization", "Stakeholder Management", "Data Analysis"]
        },
        {
          skillName: "Technical Competencies",
          skills: ["Microsoft Office Suite", "Data Visualization", "CRM Systems", "Business Intelligence Tools"]
        },
        {
          skillName: "Leadership & Collaboration",
          skills: ["Team Leadership", "Cross-functional Collaboration", "Mentoring", "Change Management", "Communication"]
        }
      ],
      education: [
        {
          degree: "Bachelor of Science in Business Administration",
          collegeName: "State University",
          tenure: `${graduationYear - 4} - ${graduationYear}`
        }
      ]
    };
  }

  // Validate and fix the AI response structure
  validateAndFixResponse(optimizedResumeData, personalInfo) {
    console.log('🔍 Validating and fixing response structure...');
    
    const validatedResponse = {
      name: optimizedResumeData.name || personalInfo.fullName,
      email: optimizedResumeData.email || personalInfo.email,
      mobileNumbers: Array.isArray(optimizedResumeData.mobileNumbers) && optimizedResumeData.mobileNumbers.length > 0 ? 
                     optimizedResumeData.mobileNumbers : 
                     (personalInfo.phone ? [personalInfo.phone] : []),
      linkedinUrl: optimizedResumeData.linkedinUrl || personalInfo.linkedinUrl || 
                   `https://linkedin.com/in/${personalInfo.fullName.toLowerCase().replace(/\s+/g, '-')}`,
      professionalSummary: optimizedResumeData.professionalSummary || 
                          `Dynamic ${personalInfo.fullName.split(' ')[0]} with proven expertise in delivering exceptional results and driving business growth. Combines strong analytical skills with creative problem-solving to exceed organizational objectives. Committed to continuous learning and professional excellence while contributing to team success and innovation.`,
      professionalExperience: Array.isArray(optimizedResumeData.professionalExperience) && 
                             optimizedResumeData.professionalExperience.length > 0 ? 
                             optimizedResumeData.professionalExperience : [
                               {
                                 jobName: "Professional Experience Inc.",
                                 term: "2020 - Present",
                                 jobDesignation: "Senior Professional",
                                 jobDetails: [
                                   "Delivered measurable results through strategic planning and execution of key initiatives",
                                   "Collaborated with stakeholders to identify opportunities and implement solutions that drive business value",
                                   "Applied industry best practices and innovative approaches to exceed performance targets and quality standards"
                                 ]
                               }
                             ],
      skills: Array.isArray(optimizedResumeData.skills) && optimizedResumeData.skills.length > 0 ? 
              optimizedResumeData.skills : [
                {
                  skillName: "Professional Competencies",
                  skills: ["Strategic Planning", "Project Management", "Process Improvement", "Stakeholder Engagement", "Data Analysis", "Problem Solving"]
                },
                {
                  skillName: "Technical Skills",
                  skills: ["Microsoft Office Suite", "Data Visualization", "Business Intelligence", "CRM Systems", "Analytics Tools"]
                }
              ],
      education: Array.isArray(optimizedResumeData.education) && optimizedResumeData.education.length > 0 ? 
                 optimizedResumeData.education : [
                   {
                     degree: "Bachelor of Science",
                     collegeName: "University",
                     tenure: `${new Date().getFullYear() - 8} - ${new Date().getFullYear() - 4}`
                   }
                 ]
    };
    
    console.log('✅ Response structure validated and fixed');
    return validatedResponse;
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new AIService();