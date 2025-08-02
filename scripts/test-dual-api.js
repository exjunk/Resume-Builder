const https = require('https');

// Test configuration
const config = {
  baseUrl: 'http://localhost:3000',
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY
};

// Test data
const testData = {
  jobDescription: `We are seeking a Senior Full Stack Developer to join our growing team. 

Required Skills:
- 5+ years of experience in full-stack development
- Proficiency in JavaScript, React, Node.js
- Experience with databases (PostgreSQL, MongoDB)
- Knowledge of cloud platforms (AWS, Azure)
- Strong problem-solving skills
- Experience with Agile methodologies

Responsibilities:
- Develop and maintain web applications
- Collaborate with cross-functional teams
- Mentor junior developers
- Participate in code reviews
- Optimize application performance`,

  personalInfo: {
    fullName: "John Doe",
    email: "john.doe@example.com",
    phone: "+1-555-123-4567",
    location: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/johndoe"
  },

  resumeContent: `John Doe
john.doe@example.com | +1-555-123-4567 | San Francisco, CA

PROFESSIONAL SUMMARY
Experienced software developer with 5+ years in full-stack development.

EXPERIENCE
Software Developer | TechCorp | 2020 - Present
- Developed web applications using React and Node.js
- Collaborated with cross-functional teams
- Participated in code reviews

EDUCATION
Bachelor of Science in Computer Science | University of California | 2016 - 2020`
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Test AI service health
async function testAIHealth() {
  console.log('🔍 Testing AI service health...');
  
  try {
    const response = await makeRequest(`${config.baseUrl}/api/health/ai`);
    
    if (response.status === 200) {
      console.log('✅ AI Health Check:', response.data);
      return response.data;
    } else {
      console.log('❌ AI Health Check failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing AI health:', error.message);
    return null;
  }
}

// Test Gemini API
async function testGeminiAPI() {
  console.log('🔷 Testing Gemini API...');
  
  if (!config.geminiApiKey) {
    console.log('⚠️  Gemini API key not configured');
    return null;
  }

  try {
    const response = await makeRequest(`${config.baseUrl}/api/resumes/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobDescription: testData.jobDescription,
        resumeText: testData.resumeContent,
        personalInfo: testData.personalInfo,
        aiProvider: 'gemini'
      })
    });

    if (response.status === 200) {
      console.log('✅ Gemini API test successful');
      return response.data;
    } else {
      console.log('❌ Gemini API test failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing Gemini API:', error.message);
    return null;
  }
}

// Test OpenAI API
async function testOpenAIAPI() {
  console.log('🔶 Testing OpenAI API...');
  
  if (!config.openaiApiKey) {
    console.log('⚠️  OpenAI API key not configured');
    return null;
  }

  try {
    const response = await makeRequest(`${config.baseUrl}/api/resumes/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobDescription: testData.jobDescription,
        resumeText: testData.resumeContent,
        personalInfo: testData.personalInfo,
        aiProvider: 'openai'
      })
    });

    if (response.status === 200) {
      console.log('✅ OpenAI API test successful');
      return response.data;
    } else {
      console.log('❌ OpenAI API test failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing OpenAI API:', error.message);
    return null;
  }
}

// Test dual API
async function testDualAPI() {
  console.log('🔄 Testing Dual API...');
  
  try {
    const response = await makeRequest(`${config.baseUrl}/api/resumes/optimize-dual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobDescription: testData.jobDescription,
        resumeText: testData.resumeContent,
        personalInfo: testData.personalInfo
      })
    });

    if (response.status === 200) {
      console.log('✅ Dual API test successful');
      return response.data;
    } else {
      console.log('❌ Dual API test failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing Dual API:', error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Dual API Tests...\n');

  // Test AI health
  const healthData = await testAIHealth();
  
  if (healthData) {
    console.log('\n📊 AI Service Status:');
    if (healthData.gemini) {
      console.log(`🔷 Gemini: ${healthData.gemini.status} (${healthData.gemini.model})`);
    }
    if (healthData.openai) {
      console.log(`🔶 OpenAI: ${healthData.openai.status} (${healthData.openai.model})`);
    }
  }

  console.log('\n' + '='.repeat(50));

  // Test individual APIs
  const geminiResult = await testGeminiAPI();
  const openaiResult = await testOpenAIAPI();
  const dualResult = await testDualAPI();

  console.log('\n' + '='.repeat(50));
  console.log('📋 Test Results Summary:');
  console.log(`🔷 Gemini API: ${geminiResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔶 OpenAI API: ${openaiResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔄 Dual API: ${dualResult ? '✅ PASS' : '❌ FAIL'}`);

  if (dualResult && dualResult.optimizedResumeData) {
    console.log('\n📊 Dual API Results:');
    console.log(`🔷 Gemini available: ${dualResult.optimizedResumeData.gemini ? 'Yes' : 'No'}`);
    console.log(`🔶 OpenAI available: ${dualResult.optimizedResumeData.openai ? 'Yes' : 'No'}`);
    
    if (dualResult.optimizedResumeData.geminiError) {
      console.log(`🔷 Gemini error: ${dualResult.optimizedResumeData.geminiError}`);
    }
    if (dualResult.optimizedResumeData.openaiError) {
      console.log(`🔶 OpenAI error: ${dualResult.optimizedResumeData.openaiError}`);
    }
  }

  console.log('\n✅ Tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testAIHealth,
  testGeminiAPI,
  testOpenAIAPI,
  testDualAPI,
  runTests
}; 