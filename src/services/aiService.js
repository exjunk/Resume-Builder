const config = require('../config/config');
const { AppError } = require('../middleware/errorHandler');
const fetch = require('node-fetch');

class AIService {
  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL;
    this.baseUrl = config.GEMINI_API_URL;
    this.timeout = config.AI_RESPONSE_TIMEOUT;
    this.maxRetries = config.AI_MAX_RETRIES;
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
        console.log(`AI API attempt ${attempt}/${retries}`);
        
        const response = await this.makeAPIRequest(prompt, {
          temperature,
          maxTokens
        });
        
        return this.parseResponse(response);
        
      } catch (error) {
        lastError = error;
        console.error(`AI API attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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

      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  // Parse and validate the API response
  parseResponse(data) {
    if (!data.candidates || !data.candidates[0] || 
        !data.candidates[0].content || !data.candidates[0].content.parts || 
        !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    const content = data.candidates[0].content.parts[0].text;
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }
    
    return content;
  }

  // Test API connectivity
  async testConnection() {
    if (!this.apiKey) {
      return { 
        connected: false, 
        error: 'API key not configured',
        model: this.model
      };
    }

    try {
      const testPrompt = "Hello, this is a test. Please respond with 'API is working!'";
      const response = await this.callGeminiAPI(testPrompt, { retries: 1 });
      
      return { 
        connected: true, 
        model: this.model,
        testResponse: response.substring(0, 100) + (response.length > 100 ? '...' : '')
      };
    } catch (error) {
      return { 
        connected: false, 
        error: error.message,
        model: this.model
      };
    }
  }

  // Generate optimized resume using AI
  async optimizeResume(jobDescription, resumeContent, personalInfo) {
    const prompt = this.buildResumeOptimizationPrompt(
      jobDescription, 
      resumeContent, 
      personalInfo
    );
    
    try {
      const response = await this.callGeminiAPI(prompt, {
        temperature: 0.7,
        maxTokens: 4096
      });
      
      return this.parseResumeResponse(response, personalInfo);
      
    } catch (error) {
      console.error('Resume optimization error:', error);
      throw new AppError(
        `Failed to optimize resume: ${error.message}`,
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
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('AI Response:', response);
      
      // Fallback: create a structured response from the personal info
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
    return {
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
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new AIService();