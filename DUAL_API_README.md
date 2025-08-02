# Dual API Resume Builder - Gemini & OpenAI Integration

This enhanced resume builder now supports both **Google Gemini AI** and **OpenAI GPT** APIs, allowing users to generate optimized resumes using either or both AI providers simultaneously.

## 🚀 Features

### Dual AI Support
- **Gemini AI**: Google's advanced language model for resume optimization
- **OpenAI GPT**: OpenAI's GPT models for alternative resume generation
- **Side-by-side Comparison**: Compare results from both AI providers
- **Fallback Support**: If one API fails, the other continues to work

### Enhanced UI
- **AI Provider Selection**: Choose between Gemini, OpenAI, or both
- **Tabbed Interface**: Separate tabs for Gemini and OpenAI versions
- **Comparison View**: Side-by-side comparison of both AI results
- **Real-time Status**: Live status indicators for each AI service

### Advanced Functionality
- **Parallel Processing**: Both APIs run simultaneously when selected
- **Error Handling**: Graceful handling of API failures
- **Health Monitoring**: Comprehensive health checks for both services
- **Export Options**: Export individual or comparison versions to PDF

## 🛠️ Setup

### Environment Variables

Add these to your `.env` file:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
```

### API Keys

1. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

## 📡 API Endpoints

### Health Check Endpoints

```bash
# Overall AI health
GET /api/health/ai

# Individual AI health
GET /api/health/ai/gemini
GET /api/health/ai/openai

# System health
GET /api/health
```

### Resume Optimization Endpoints

```bash
# Single AI provider
POST /api/resumes/optimize
{
  "jobDescription": "...",
  "resumeText": "...",
  "personalInfo": {...},
  "aiProvider": "gemini" | "openai"
}

# Dual AI providers
POST /api/resumes/optimize-dual
{
  "jobDescription": "...",
  "resumeText": "...",
  "personalInfo": {...}
}
```

## 🎯 Usage

### 1. AI Provider Selection

When generating a resume, users can choose from three options:

- **🔷 Gemini AI**: Uses Google's Gemini model
- **🔶 OpenAI GPT**: Uses OpenAI's GPT model  
- **🔄 Both APIs**: Runs both simultaneously for comparison

### 2. Resume Generation

1. Select a profile and template
2. Enter job description and details
3. Choose AI provider(s)
4. Click "Generate Optimized Resume"
5. View results in the appropriate tab

### 3. Comparison View

When using "Both APIs":
- **Gemini Version Tab**: Shows Gemini-optimized resume
- **OpenAI Version Tab**: Shows OpenAI-optimized resume
- **Comparison Tab**: Side-by-side comparison of both versions

### 4. Export Options

- **PDF Export**: Export the currently selected version
- **JSON Export**: Export structured data
- **Template Save**: Save as reusable template

## 🔧 Technical Implementation

### AI Service Architecture

```javascript
// Enhanced AI Service with dual support
class AIService {
  // Gemini methods
  async optimizeResumeWithGemini(jobDescription, resumeContent, personalInfo)
  async testGeminiConnection()
  
  // OpenAI methods  
  async optimizeResumeWithOpenAI(jobDescription, resumeContent, personalInfo)
  async testOpenAIConnection()
  
  // Dual methods
  async optimizeResumeWithBoth(jobDescription, resumeContent, personalInfo)
  async testConnections()
}
```

### Frontend Components

```javascript
// AI Provider Selection
function switchAIProvider(provider) // 'gemini', 'openai', 'both'

// Resume Tab Management
function switchResumeTab(tab) // 'gemini', 'openai', 'comparison'

// Dual Data Handling
function populateDualResumeForm(data) // Handles both AI results
function updateComparisonView() // Updates comparison display
```

### Error Handling

The system includes comprehensive error handling:

- **API Failures**: Individual API failures don't break the entire system
- **Partial Results**: Users can still see results from working APIs
- **Fallback Content**: Graceful degradation when APIs are unavailable
- **Status Indicators**: Real-time status of each AI service

## 🧪 Testing

### Test Script

Run the dual API test script:

```bash
node scripts/test-dual-api.js
```

This will test:
- AI service health checks
- Individual API functionality
- Dual API functionality
- Error handling scenarios

### Manual Testing

1. **Health Check**: Visit `/api/health/ai` to see API status
2. **Single API**: Test each provider individually
3. **Dual API**: Test both providers simultaneously
4. **Error Scenarios**: Test with invalid API keys

## 📊 Performance Considerations

### Parallel Processing

When using "Both APIs":
- Both APIs are called simultaneously using `Promise.allSettled()`
- Results are returned as soon as both complete
- Individual failures don't block the other API

### Rate Limiting

- **Gemini**: 15 requests per minute (free tier)
- **OpenAI**: 3 requests per minute (free tier)
- **Fallback**: If one API hits rate limit, the other continues

### Caching

Consider implementing caching for:
- API responses
- Health check results
- User preferences

## 🔒 Security

### API Key Management

- API keys are stored in environment variables
- Keys are never exposed to the frontend
- Health checks don't expose sensitive information

### Error Messages

- Generic error messages for users
- Detailed logs for debugging
- No sensitive information in error responses

## 🚀 Deployment

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
GEMINI_API_KEY=your_production_gemini_key
OPENAI_API_KEY=your_production_openai_key
JWT_SECRET=your_secure_jwt_secret
```

### Health Monitoring

Monitor these endpoints in production:
- `/api/health` - Overall system health
- `/api/health/ai` - AI service status
- `/api/health/ai/gemini` - Gemini-specific status
- `/api/health/ai/openai` - OpenAI-specific status

## 📈 Monitoring & Analytics

### Key Metrics

- **API Success Rates**: Track success/failure rates for each AI
- **Response Times**: Monitor performance of each API
- **User Preferences**: Track which AI provider users prefer
- **Error Rates**: Monitor and alert on API failures

### Logging

```javascript
// Example logging for dual API usage
console.log('🎯 Starting resume optimization with both APIs...');
console.log('✅ Resume optimization with both APIs completed');
console.log('📊 Dual API Results:', {
  gemini: !!results.gemini,
  openai: !!results.openai,
  geminiError: results.geminiError,
  openaiError: results.openaiError
});
```

## 🔄 Migration Guide

### From Single API to Dual API

1. **Update Environment Variables**: Add OpenAI API key
2. **Update Frontend**: New UI components for dual selection
3. **Test Both APIs**: Verify both APIs work correctly
4. **Monitor Performance**: Watch for any performance impacts

### Backward Compatibility

- Existing single API calls continue to work
- Default behavior remains Gemini-only
- New dual API features are opt-in

## 🎨 UI/UX Enhancements

### Visual Indicators

- **🔷 Gemini**: Blue diamond icon
- **🔶 OpenAI**: Orange diamond icon  
- **🔄 Both**: Circular arrows icon
- **Status Colors**: Green (available), Red (unavailable), Yellow (partial)

### User Experience

- **Progressive Enhancement**: Works with one or both APIs
- **Clear Feedback**: Status indicators for each AI service
- **Easy Comparison**: Side-by-side view of both versions
- **Flexible Export**: Export individual or comparison versions

## 🐛 Troubleshooting

### Common Issues

1. **API Key Issues**
   - Verify API keys are correctly set
   - Check API key permissions and quotas
   - Test individual API health endpoints

2. **Rate Limiting**
   - Monitor API usage
   - Implement exponential backoff
   - Consider API key rotation

3. **Network Issues**
   - Check internet connectivity
   - Verify firewall settings
   - Test API endpoints directly

### Debug Commands

```bash
# Test AI health
curl http://localhost:3000/api/health/ai

# Test individual APIs
curl http://localhost:3000/api/health/ai/gemini
curl http://localhost:3000/api/health/ai/openai

# Run test script
node scripts/test-dual-api.js
```

## 📝 Future Enhancements

### Planned Features

- **AI Model Selection**: Choose specific models (GPT-4, Gemini Pro, etc.)
- **Custom Prompts**: Allow users to customize AI prompts
- **Batch Processing**: Process multiple resumes simultaneously
- **AI Analytics**: Track which AI produces better results
- **Smart Fallback**: Automatically choose best available AI

### Performance Optimizations

- **Response Caching**: Cache API responses for similar requests
- **Async Processing**: Background processing for large resumes
- **Connection Pooling**: Optimize API connections
- **CDN Integration**: Faster static asset delivery

---

This dual API implementation provides users with maximum flexibility and reliability when generating optimized resumes, ensuring they always get the best possible results regardless of individual API availability or performance. 