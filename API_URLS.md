# 🌐 Complete API URLs Guide

## Base URL
```
http://localhost:3000
```

## 🔐 Authentication Endpoints

### Register New User
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "John Smith",
  "email": "john.smith@example.com",
  "phone": "+1 (555) 123-4567",
  "location": "New York, NY",
  "password": "password123"
}
```

### Login User
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "john.smith@example.com",
  "password": "password123"
}
```

### Get Current User Profile
```http
GET http://localhost:3000/api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

## 👤 Profile Management

### Get All Profiles
```http
GET http://localhost:3000/api/profiles
Authorization: Bearer YOUR_JWT_TOKEN
```

### Create New Profile
```http
POST http://localhost:3000/api/profiles
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "profileName": "Software Developer Profile",
  "fullName": "John Smith",
  "email": "john.smith@example.com",
  "mobileNumbers": ["+1 (555) 123-4567"],
  "linkedinUrl": "https://linkedin.com/in/johnsmith",
  "location": "New York, NY",
  "isDefault": true
}
```

## 📝 Template Management

### Get All Templates
```http
GET http://localhost:3000/api/templates
Authorization: Bearer YOUR_JWT_TOKEN
```

### Create New Template
```http
POST http://localhost:3000/api/templates
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "templateName": "Software Developer Template",
  "resumeContent": "Your resume content here...",
  "professionalSummary": "Professional summary...",
  "isDefault": true
}
```

## 🤖 AI Resume Optimization

### Optimize Resume (Legacy Route)
```http
POST http://localhost:3000/api/optimize-resume-json
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "jobDescription": "Job description text...",
  "resumeText": "Current resume content...",
  "profileUuid": "profile-uuid-here",
  "templateUuid": "template-uuid-here"
}
```

### Optimize Resume (New Route)
```http
POST http://localhost:3000/api/resumes/optimize
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "jobDescription": "Job description text...",
  "resumeText": "Current resume content...",
  "profileUuid": "profile-uuid-here",
  "templateUuid": "template-uuid-here"
}
```

## 🏥 Health Check Endpoints

### Overall Health
```http
GET http://localhost:3000/api/health
```

### Database Health
```http
GET http://localhost:3000/api/health/database
```

### AI Service Health
```http
GET http://localhost:3000/api/health/ai
```

## 🖥️ Frontend Application

### Main Application
```
http://localhost:3000
```

## 📋 Quick Test Commands

### Test Server Health
```bash
curl http://localhost:3000/api/health
```

### Test Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🔑 Sample Test Credentials

If you've run the seed script (`npm run db:seed`), you can use these test accounts:

**Account 1:**
- Email: `john.smith@example.com`
- Password: `password123`

**Account 2:**
- Email: `sarah.johnson@example.com`
- Password: `password123`

## 📱 Using in Frontend/Postman

1. **Register or Login** to get a JWT token
2. **Copy the token** from the response
3. **Use the token** in Authorization header: `Bearer YOUR_TOKEN_HERE`
4. **Make API calls** to protected endpoints

## 🚀 Common Workflow

1. **Register/Login** → Get JWT token
2. **Create Profile** → Store personal information
3. **Create Template** → Store resume template
4. **Optimize Resume** → Use AI to generate tailored resume
5. **Export Results** → Download PDF or JSON

## ⚠️ Important Notes

- All endpoints except `/api/health/*` and `/api/auth/login` and `/api/auth/register` require authentication
- JWT tokens expire in 7 days (configurable)
- Maximum file upload size is 5MB
- AI optimization requires a valid Gemini API key