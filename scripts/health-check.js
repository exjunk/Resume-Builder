#!/usr/bin/env node

/**
 * Health Check Script
 * Performs comprehensive system health checks
 */

const fetch = require('node-fetch');
const config = require('../src/config/config');

// Configuration
const BASE_URL = `http://localhost:${config.PORT}`;
const TIMEOUT = 10000; // 10 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function checkEndpoint(path, expectedStatus = 200, timeout = TIMEOUT) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Health-Check-Script/1.0'
      }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    clearTimeout(timeoutId);

    const result = {
      url,
      status: response.status,
      expectedStatus,
      responseTime,
      success: response.status === expectedStatus,
      size: response.headers.get('content-length') || 'unknown'
    };

    // Try to parse JSON response for additional info
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result.data = await response.json();
      }
    } catch (error) {
      // Not JSON or parsing failed, ignore
    }

    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    
    return {
      url,
      status: 'ERROR',
      expectedStatus,
      success: false,
      error: error.message,
      responseTime: timeout
    };
  }
}

async function performHealthChecks() {
  console.log(colorize('🏥 ATS Resume Optimizer - Health Check', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`⏱️  Timeout: ${TIMEOUT}ms`);
  console.log(`🕐 Started at: ${new Date().toISOString()}\n`);

  const checks = [
    // Basic endpoints
    { path: '/', name: 'Frontend Application', expectedStatus: 200 },
    { path: '/api/health', name: 'Health Check API', expectedStatus: 200 },
    
    // Health endpoints
    { path: '/api/health/database', name: 'Database Health', expectedStatus: 200 },
    { path: '/api/health/ai', name: 'AI Service Health', expectedStatus: [200, 503] },
    { path: '/api/health/system', name: 'System Information', expectedStatus: 200 },
    { path: '/api/health/ready', name: 'Readiness Probe', expectedStatus: 200 },
    { path: '/api/health/live', name: 'Liveness Probe', expectedStatus: 200 },
    
    // Auth endpoints (should return errors without credentials)
    { path: '/api/auth/me', name: 'Auth Middleware', expectedStatus: 401 },
    { path: '/api/profiles', name: 'Profiles API', expectedStatus: 401 },
    { path: '/api/templates', name: 'Templates API', expectedStatus: 401 },
    { path: '/api/resumes', name: 'Resumes API', expectedStatus: 401 },
    
    // 404 handling
    { path: '/api/nonexistent', name: '404 Handling', expectedStatus: 404 }
  ];

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    process.stdout.write(`🔍 ${check.name.padEnd(25)} ... `);
    
    const result = await checkEndpoint(check.path, check.expectedStatus);
    
    // Handle multiple expected status codes
    const expectedStatuses = Array.isArray(check.expectedStatus) 
      ? check.expectedStatus 
      : [check.expectedStatus];
    
    const statusMatch = expectedStatuses.includes(result.status);
    
    if (statusMatch && result.status !== 'ERROR') {
      console.log(colorize(`✅ PASS (${result.status}) ${result.responseTime}ms`, 'green'));
      passed++;
    } else {
      console.log(colorize(`❌ FAIL (${result.status}) ${result.error || ''}`, 'red'));
      failed++;
    }

    results.push({
      ...check,
      ...result,
      passed: statusMatch && result.status !== 'ERROR'
    });
  }

  // Summary
  console.log('\n' + colorize('📊 Health Check Summary', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  console.log(`✅ Passed: ${colorize(passed.toString(), 'green')}`);
  console.log(`❌ Failed: ${colorize(failed.toString(), 'red')}`);
  console.log(`📈 Success Rate: ${colorize(Math.round((passed / (passed + failed)) * 100) + '%', passed === checks.length ? 'green' : 'yellow')}`);

  // Detailed results
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log('\n' + colorize('📋 Detailed Results', 'cyan'));
    console.log(colorize('=' .repeat(50), 'cyan'));
    
    results.forEach(result => {
      console.log(`\n🔍 ${result.name}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Status: ${result.status} (expected: ${result.expectedStatus})`);
      console.log(`   Response Time: ${result.responseTime}ms`);
      console.log(`   Success: ${result.passed ? '✅' : '❌'}`);
      
      if (result.data) {
        console.log(`   Data: ${JSON.stringify(result.data, null, 4)}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
  }

  // System information
  if (process.argv.includes('--system') || process.argv.includes('-s')) {
    const systemCheck = results.find(r => r.name === 'System Information');
    if (systemCheck && systemCheck.data) {
      console.log('\n' + colorize('💻 System Information', 'cyan'));
      console.log(colorize('=' .repeat(50), 'cyan'));
      console.log(JSON.stringify(systemCheck.data.system, null, 2));
    }
  }

  // Exit with appropriate code
  if (failed === 0) {
    console.log('\n' + colorize('🎉 All health checks passed!', 'green'));
    process.exit(0);
  } else {
    console.log('\n' + colorize('⚠️  Some health checks failed!', 'yellow'));
    process.exit(1);
  }
}

// Performance test
async function performanceTest() {
  console.log(colorize('🚀 Performance Test', 'magenta'));
  console.log(colorize('=' .repeat(50), 'magenta'));
  
  const endpoint = '/api/health';
  const iterations = 10;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    process.stdout.write(`📊 Request ${(i + 1).toString().padStart(2)} / ${iterations} ... `);
    
    const result = await checkEndpoint(endpoint);
    results.push(result.responseTime);
    
    console.log(`${result.responseTime}ms`);
  }

  const avgTime = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
  const minTime = Math.min(...results);
  const maxTime = Math.max(...results);

  console.log(`\n📈 Performance Summary:`);
  console.log(`   Average: ${avgTime}ms`);
  console.log(`   Minimum: ${minTime}ms`);
  console.log(`   Maximum: ${maxTime}ms`);
  console.log(`   Total Requests: ${iterations}`);
}

// Help text
function showHelp() {
  console.log(`
🏥 Health Check Script Help
=====================================

Usage: npm run health [options]

Options:
  --verbose, -v   Show detailed results
  --system, -s    Show system information
  --perf, -p      Run performance test
  --help, -h      Show this help message

Examples:
  npm run health                    # Basic health check
  npm run health --verbose          # Detailed health check
  npm run health --system           # Include system info
  npm run health --perf             # Run performance test

The script checks all major endpoints and reports their status.
Exit code 0 means all checks passed, exit code 1 means some failed.
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  try {
    await performHealthChecks();
    
    if (args.includes('--perf') || args.includes('-p')) {
      console.log('\n');
      await performanceTest();
    }
    
  } catch (error) {
    console.error(colorize('\n❌ Health check script failed:', 'red'), error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('Unhandled Rejection at:', 'red'), promise, colorize('reason:', 'red'), reason);
  process.exit(1);
});

// Run the script
main();