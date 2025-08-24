const { Pool } = require('pg');
const config = require('../config/config');

let pool;

// Database initialization
function initDatabase() {
  return new Promise((resolve, reject) => {
    if (!config.DATABASE_URL) {
      const error = new Error('DATABASE_URL is not set in environment variables');
      console.error('❌ Database configuration error:', error.message);
      reject(error);
      return;
    }

    try {
      pool = new Pool({
        connectionString: config.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });

      // Test the connection
      pool.query('SELECT NOW()', (err, result) => {
        if (err) {
          console.error('❌ Error connecting to PostgreSQL database:', err);
          reject(err);
          return;
        }
        
        console.log('📁 Connected to PostgreSQL database (Neon)');
        console.log('🕐 Database time:', result.rows[0].now);
        
        // Create tables
        createTables()
          .then(() => {
            console.log('✅ Database tables created/verified');
            resolve();
          })
          .catch(reject);
      });
    } catch (error) {
      console.error('❌ Error creating database pool:', error);
      reject(error);
    }
  });
}

// Create all database tables
function createTables() {
  return new Promise(async (resolve, reject) => {
    try {
      // Create tables sequentially to respect foreign key constraints
      console.log('📋 Creating users table...');
      await createUsersTable();
      
      console.log('📋 Creating user_profiles table...');
      await createUserProfilesTable();
      
      console.log('📋 Creating resume_templates table...');
      await createResumeTemplatesTable();
      
      console.log('📋 Creating resumes table...');
      await createResumesTable();
      
      console.log('📋 Creating indexes...');
      await createIndexes();
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Users table
function createUsersTable() {
  return new Promise((resolve, reject) => {
    const sql = `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_uuid TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      location TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    pool.query(sql, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// User profiles table
function createUserProfilesTable() {
  return new Promise((resolve, reject) => {
    const sql = `CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      profile_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      profile_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile_numbers TEXT, -- JSON array of mobile numbers
      linkedin_url TEXT,
      location TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`;
    
    pool.query(sql, (err) => {
      if (err) {
        console.error('Error creating user_profiles table:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Resume templates table
function createResumeTemplatesTable() {
  return new Promise((resolve, reject) => {
    const sql = `CREATE TABLE IF NOT EXISTS resume_templates (
      id SERIAL PRIMARY KEY,
      template_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      template_name TEXT NOT NULL,
      resume_content TEXT NOT NULL,
      professional_summary TEXT,
      skills TEXT, -- JSON array of skills
      experience TEXT, -- JSON array of experience
      education TEXT, -- JSON array of education
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`;
    
    pool.query(sql, (err) => {
      if (err) {
        console.error('Error creating resume_templates table:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Resumes table
function createResumesTable() {
  return new Promise((resolve, reject) => {
    const sql = `CREATE TABLE IF NOT EXISTS resumes (
      id SERIAL PRIMARY KEY,
      resume_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      profile_id INTEGER,
      template_id INTEGER,
      resume_title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      job_id TEXT,
      job_url TEXT,
      job_posting_company TEXT,
      job_description TEXT NOT NULL,
      original_resume_content TEXT NOT NULL,
      optimized_resume_content TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES user_profiles (id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES resume_templates (id) ON DELETE SET NULL
    )`;
    
    pool.query(sql, (err) => {
      if (err) {
        console.error('Error creating resumes table:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Create indexes for better performance
function createIndexes() {
  return new Promise((resolve, reject) => {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(user_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_resumes_uuid ON resumes(resume_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON user_profiles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_profiles_uuid ON user_profiles(profile_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_templates_user_id ON resume_templates(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_templates_uuid ON resume_templates(template_uuid)'
    ];

    let completed = 0;
    let hasError = false;

    indexes.forEach((indexSql) => {
      pool.query(indexSql, (err) => {
        if (err && !hasError) {
          hasError = true;
          console.error('Error creating index:', err);
          reject(err);
          return;
        }
        
        completed++;
        if (completed === indexes.length && !hasError) {
          resolve();
        }
      });
    });
  });
}

// Get database pool
function getDatabase() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (pool) {
      pool.end((err) => {
        if (err) {
          console.error('Error closing database pool:', err);
          reject(err);
        } else {
          console.log('Database connection pool closed');
          pool = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Database utility functions
const dbUtils = {
  // Run a query that doesn't return data (INSERT, UPDATE, DELETE)
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            changes: result.rowCount, 
            lastID: result.rows[0]?.id || null 
          });
        }
      });
    });
  },

  // Get a single row
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows[0] || null);
        }
      });
    });
  },

  // Get multiple rows
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows);
        }
      });
    });
  },

  // Begin transaction
  beginTransaction: () => {
    return dbUtils.run('BEGIN');
  },

  // Commit transaction
  commit: () => {
    return dbUtils.run('COMMIT');
  },

  // Rollback transaction
  rollback: () => {
    return dbUtils.run('ROLLBACK');
  }
};

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  dbUtils
};