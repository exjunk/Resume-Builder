# Database Migration: SQLite to PostgreSQL (Neon)

This document outlines the migration from SQLite to PostgreSQL using Neon as the database provider.

## Changes Made

### 1. Dependencies Updated
- **Removed**: `sqlite3` package
- **Added**: `pg` (PostgreSQL client) package

### 2. Configuration Changes
- **File**: `src/config/config.js`
- **Change**: Replaced `DB_PATH` with `DATABASE_URL` environment variable

### 3. Database Implementation
- **File**: `src/database/database.js`
- **Complete rewrite**: Replaced SQLite implementation with PostgreSQL using connection pooling
- **Key changes**:
  - Uses `pg.Pool` for connection management
  - Updated table creation syntax for PostgreSQL
  - Changed data types (e.g., `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`)
  - Updated boolean handling (`INTEGER` → `BOOLEAN`)
  - Modified timestamp handling (`DATETIME` → `TIMESTAMP`)

### 4. Script Updates
- **Migration script**: Updated to show database URL status instead of file path
- **Seed script**: Updated boolean values and database path references

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name

# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-flash
```

## Neon Database Setup

1. **Create Neon Account**: Sign up at [neon.tech](https://neon.tech)
2. **Create Project**: Create a new project in your Neon dashboard
3. **Get Connection String**: Copy the connection string from your project settings
4. **Set Environment Variable**: Add the connection string to your `.env` file as `DATABASE_URL`

## Migration Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your Neon connection string

3. **Run Migration**:
   ```bash
   npm run db:migrate
   ```

4. **Seed Database** (Optional):
   ```bash
   npm run db:seed
   ```

5. **Test Application**:
   ```bash
   npm run health
   ```

## Database Schema

The following tables are created:

- **users**: User accounts and authentication
- **user_profiles**: User profile information
- **resume_templates**: Resume templates
- **resumes**: Resume instances and optimizations

## Key Differences from SQLite

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Primary Key | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| Boolean | `INTEGER (0/1)` | `BOOLEAN` |
| Timestamp | `DATETIME` | `TIMESTAMP` |
| Connection | File-based | Client-server |
| SSL | Not applicable | Required for Neon |

## Troubleshooting

### Connection Issues
- Ensure `DATABASE_URL` is correctly set
- Verify SSL settings (Neon requires SSL)
- Check network connectivity

### Migration Errors
- Ensure database exists in Neon
- Verify user permissions
- Check connection string format

### Data Type Issues
- Boolean values should be `true`/`false`, not `1`/`0`
- Timestamps use PostgreSQL format
- JSON fields remain the same

## Performance Considerations

- **Connection Pooling**: The application uses connection pooling for better performance
- **Indexes**: All necessary indexes are created automatically
- **SSL**: SSL is enabled for secure connections to Neon

## Backup and Recovery

- Neon provides automatic backups
- Use Neon's point-in-time recovery features
- Export data using standard PostgreSQL tools if needed
