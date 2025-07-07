const sqlite3 = require('sqlite3').verbose();
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');

let db;

// Database initialization
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Ensure database directory exists
    fs.ensureDirSync(path.dirname(config.DB_PATH));
    
    db = new sqlite3.Database(config.DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('📁 Connected to SQLite database');
      
      // Create tables
      db.serialize(() => {
        createTables()
          .then(() => {
            console.log('✅ Database tables created/verified');
            resolve();
          })
          .catch(reject);
      });
    });
  });
}

// Create all database tables
function createTables() {
  return new Promise((resolve, reject) => {
    const tables = [
      createUsersTable(),
      createUserProfilesTable(),
      createResumeTemplatesTable(),
      createResumesTable(),
      createIndexes()
    ];

    Promise.all(tables)
      .then(() => resolve())
      .catch(reject);
  });
}

// Users table
function createUsersTable() {
  return new Promise((resolve, reject) => {
    const sql = `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_uuid TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      location TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;
    
    db.run(sql, (err) => {
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      profile_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile_numbers TEXT, -- JSON array of mobile numbers
      linkedin_url TEXT,
      location TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`;
    
    db.run(sql, (err) => {
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      template_name TEXT NOT NULL,
      resume_content TEXT NOT NULL,
      professional_summary TEXT,
      skills TEXT, -- JSON array of skills
      experience TEXT, -- JSON array of experience
      education TEXT, -- JSON array of education
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`;
    
    db.run(sql, (err) => {
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES user_profiles (id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES resume_templates (id) ON DELETE SET NULL
    )`;
    
    db.run(sql, (err) => {
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
      db.run(indexSql, (err) => {
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

// Get database instance
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database connection closed');
          db = null;
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
      database.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  },

  // Get a single row
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Get multiple rows
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      database.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  // Begin transaction
  beginTransaction: () => {
    return dbUtils.run('BEGIN TRANSACTION');
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