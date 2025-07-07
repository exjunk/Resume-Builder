#!/usr/bin/env node

/**
 * Database Seeding Script
 * Adds sample data for testing and development
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, closeDatabase, dbUtils } = require('../src/database/database');
const config = require('../src/config/config');

// Sample data
const sampleUsers = [
  {
    fullName: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    password: 'password123'
  },
  {
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+1 (555) 987-6543',
    location: 'San Francisco, CA',
    password: 'password123'
  }
];

const sampleProfiles = [
  {
    profileName: 'Software Developer Profile',
    fullName: 'John Smith',
    email: 'john.smith@example.com',
    mobileNumbers: ['+1 (555) 123-4567', '+1 (555) 123-4568'],
    linkedinUrl: 'https://linkedin.com/in/johnsmith',
    location: 'New York, NY',
    isDefault: true
  },
  {
    profileName: 'Product Manager Profile',
    fullName: 'John Smith',
    email: 'j.smith.pm@example.com',
    mobileNumbers: ['+1 (555) 123-4567'],
    linkedinUrl: 'https://linkedin.com/in/johnsmith-pm',
    location: 'New York, NY',
    isDefault: false
  }
];

const sampleTemplates = [
  {
    templateName: 'Software Developer Template',
    resumeContent: `John Smith
john.smith@example.com | (555) 123-4567 | New York, NY

PROFESSIONAL SUMMARY
Experienced Full Stack Developer with 5+ years of experience building scalable web applications. Expertise in JavaScript, React, Node.js, and modern development practices.

PROFESSIONAL EXPERIENCE

Senior Software Engineer | Tech Corp | January 2022 - Present
• Developed and maintained 5+ React-based applications serving 100k+ users
• Improved application performance by 40% through optimization strategies
• Led team of 3 junior developers and provided mentorship
• Implemented CI/CD pipelines reducing deployment time by 60%

Software Engineer | Web Solutions | June 2019 - December 2021
• Built responsive web applications using React, Node.js, and Express
• Collaborated with cross-functional teams on 15+ projects
• Reduced production bugs by 30% through comprehensive testing
• Participated in Agile development processes

TECHNICAL SKILLS
Programming Languages: JavaScript, TypeScript, Python, Java
Frontend: React, Vue.js, HTML5, CSS3, Redux
Backend: Node.js, Express.js, Django
Databases: PostgreSQL, MongoDB, MySQL
Cloud: AWS, Google Cloud Platform, Docker

EDUCATION
Bachelor of Science in Computer Science
State University | 2015 - 2019`,
    professionalSummary: 'Experienced Full Stack Developer with expertise in modern web technologies.',
    isDefault: true
  },
  {
    templateName: 'Product Manager Template',
    resumeContent: `John Smith
j.smith.pm@example.com | (555) 123-4567 | New York, NY

PROFESSIONAL SUMMARY
Results-driven Product Manager with 4+ years of experience leading cross-functional teams and delivering innovative products that drive business growth.

PROFESSIONAL EXPERIENCE

Senior Product Manager | Innovation Labs | March 2021 - Present
• Led product strategy for mobile application with 1M+ active users
• Increased user engagement by 35% through feature optimization
• Managed product roadmap and coordinated with engineering teams
• Conducted market research and competitive analysis

Product Manager | StartupXYZ | August 2019 - February 2021
• Launched 3 major product features resulting in 25% revenue increase
• Collaborated with design and engineering teams on product development
• Analyzed user data to identify improvement opportunities
• Managed stakeholder communications and project timelines

CORE COMPETENCIES
Product Strategy: Roadmap Planning, Market Research, Competitive Analysis
Analytics: Google Analytics, Mixpanel, A/B Testing, User Research
Technical: SQL, Python, Agile/Scrum, JIRA, Confluence
Leadership: Cross-functional Team Management, Stakeholder Communication

EDUCATION
Master of Business Administration
Business School | 2017 - 2019

Bachelor of Science in Engineering
Tech University | 2013 - 2017`,
    professionalSummary: 'Results-driven Product Manager with experience in product strategy and team leadership.',
    isDefault: false
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  console.log(`📍 Database path: ${config.DB_PATH}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);

  try {
    await initDatabase();
    
    // Check if data already exists
    const existingUsers = await dbUtils.get('SELECT COUNT(*) as count FROM users');
    if (existingUsers.count > 0) {
      console.log('⚠️  Database already contains data. Use --force to overwrite.');
      
      const args = process.argv.slice(2);
      if (!args.includes('--force') && !args.includes('-f')) {
        console.log('🏁 Seeding aborted. Use --force to overwrite existing data.');
        return;
      }
      
      console.log('🔄 Force mode enabled. Clearing existing data...');
      await clearExistingData();
    }

    // Seed users
    console.log('👥 Seeding users...');
    const userIds = [];
    
    for (const userData of sampleUsers) {
      const userUuid = uuidv4();
      const passwordHash = await bcrypt.hash(userData.password, 12);
      
      const result = await dbUtils.run(
        `INSERT INTO users (user_uuid, full_name, email, phone, location, password_hash) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userUuid, userData.fullName, userData.email, userData.phone, userData.location, passwordHash]
      );
      
      userIds.push({ id: result.lastID, uuid: userUuid, email: userData.email });
      console.log(`✅ Created user: ${userData.email}`);
    }

    // Seed profiles for first user
    console.log('👤 Seeding profiles...');
    const firstUserId = userIds[0].id;
    
    for (const profileData of sampleProfiles) {
      const profileUuid = uuidv4();
      const mobileNumbersJson = JSON.stringify(profileData.mobileNumbers);
      
      await dbUtils.run(
        `INSERT INTO user_profiles 
         (profile_uuid, user_id, profile_name, full_name, email, mobile_numbers, 
          linkedin_url, location, is_default) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileUuid,
          firstUserId,
          profileData.profileName,
          profileData.fullName,
          profileData.email,
          mobileNumbersJson,
          profileData.linkedinUrl,
          profileData.location,
          profileData.isDefault ? 1 : 0
        ]
      );
      
      console.log(`✅ Created profile: ${profileData.profileName}`);
    }

    // Seed templates for first user
    console.log('📝 Seeding templates...');
    
    for (const templateData of sampleTemplates) {
      const templateUuid = uuidv4();
      
      await dbUtils.run(
        `INSERT INTO resume_templates 
         (template_uuid, user_id, template_name, resume_content, professional_summary, 
          skills, experience, education, is_default) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          templateUuid,
          firstUserId,
          templateData.templateName,
          templateData.resumeContent,
          templateData.professionalSummary,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([]),
          templateData.isDefault ? 1 : 0
        ]
      );
      
      console.log(`✅ Created template: ${templateData.templateName}`);
    }

    // Create sample resume
    console.log('📄 Creating sample resume...');
    const resumeUuid = uuidv4();
    
    await dbUtils.run(
      `INSERT INTO resumes 
       (resume_uuid, user_id, resume_title, company_name, job_description, 
        original_resume_content, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        resumeUuid,
        firstUserId,
        'Senior Full Stack Developer at TechCorp',
        'TechCorp Inc.',
        'We are looking for a Senior Full Stack Developer to join our team...',
        sampleTemplates[0].resumeContent,
        'draft'
      ]
    );
    
    console.log('✅ Created sample resume');

    // Display summary
    console.log('\n📊 Seeding Summary:');
    console.log('=====================================');
    
    const counts = await Promise.all([
      dbUtils.get('SELECT COUNT(*) as count FROM users'),
      dbUtils.get('SELECT COUNT(*) as count FROM user_profiles'),
      dbUtils.get('SELECT COUNT(*) as count FROM resume_templates'),
      dbUtils.get('SELECT COUNT(*) as count FROM resumes')
    ]);
    
    console.log(`👥 Users: ${counts[0].count}`);
    console.log(`👤 Profiles: ${counts[1].count}`);
    console.log(`📝 Templates: ${counts[2].count}`);
    console.log(`📄 Resumes: ${counts[3].count}`);
    
    console.log('\n🔐 Test Login Credentials:');
    console.log('=====================================');
    sampleUsers.forEach(user => {
      console.log(`📧 ${user.email}`);
      console.log(`🔑 ${user.password}`);
      console.log('---');
    });
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

async function clearExistingData() {
  const tables = ['resumes', 'resume_templates', 'user_profiles', 'users'];
  
  for (const table of tables) {
    await dbUtils.run(`DELETE FROM ${table}`);
    console.log(`🗑️  Cleared table: ${table}`);
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
📖 Database Seeding Script Help
=====================================

Usage: npm run db:seed [options]

Options:
  --force, -f     Force seeding even if data exists
  --verbose, -v   Enable verbose output
  --help, -h      Show this help message

Examples:
  npm run db:seed                # Seed if database is empty
  npm run db:seed --force        # Force seed and overwrite data
  npm run db:seed --verbose      # Seed with detailed output

This script creates sample users, profiles, templates, and resumes
for testing and development purposes.
`);
  process.exit(0);
}

// Run seeding
seedDatabase();