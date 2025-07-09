#!/usr/bin/env node

/**
 * Test Fix Script
 * Tests the AI service fix and provides diagnostic information
 */

const { testHttpClient, getClientType } = require('../src/utils/httpClient');
const aiService = require('../src/services/aiService');
const config = require('../src/config/config');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function runTests() {
  console.log(colorize('🔧 Testing AI Service Fix', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  
  // Test 1: HTTP Client
  console.log('\n📡 Testing HTTP Client...');
  try {
    const httpWorks = await testHttpClient();
    const clientType = getClientType();
    
    if (httpWorks) {
      console.log(colorize(`✅ HTTP Client Working (${clientType})`, 'green'));
    } else {
      console.log(colorize(`❌ HTTP Client Failed (${clientType})`, 'red'));
    }
  } catch (error) {
    console.log(colorize(`❌ HTTP Client Error: ${error.message}`, 'red'));
  }
  
  // Test 2: Configuration
  console.log('\n⚙️  Testing Configuration...');
  console.log(`🔑 Gemini API Key: ${config.GEMINI_API_KEY ? colorize('Configured', 'green') : colorize('Missing', 'red')}`);
  console.log(`🤖 Gemini Model: ${colorize(config.GEMINI_MODEL, 'blue')}`);
  console.log(`⏱️  Timeout: ${colorize(config.AI_RESPONSE_TIMEOUT + 'ms', 'blue')}`);
  
  // Test 3: AI Service Connection
  console.log('\n🤖 Testing AI Service...');
  try {
    const result = await aiService.testConnection();
    
    if (result.connected) {
      console.log(colorize(`✅ AI Service Connected`, 'green'));
      console.log(`📝 Test Response: ${colorize(result.testResponse, 'blue')}`);
    } else {
      console.log(colorize(`❌ AI Service Failed: ${result.error}`, 'red'));
    }
  } catch (error) {
    console.log(colorize(`❌ AI Service Error: ${error.message}`, 'red'));
  }
  
  // Test 4: Sample AI Request
  if (config.GEMINI_API_KEY) {
    console.log('\n🧪 Testing Sample AI Request...');
    try {
      const samplePersonalInfo = {
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '+1 (555) 123-4567',
        location: 'Test City'
      };
      
      const sampleJobDescription = 'We are looking for a software developer with JavaScript experience.';
      const sampleResumeContent = 'Test User - Software Developer with 5 years of experience in JavaScript.';
      
      console.log('🔄 Making AI optimization request...');
      const result = await aiService.optimizeResume(
        sampleJobDescription,
        sampleResumeContent,
        samplePersonalInfo
      );
      
      if (result && result.name) {
        console.log(colorize(`✅ AI Optimization Successful`, 'green'));
        console.log(`👤 Generated Name: ${colorize(result.name, 'blue')}`);
        console.log(`📧 Generated Email: ${colorize(result.email, 'blue')}`);
        console.log(`📝 Summary Length: ${colorize(result.professionalSummary?.length || 0, 'blue')} chars`);
      } else {
        console.log(colorize(`❌ AI Optimization Failed: Invalid response format`, 'red'));
      }
    } catch (error) {
      console.log(colorize(`❌ AI Optimization Error: ${error.message}`, 'red'));
    }
  } else {
    console.log(colorize('\n⚠️  Skipping AI request test - no API key configured', 'yellow'));
  }
  
  // Summary
  console.log('\n' + colorize('📊 Test Summary', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  
  if (config.GEMINI_API_KEY) {
    console.log(colorize('🎉 All tests completed! Check results above.', 'green'));
    console.log('\n💡 If AI service is working, the health endpoint should now show status: "OK"');
    console.log('💡 Try visiting: http://localhost:3000/api/health');
  } else {
    console.log(colorize('⚠️  Add GEMINI_API_KEY to .env file to test AI functionality', 'yellow'));
  }
  
  console.log('\n🔗 Complete API URLs available in: API_URLS.md');
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('Unhandled Rejection:', 'red'), reason);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error(colorize('Test script failed:', 'red'), error.message);
  process.exit(1);
});