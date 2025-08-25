#!/bin/bash

# Production Deployment Script for resume.androiddevapps.com
# Run this script on your Ubuntu production server

set -e  # Exit on any error

echo "🚀 Starting production deployment for resume.androiddevapps.com"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root (use sudo)"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y nginx certbot python3-certbot-nginx nodejs npm

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Create application directory
APP_DIR="/var/www/resume.androiddevapps.com"
print_status "Creating application directory: $APP_DIR"
mkdir -p $APP_DIR


# Set up Nginx configuration
print_status "Setting up Nginx configuration..."
cat > /etc/nginx/sites-available/resume.androiddevapps.com << 'EOF'
server {
    listen 80;
    server_name resume.androiddevapps.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name resume.androiddevapps.com;
    
    # SSL Configuration (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/resume.androiddevapps.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/resume.androiddevapps.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location /static/ {
        alias /var/www/resume.androiddevapps.com/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/resume.androiddevapps.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
nginx -t
print_success "Nginx configuration is valid"

# Reload Nginx
systemctl reload nginx
print_success "Nginx reloaded"

# Get SSL certificate
print_status "Obtaining SSL certificate..."
certbot certonly --nginx -d resume.androiddevapps.com --non-interactive --agree-tos --email your-email@example.com

# Reload Nginx again to use SSL
systemctl reload nginx
print_success "SSL certificate installed"

# Set up PM2 for process management
print_status "Installing PM2..."
npm install -g pm2

# Create PM2 ecosystem file
cat > $APP_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'resume-builder',
    script: 'server.js',
    cwd: '/var/www/resume.androiddevapps.com',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/resume-builder-error.log',
    out_file: '/var/log/pm2/resume-builder-out.log',
    log_file: '/var/log/pm2/resume-builder-combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10
  }]
};
EOF

# Create log directory
mkdir -p /var/log/pm2

# Set up automatic SSL renewal
print_status "Setting up automatic SSL renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

print_success "Production deployment completed!"
echo ""
echo "🌐 Your application will be available at: https://resume.androiddevapps.com"
echo ""
echo "📋 Next steps:"
echo "1. Copy your application files to: $APP_DIR"
echo "2. Run: cd $APP_DIR && npm install"
echo "3. Run: npm run db:migrate"
echo "4. Start the application: pm2 start ecosystem.config.js"
echo "5. Save PM2 configuration: pm2 save"
echo "6. Set up PM2 startup: pm2 startup"
echo ""
echo "🔧 Useful commands:"
echo "- View logs: pm2 logs resume-builder"
echo "- Restart app: pm2 restart resume-builder"
echo "- Monitor: pm2 monit"
echo "- Status: pm2 status"
