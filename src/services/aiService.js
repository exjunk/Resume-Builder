const config = require('../config/config');
const { AppError } = require('../middleware/errorHandler');
const https = require('https');
const { URL } = require('url');

class AIService {
  constructor() {
    this.geminiApiKey = config.GEMINI_API_KEY;
    this.geminiModel = config.GEMINI_MODEL;
    this.geminiBaseUrl = config.GEMINI_API_URL;
    this.openaiApiKey = config.OPENAI_API_KEY;
    this.openaiModel = config.OPENAI_MODEL;
    this.openaiBaseUrl = config.OPENAI_API_URL;
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

  // Test API connections
  async testConnections() {
    const results = {
      gemini: await this.testGeminiConnection(),
      openai: await this.testOpenAIConnection()
    };
    
    return results;
  }

  // Test Gemini API connection
  async testGeminiConnection() {
    if (!this.geminiApiKey) {
      return { 
        connected: false, 
        error: 'Gemini API key not configured',
        model: this.geminiModel
      };
    }

    try {
      console.log('🔍 Testing Gemini API connection...');
      
      const testPrompt = "Hello, this is a test. Please respond with 'Gemini API is working!'";
      
      const url = `${this.geminiBaseUrl}/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
      
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
        model: this.geminiModel,
        testResponse: testResponse.substring(0, 100) + (testResponse.length > 100 ? '...' : '')
      };
    } catch (error) {
      console.error('❌ Gemini API test connection error:', error);
      return { 
        connected: false, 
        error: error.message,
        model: this.geminiModel
      };
    }
  }

  // Test OpenAI API connection
  async testOpenAIConnection() {
    if (!this.openaiApiKey) {
      return { 
        connected: false, 
        error: 'OpenAI API key not configured',
        model: this.openaiModel
      };
    }

    try {
      console.log('🔍 Testing OpenAI API connection...');
      
      const testPrompt = "Hello, this is a test. Please respond with 'OpenAI API is working!'";
      
      const payload = {
        model: this.openaiModel,
        messages: [
          {
            role: "user",
            content: testPrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      };

      const response = await this.makeHTTPRequest(this.openaiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      const data = await response.json();
      const testResponse = data.choices?.[0]?.message?.content || 'Test completed';
      
      console.log('✅ OpenAI API connection test successful');
      
      return { 
        connected: true, 
        model: this.openaiModel,
        testResponse: testResponse.substring(0, 100) + (testResponse.length > 100 ? '...' : '')
      };
    } catch (error) {
      console.error('❌ OpenAI API test connection error:', error);
      return { 
        connected: false, 
        error: error.message,
        model: this.openaiModel
      };
    }
  }

  // Main method to call Gemini API
  async callGeminiAPI(prompt, options = {}) {
    if (!this.geminiApiKey) {
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
        console.log(`🤖 Gemini API attempt ${attempt}/${retries}`);
        
        const response = await this.makeGeminiAPIRequest(prompt, {
          temperature,
          maxTokens
        });
        
        return this.parseGeminiResponse(response);
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Gemini API attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        console.log(`⏳ Waiting ${Math.pow(2, attempt)} seconds before retry...`);
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new AppError(
      `Gemini API failed after ${retries} attempts: ${lastError.message}`,
      500,
      'AI_API_FAILED'
    );
  }

  // Main method to call OpenAI API
  async callOpenAIAPI(prompt, options = {}) {
    if (!this.openaiApiKey) {
      throw new AppError('OpenAI API key not configured', 500, 'AI_API_KEY_MISSING');
    }

    const {
      temperature = 0.7,
      maxTokens = 4096,
      retries = this.maxRetries
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🤖 OpenAI API attempt ${attempt}/${retries}`);
        
        const response = await this.makeOpenAIAPIRequest(prompt, {
          temperature,
          maxTokens
        });
        
        return this.parseOpenAIResponse(response);
        
      } catch (error) {
        lastError = error;
        console.error(`❌ OpenAI API attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        console.log(`⏳ Waiting ${Math.pow(2, attempt)} seconds before retry...`);
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw new AppError(
      `OpenAI API failed after ${retries} attempts: ${lastError.message}`,
      500,
      'AI_API_FAILED'
    );
  }

  // Make the actual Gemini API request
  async makeGeminiAPIRequest(prompt, options) {
    const url = `${this.geminiBaseUrl}/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
    
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

  // Make the actual OpenAI API request
  async makeOpenAIAPIRequest(prompt, options) {
    const payload = {
      model: this.openaiModel,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: 0.8
    };

    try {
      console.log('📤 Sending request to OpenAI API...');
      
      const response = await this.makeHTTPRequest(this.openaiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify(payload),
        timeout: this.timeout
      });

      const data = await response.json();
      console.log('📥 Received response from OpenAI API');
      
      return data;
      
    } catch (error) {
      console.error('❌ OpenAI API request failed:', error.message);
      
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

  // Parse and validate the Gemini API response
  parseGeminiResponse(data) {
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

  // Parse and validate the OpenAI API response
  parseOpenAIResponse(data) {
    console.log('🔍 Parsing OpenAI API response...');
    
    // Check for API errors
    if (data.error) {
      throw new Error(`OpenAI API error: ${data.error.message || 'Unknown error'}`);
    }
    
    if (!data.choices || !data.choices[0]) {
      console.error('Invalid response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid response format from OpenAI API - no choices');
    }
    
    const choice = data.choices[0];
    
    if (!choice.message || !choice.message.content) {
      console.error('Invalid choice structure:', JSON.stringify(choice, null, 2));
      throw new Error('Invalid response format from OpenAI API - no message content');
    }
    
    const content = choice.message.content;
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from OpenAI API');
    }
    
    console.log('✅ Successfully parsed OpenAI API response');
    return content;
  }

  // Generate optimized resume using Gemini AI
  async optimizeResumeWithGemini(jobDescription, resumeContent, personalInfo) {
    const prompt = this.buildResumeOptimizationPrompt(
      jobDescription, 
      resumeContent, 
      personalInfo
    );
    
    try {
      console.log('🎯 Starting resume optimization with Gemini...');
      
      const response = await this.callGeminiAPI(prompt, {
        temperature: 0.7,
        maxTokens: 4096
      });
      
      console.log('✅ Resume optimization with Gemini completed');
      
      return this.parseResumeResponse(response, personalInfo);
      
    } catch (error) {
      console.error('❌ Gemini resume optimization error:', error);
      throw new AppError(
        `Failed to optimize resume with Gemini: ${error.message}`,
        500,
        'RESUME_OPTIMIZATION_FAILED'
      );
    }
  }

  // Generate optimized resume using OpenAI
  async optimizeResumeWithOpenAI(jobDescription, resumeContent, personalInfo) {
    const prompt = this.buildResumeOptimizationPrompt(
      jobDescription, 
      resumeContent, 
      personalInfo
    );
    
    try {
      console.log('🎯 Starting resume optimization with OpenAI...');
      
      const response = await this.callOpenAIAPI(prompt, {
        temperature: 0.7,
        maxTokens: 4096
      });
      
      console.log('✅ Resume optimization with OpenAI completed');
      
      return this.parseResumeResponse(response, personalInfo);
      
    } catch (error) {
      console.error('❌ OpenAI resume optimization error:', error);
      throw new AppError(
        `Failed to optimize resume with OpenAI: ${error.message}`,
        500,
        'RESUME_OPTIMIZATION_FAILED'
      );
    }
  }

  // Generate optimized resume using both APIs
  async optimizeResumeWithBoth(jobDescription, resumeContent, personalInfo) {
    try {
      console.log('🎯 Starting resume optimization with both APIs...');
      
      const [geminiResult, openaiResult] = await Promise.allSettled([
        this.optimizeResumeWithGemini(jobDescription, resumeContent, personalInfo),
        this.optimizeResumeWithOpenAI(jobDescription, resumeContent, personalInfo)
      ]);
      
      const results = {
        gemini: geminiResult.status === 'fulfilled' ? geminiResult.value : null,
        openai: openaiResult.status === 'fulfilled' ? openaiResult.value : null,
        geminiError: geminiResult.status === 'rejected' ? geminiResult.reason.message : null,
        openaiError: openaiResult.status === 'rejected' ? openaiResult.reason.message : null
      };
      
      console.log('✅ Resume optimization with both APIs completed');
      
      return results;
      
    } catch (error) {
      console.error('❌ Dual API resume optimization error:', error);
      throw new AppError(
        `Failed to optimize resume with both APIs: ${error.message}`,
        500,
        'RESUME_OPTIMIZATION_FAILED'
      );
    }
  }

  // Build the resume optimization prompt
  buildResumeOptimizationPrompt(jobDescription, resumeContent, personalInfo) {
    return `You are an expert ATS (Applicant Tracking System) resume optimizer. Your task is to analyze the provided resume and job description, then create an optimized resume in a specific JSON format.

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any explanations, markdown, or text outside the JSON structure.

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

Analyze the job description and optimize the resume content to match the requirements. Return a JSON object with this exact structure:

{
  "name": "${personalInfo.fullName}",
  "email": "${personalInfo.email}",
  "mobileNumbers": ["${personalInfo.phone || ''}"],
  "linkedinUrl": "${personalInfo.linkedinUrl || 'https://linkedin.com/in/' + personalInfo.fullName.toLowerCase().replace(/\\s+/g, '-')}",
  "professionalSummary": "2-3 sentence ATS-optimized professional summary tailored to the job",
  "professionalExperience": [
    {
      "jobName": "Company Name",
      "term": "Start Date - End Date",
      "jobDesignation": "Job Title",
      "jobDetails": [
        "Achievement 1 with quantified results that matches job requirements",
        "Achievement 2 with quantified results that matches job requirements",
        "Achievement 3 with quantified results that matches job requirements"
      ]
    }
  ],
  "skills": [
    {
      "skillName": "Technical Skills",
      "skills": ["skill1 from job description", "skill2 from job description", "skill3 from job description"]
    },
    {
      "skillName": "Programming Languages",
      "skills": ["language1 if relevant", "language2 if relevant"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name (infer from current resume or make relevant to job)",
      "collegeName": "Institution Name",
      "tenure": "Start Year - End Year"
    }
  ]
}

Focus on:
1. Including EXACT keywords from the job description
2. Quantifying achievements with numbers/percentages where possible
3. Using action verbs and industry terminology from the job posting
4. Making skills highly relevant to the job requirements
5. Ensuring the professional summary directly addresses the role requirements
6. Organizing experience in reverse chronological order
7. If current resume lacks detail, intelligently enhance it based on job requirements

Respond with ONLY the JSON object, nothing else.`;
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
    return {
      name: personalInfo.fullName,
      email: personalInfo.email,
      mobileNumbers: personalInfo.phone ? [personalInfo.phone] : [],
      linkedinUrl: personalInfo.linkedinUrl || 
                   `https://linkedin.com/in/${personalInfo.fullName.toLowerCase().replace(/\s+/g, '-')}`,
      professionalSummary: "Experienced professional with strong background and proven track record of success. Seeking to leverage skills and experience in a challenging new role.",
      professionalExperience: [
        {
          jobName: "Previous Company",
          term: "2020 - Present",
          jobDesignation: "Professional Role",
          jobDetails: [
            "Delivered high-quality results and exceeded performance expectations",
            "Collaborated effectively with cross-functional teams",
            "Contributed to organizational success through innovative solutions"
          ]
        }
      ],
      skills: [
        {
          skillName: "Core Skills",
          skills: ["Communication", "Problem Solving", "Team Collaboration"]
        }
      ],
      education: [
        {
          degree: "Bachelor's Degree",
          collegeName: "University",
          tenure: "2016 - 2020"
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
                          "Professional seeking new opportunities to contribute skills and experience.",
      professionalExperience: Array.isArray(optimizedResumeData.professionalExperience) && 
                             optimizedResumeData.professionalExperience.length > 0 ? 
                             optimizedResumeData.professionalExperience : [
                               {
                                 jobName: "Previous Experience",
                                 term: "Recent",
                                 jobDesignation: "Professional Role",
                                 jobDetails: ["Relevant experience to be detailed based on job requirements"]
                               }
                             ],
      skills: Array.isArray(optimizedResumeData.skills) && optimizedResumeData.skills.length > 0 ? 
              optimizedResumeData.skills : [
                {
                  skillName: "Core Skills",
                  skills: ["Professional Skills", "Communication", "Problem Solving"]
                }
              ],
      education: Array.isArray(optimizedResumeData.education) && optimizedResumeData.education.length > 0 ? 
                 optimizedResumeData.education : [
                   {
                     degree: "Education Background",
                     collegeName: "Institution",
                     tenure: "Years"
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