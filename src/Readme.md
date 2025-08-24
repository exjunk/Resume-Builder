# ATS Resume Optimizer

AI-powered resume optimization system with profile and template management, built with Node.js, Express, PostgreSQL (Neon), and Google Gemini AI.

## 🚀 Features

- **User Authentication**: Secure JWT-based authentication
- **Profile Management**: Multiple user profiles with contact information
- **Template Management**: Reusable resume templates
- **AI Optimization**: Gemini AI-powered resume optimization for ATS systems
- **File Upload**: Support for multiple file formats (.txt, .pdf, .doc, .docx)
- **Structured Data**: JSON-based resume data with export capabilities
- **Health Monitoring**: Comprehensive health checks and system monitoring

## 📁 Project Structure

```
ats-resume-optimizer/
├── server.js                 # Main entry point
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── 
├── src/                     # Source code
│   ├── config/
│   │   └── config.js        # Configuration management
│   ├── database/
│   │   └── database.js      # Database initialization and utilities
│   ├── middleware/
│   │   ├── auth.js          # Authentication middleware
│   │   ├── errorHandler.js  # Error handling middleware
│   │   └── upload.js        # File upload middleware
│   ├── routes/
│   │   ├── authRoutes.js    # Authentication routes
│   │   ├── profileRoutes.js # Profile management routes
│   │   ├── templateRoutes.js# Template management routes
│   │   ├── resumeRoutes.js  # Resume and AI optimization routes
│   │   └── healthRoutes.js  # Health check routes
│   ├── services/
│   │   └── aiService.js     # AI service integration
│   └── utils/
│       └── validation.js    # Input validation utilities
├── 
├── public/                  # Static files (frontend)
│   ├── index.html          # Main frontend application
│   ├── css/
│   ├── js/
│   └── assets/
├── 
├── database/               # Database migration files
│   └── init.sql
├── 
├── uploads/               # Uploaded files (auto-created)
├── 
├── scripts/              # Utility scripts
│   ├── migrate.js       # Database migration
│   ├── seed.js          # Sample data seeding
│   ├── cleanup-files.js # File cleanup utility
│   └── health-check.js  # Health check script
├── 
├── tests/               # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── 
└── logs/               # Log files (auto-created)
```

## 🛠️ Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Google Gemini API key

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ats-resume-optimizer.git
   cd ats-resume-optimizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file and add your configuration:
   ```bash
   # Required
   DATABASE_URL=postgresql://username:password@host:port/database_name
   GEMINI_API_KEY=your-gemini-api-key-here
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # Optional
   PORT=3000
   NODE_ENV=development
   ```

4. **Initialize database**
   ```bash
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open http://localhost:3000 in your browser
   - The API will be available at http://localhost:3000/api

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes |
| `GEMINI_MODEL` | Gemini model to use | `gemini-1.5-flash` | No |
| `MAX_FILE_SIZE` | Max file upload size (bytes) | `5242880` (5MB) | No |

### Getting a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file

## 📚 API Documentation

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update user profile
- `POST /api/auth/logout` - Logout user

### Profiles

- `GET /api/profiles` - Get user profiles
- `POST /api/profiles` - Create new profile
- `GET /api/profiles/:id` - Get specific profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile

### Templates

- `GET /api/templates` - Get resume templates
- `POST /api/templates` - Create new template
- `GET /api/templates/:id` - Get specific template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Resume Optimization

- `POST /api/resumes/optimize` - Optimize resume with AI
- `POST /api/resumes/save-structured` - Save structured resume data
- `GET /api/resumes` - Get user resumes
- `POST /api/resumes` - Create new resume
- `GET /api/resumes/:id` - Get specific resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### Health Checks

- `GET /api/health` - Overall system health
- `GET /api/health/database` - Database health
- `GET /api/health/ai` - AI service health
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🔧 Scripts

```bash
# Database operations
npm run db:migrate    # Initialize/update database schema
npm run db:seed      # Add sample data
npm run db:reset     # Reset database

# File management
npm run cleanup:files # Clean up old uploaded files

# Health checks
npm run health       # Check system health

# Development
npm run dev         # Start with auto-reload
npm start          # Start production server
```

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Comprehensive validation for all inputs
- **File Upload Security**: File type and size validation
- **SQL Injection Protection**: Parameterized queries
- **Rate Limiting**: API rate limiting (configurable)
- **CORS**: Cross-origin resource sharing controls

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper file permissions
4. Set up process management (PM2, systemd)
5. Configure reverse proxy (nginx)
6. Set up SSL/TLS certificates

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Monitoring

The application provides comprehensive health endpoints for monitoring:

- `/api/health` - Overall system status
- `/api/health/ready` - Kubernetes readiness probe
- `/api/health/live` - Kubernetes liveness probe

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue on GitHub
- Check the [API documentation](#api-documentation)
- Review the [health endpoints](#health-monitoring) for debugging

## 🔄 Changelog

### v1.0.0
- Initial release
- User authentication and authorization
- Profile and template management
- AI-powered resume optimization
- File upload support
- Comprehensive health monitoring