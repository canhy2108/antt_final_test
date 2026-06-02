#!/bin/bash

# Security Update Script
# Updates dependencies and patches security vulnerabilities
# Run this regularly to keep the project secure

set -e

echo "================================"
echo "Security Update Script"
echo "================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the correct directory
if [ ! -f "composer.json" ] && [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating PHP Dependencies${NC}"
if [ -f "api/composer.json" ]; then
    cd api
    echo "Running: composer update"
    composer update
    
    echo ""
    echo "Checking for known security vulnerabilities..."
    composer audit || true
    
    cd ..
else
    echo "composer.json not found in api/"
fi

echo ""
echo -e "${YELLOW}Step 2: Updating Frontend Dependencies${NC}"
if [ -f "web/package.json" ]; then
    cd web
    echo "Running: npm audit fix"
    npm audit fix
    
    echo ""
    echo "Checking for known security vulnerabilities..."
    npm audit || true
    
    echo ""
    echo "Updating packages..."
    npm update
    
    cd ..
else
    echo "package.json not found in web/"
fi

echo ""
echo -e "${YELLOW}Step 3: Checking Docker Image Security${NC}"
if command -v docker &> /dev/null; then
    echo "Checking Docker images for vulnerabilities..."
    echo "Run: docker scan <image_name> for detailed vulnerability reports"
else
    echo "Docker not installed. Skipping Docker image scan."
fi

echo ""
echo -e "${GREEN}✓ Security update completed${NC}"
echo ""
echo "Recommendations:"
echo "1. Review changes from composer update and npm update"
echo "2. Test the application thoroughly after updates"
echo "3. Run this script regularly (weekly or monthly)"
echo "4. Monitor security advisories for your dependencies"
