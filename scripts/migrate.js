#!/usr/bin/env node

/**
 * Database Migration Script
 * Initializes or updates the database schema
 */

const { initDatabase, closeDatabase } = require('../src/database/database');
const config = require('../src/config/config');

async function migrate() {
  console.log('🔄 Starting database migration...');
  console.log(`📍 Database URL: ${config.DATABASE_URL ? 'Configured' : 'Not set'}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);

  try {
    await initDatabase();
    console.log('✅ Database migration completed successfully!');
    
    // Test basic functionality
    console.log('🧪 Testing database connection...');
    const { dbUtils } = require('../src/database/database');
    
    // Test each table
    const tables = ['users', 'user_profiles', 'resume_templates', 'resumes'];
    
    for (const table of tables) {
      try {
        const count = await dbUtils.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table '${table}': ${count.count} records`);
      } catch (error) {
        console.error(`❌ Error testing table '${table}':`, error.message);
      }
    }
    
    console.log('🎉 Migration and tests completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const verbose = args.includes('--verbose') || args.includes('-v');

if (verbose) {
  console.log('🔍 Verbose mode enabled');
  console.log('📝 Script arguments:', args);
}

if (force) {
  console.log('⚠️  Force mode enabled - this may overwrite existing data');
}

// Run migration
migrate();