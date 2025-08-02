# Environment Variables Setup Guide

This guide will help you set up the environment variables needed for the dual API resume builder.

## 🚀 Quick Setup

1. **Create a `.env` file** in the root directory of your project
2. **Copy the configuration below** into your `.env` file
3. **Replace the placeholder values** with your actual API keys

## 📝 .env File Configuration

Create a file named `.env` in your project root and add the following:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-change-in-production

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Database Configuration (if needed)
# DB_PATH=database/resume_optimizer.db

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# AI Configuration
AI_RESPONSE_TIMEOUT=30000
AI_MAX_RETRIES=3
```

## 🔑 Getting API Keys

### 1. Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key
5. Replace `your_gemini_api_key_here` in your `.env` file

### 2. OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the generated API key
5. Replace `your_openai_api_key_here` in your `.env` file

## 🔧 Configuration Details

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Gemini API key | `AIzaSyC...` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `JWT_SECRET` | Secret for JWT tokens | `my-secret-key-123` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `OPENAI_MODEL` | OpenAI model name | `gpt-3.5-turbo` |
| `AI_RESPONSE_TIMEOUT` | AI request timeout (ms) | `30000` |
| `AI_MAX_RETRIES` | Max retries for AI calls | `3` |

## 🧪 Testing Your Configuration

After setting up your `.env` file, test the configuration:

```bash
# Start the server
npm start

# Test AI health (in another terminal)
curl http://localhost:3000/api/health/ai
```

Or run the test script:

```bash
node scripts/test-dual-api.js
```

## 🔒 Security Notes

- **Never commit your `.env` file** to version control
- **Keep your API keys secure** and don't share them
- **Use different keys** for development and production
- **Rotate keys regularly** for security

## 🚨 Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Check that your `.env` file exists in the project root
   - Verify the API key variable names are correct
   - Restart the server after making changes

2. **"API key invalid"**
   - Verify your API keys are correct
   - Check that you have sufficient credits/quota
   - Test the API keys directly with the providers

3. **"Request timeout"**
   - Increase `AI_RESPONSE_TIMEOUT` value
   - Check your internet connection
   - Verify API service status

### Debug Commands

```bash
# Check if .env is loaded
node -e "console.log(require('dotenv').config())"

# Test individual APIs
curl -X GET "http://localhost:3000/api/health/ai/gemini"
curl -X GET "http://localhost:3000/api/health/ai/openai"

# Test dual API
curl -X POST "http://localhost:3000/api/resumes/optimize-dual" \
  -H "Content-Type: application/json" \
  -d '{"jobDescription":"test","resumeText":"test","personalInfo":{"fullName":"Test","email":"test@test.com"}}'
```

## 📊 Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
PORT=3000
ENABLE_DETAILED_ERRORS=true
```

### Production
```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=your-very-secure-production-secret
ENABLE_DETAILED_ERRORS=false
```

## 🔄 Updating Configuration

To update your configuration:

1. **Edit the `.env` file** with new values
2. **Restart the server** to load new configuration
3. **Test the changes** using the health endpoints

```bash
# Restart server
npm start

# Test configuration
curl http://localhost:3000/api/health/ai
```

---

Your dual API resume builder is now ready to use with both Gemini and OpenAI! 🎉 