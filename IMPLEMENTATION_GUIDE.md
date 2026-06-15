# Implementation Guide: Security Enhancements for BudgetBee

## Quick Start - Implement All Security Features in 1 Week

### Week 1 Timeline

#### Day 1-2: HTTPS & SSL Certificates
```bash
# 1. Generate SSL certificates for development
cd docker
./setup-ssl.sh

# 2. Update Nginx configuration (already done in nginx.conf)
# Verify the configuration is correct
cat nginx/nginx.conf

# 3. For production with Let's Encrypt:
# Install certbot on server
sudo apt-get install certbot python3-certbot-nginx

# Request certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx.conf with production certificate paths
```

#### Day 2-3: Rate Limiting & Security Headers
```bash
# 1. Verify SecurityHeaders middleware is registered
# (Already created in app/Http/Middleware/SecurityHeaders.php)

# 2. Verify Kernel.php includes the middleware
cat api/app/Http/Kernel.php | grep SecurityHeaders

# 3. Test rate limiting configuration
# Visit /api endpoints and check response headers

# 4. Deploy using docker-compose
docker-compose -f docker/docker-compose.yml up -d
```

#### Day 3-4: Frontend Security (HttpOnly Cookies)
```bash
# 1. Replace or update API client in React
# Files: web/src/Api/HttpClient.js, web/src/Api/AuthService.js
# (Already created - verify they exist)

# 2. Backend: Update AuthController to set HttpOnly cookies
# File: api/app/Http/Controllers/Auth/AuthController.php
# (Already created)

# 3. Configure session in config/security.php
# (Already created)

# 4. Test authentication flow:
# - Login should store token in HttpOnly cookie
# - Cookie should not be accessible via JavaScript
# - API calls should automatically include cookie
```

#### Day 4-5: Update Dependencies
```bash
# 1. Update PHP dependencies
cd api
composer update
composer audit

# 2. Update frontend dependencies
cd ../web
npm update
npm audit fix

# 3. Review changes and test thoroughly
cd ..
```

#### Day 5-6: Testing & Validation
```bash
# 1. Security headers verification
# Use: https://securityheaders.com/

# 2. SSL/TLS verification
# Use: https://www.ssllabs.com/ssltest/

# 3. Test rate limiting
# Run multiple requests and verify 429 responses

# 4. Test authentication with HttpOnly cookies
# Verify token is not accessible from browser console

# 5. Test all endpoints
npm test
php artisan test
```

#### Day 6-7: Documentation & Deployment
```bash
# 1. Review SECURITY.md documentation
cat ../SECURITY.md

# 2. Configure .env with security settings
cp .env.example.secure .env
# Edit .env with strong passwords and secrets

# 3. Deploy to production
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.secure.yml up -d

# 4. Verify all services are running
docker-compose ps

# 5. Test production endpoints
```

---

## Detailed Implementation Steps

### 1. SSL/TLS Certificate Setup

#### For Development (Self-signed):
```bash
cd docker
./setup-ssl.sh

# Verify certificates exist
ls -la nginx/ssl/
```

#### For Production (Let's Encrypt):
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/key.pem
sudo chmod 644 docker/nginx/ssl/cert.pem
sudo chmod 600 docker/nginx/ssl/key.pem

# Set up auto-renewal
sudo certbot renew --dry-run
```

### 2. Nginx Rate Limiting Configuration

The nginx.conf already includes:
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# Apply to locations
location /api {
    limit_req zone=api_limit burst=20 nodelay;
}

location /api/auth {
    limit_req zone=auth_limit burst=5 nodelay;
}
```

### 3. Security Headers Implementation

Verify middleware registration:
```bash
# Check if SecurityHeaders middleware exists
test -f api/app/Http/Middleware/SecurityHeaders.php && echo "✓ Middleware exists"

# Verify it's registered in Kernel.php
grep -n "SecurityHeaders" api/app/Http/Kernel.php
```

### 4. Frontend Cookie Configuration

The HttpClient automatically includes credentials:
```javascript
// In web/src/Api/HttpClient.js
const options = {
    method,
    headers,
    credentials: 'include', // Automatically include HttpOnly cookies
};
```

**Never do this:**
```javascript
// ❌ WRONG - Don't store tokens in localStorage
localStorage.setItem('token', token);

// ❌ WRONG - Don't expose tokens in requests
headers['Authorization'] = `Bearer ${token}`;
```

**Always use HttpOnly cookies for sensitive tokens**

### 5. Update Dependencies

```bash
# PHP
cd api
composer update
composer audit
composer audit --format=json  # For CI/CD

# Frontend
cd ../web
npm update
npm audit fix
npm audit --json  # For CI/CD

# Check for critical vulnerabilities
npm audit --audit-level=moderate
```

### 6. Docker Compose for Security

Run with security enhancements:
```bash
# Development
docker-compose -f docker/docker-compose.yml up -d

# Production with security enhancements
docker-compose -f docker/docker-compose.yml \
               -f docker/docker-compose.secure.yml up -d
```

### 7. Environment Configuration

Create secure .env file:
```bash
cp api/.env.example.secure api/.env

# Edit with strong values
nano api/.env

# Generate secure APP_KEY
php api/artisan key:generate

# Generate strong passwords
openssl rand -base64 32

# Database password (32 characters minimum)
openssl rand -base64 24
```

---

## Security Checklist

### Before Deployment
- [ ] SSL certificates generated/configured
- [ ] Nginx HTTPS redirect enabled
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] HttpOnly cookies configured
- [ ] Dependencies updated
- [ ] `npm audit` and `composer audit` passed
- [ ] `.env` file properly secured
- [ ] Database backups configured
- [ ] Monitoring/logging configured

### After Deployment
- [ ] Test HTTPS connectivity (https://yourdomain.com)
- [ ] Verify security headers (https://securityheaders.com/)
- [ ] Verify SSL certificate (https://www.ssllabs.com/ssltest/)
- [ ] Test rate limiting (send >20 requests/sec to /api)
- [ ] Test authentication flow
- [ ] Test password reset flow
- [ ] Monitor logs for errors
- [ ] Set up alerts for suspicious activities

### Regular Maintenance
- [ ] Run `./scripts/update-security.sh` monthly
- [ ] Review logs weekly
- [ ] Update dependencies monthly
- [ ] Test disaster recovery plan quarterly
- [ ] Security audit annually

---

## Testing Security

### Manual Testing

```bash
# 1. Test HTTPS redirect
curl -I http://localhost

# 2. Check security headers
curl -I https://localhost/api

# 3. Test rate limiting
for i in {1..30}; do curl -s https://localhost/api/budget; done

# 4. Test authentication
curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 5. Test with invalid credentials (should be rate limited)
for i in {1..10}; do curl -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"wrong"}'; done
```

### Automated Testing

```bash
# PHP
cd api
php artisan test --filter=Security

# Frontend
cd ../web
npm test -- --testPathPattern=security
```

---

## Troubleshooting

### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in docker/nginx/ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in docker/nginx/ssl/cert.pem -noout -dates

# Verify certificate and key match
openssl x509 -noout -modulus -in docker/nginx/ssl/cert.pem | \
  openssl md5

openssl rsa -noout -modulus -in docker/nginx/ssl/key.pem | \
  openssl md5
```

### Rate Limiting Issues
```bash
# Check Nginx logs
docker logs budgetbee-nginx

# Verify rate limiting configuration
docker exec budgetbee-nginx nginx -T | grep limit_req
```

### Cookie Issues
```bash
# Check Set-Cookie header
curl -I https://localhost/api/auth/login

# Verify HttpOnly flag is set
curl -I https://localhost/api/auth/login | grep -i "Set-Cookie"
# Should show: Path=/; HttpOnly; Secure; SameSite=Lax
```

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Laravel Security](https://laravel.com/docs/security)
- [Mozilla SSL Configuration](https://ssl-config.mozilla.org/)
- [HTTP Security Headers](https://securityheaders.com/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Support & Questions

For security issues or questions, refer to SECURITY.md or contact the security team.

---

**Implementation Status**: ✓ Complete
**Date**: April 2026
**Version**: 1.0
