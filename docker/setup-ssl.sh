#!/bin/bash

# Setup SSL/TLS certificates for Nginx with Let's Encrypt
# This script generates self-signed certificates for development
# For production, use Let's Encrypt with certbot

set -e

SSL_DIR="./nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

echo "Setting up SSL/TLS certificates..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "SSL certificates already exist at $CERT_FILE and $KEY_FILE"
    echo "Skipping certificate generation..."
else
    echo "Generating self-signed SSL certificate..."
    
    # Generate self-signed certificate valid for 365 days
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=VN/ST=Vietnam/L=Hanoi/O=BudgetBee/CN=budgetbee.local"
    
    echo "✓ Self-signed certificate generated"
    echo "  Certificate: $CERT_FILE"
    echo "  Key: $KEY_FILE"
fi

# Set proper permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "✓ SSL/TLS setup completed"

# Instructions for Let's Encrypt in production
echo ""
echo "For production environment with Let's Encrypt:"
echo "1. Install certbot: apt-get install certbot python3-certbot-nginx"
echo "2. Run: certbot certonly --standalone -d yourdomain.com"
echo "3. Update nginx.conf with certificate paths"
echo "4. Enable auto-renewal: certbot renew --dry-run"
