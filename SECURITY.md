# Security Implementation Guide for BudgetBee

## Overview
This document outlines the security enhancements implemented in BudgetBee to protect user data and prevent common vulnerabilities.

## 1. HTTPS Encryption

### Configuration
- **File**: `docker/nginx/nginx.conf`
- **Description**: All traffic is encrypted using TLS 1.2+ with strong ciphers
- **Status**: Implemented in `server` block with `listen 443 ssl http2`

### Setup
```bash
# Generate self-signed certificate for development
./docker/setup-ssl.sh

# For production with Let's Encrypt
certbot certonly --standalone -d yourdomain.com
```

### Security Headers
- **HSTS**: Forces HTTPS for 1 year (`max-age=31536000`)
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Protects against clickjacking
- **X-XSS-Protection**: Enables XSS filtering
- **Content-Security-Policy**: Prevents inline script execution

---

## 2. Rate Limiting

### Configuration
- **File**: `docker/nginx/nginx.conf`
- **Description**: Limits API requests to prevent brute force and DDoS attacks

### Rate Limits
- **General API**: 10 requests/second (burst 20)
- **Authentication**: 5 attempts/minute (burst 5)
- **Password Reset**: 3 attempts/hour

### Example
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
}
```

---

## 3. HTTP Security Headers

### File
`app/Http/Middleware/SecurityHeaders.php`

### Headers Applied
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; ...
```

### Implementation
Add to `app/Http/Kernel.php`:
```php
protected $middleware = [
    \App\Http\Middleware\SecurityHeaders::class,
];
```

---

## 4. HttpOnly Cookies (Frontend)

### Configuration
- **File**: `web/src/Api/HttpClient.js`
- **File**: `web/src/Api/AuthService.js`
- **Description**: Tokens stored as HttpOnly cookies, not in localStorage

### Key Features
- ✓ Automatic cookie inclusion with `credentials: 'include'`
- ✓ Protection against XSS attacks
- ✓ Automatic token refresh
- ✓ Centralized error handling

### Usage Example
```javascript
import authService from './Api/AuthService';

// Login - token automatically stored in HttpOnly cookie
await authService.login(email, password);

// Make API calls - cookies automatically included
import httpClient from './Api/HttpClient';
const data = await httpClient.get('/api/budget');

// Logout
await authService.logout();
```

### Cookie Configuration
Server should set HttpOnly cookies with these flags:
```php
cookie()->queue(
    'auth_token',
    $token,
    lifetime: 120,        // minutes
    path: '/',
    domain: null,
    secure: true,         // HTTPS only
    httpOnly: true,       // Not accessible to JavaScript
    sameSite: 'lax'       // CSRF protection
);
```

---

## 5. Password Security

### Requirements
- Minimum 8 characters
- Must contain uppercase letters
- Must contain lowercase letters
- Must contain numbers
- Must contain special characters

### Configuration
`config/security.php`:
```php
'password' => [
    'min_length' => 8,
    'require_uppercase' => true,
    'require_lowercase' => true,
    'require_numbers' => true,
    'require_special_chars' => true,
],
```

### Hashing
- Algorithm: bcrypt (with cost factor 12)
- Never store plain text passwords
- Use: `Hash::make($password)`

---

## 6. Dependency Updates

### PHP Dependencies
```bash
cd api
composer update
composer audit
```

### Frontend Dependencies
```bash
cd web
npm update
npm audit fix
```

### Automated Security Updates
```bash
./scripts/update-security.sh
```

---

## 7. Session Management

### Configuration
```php
'session' => [
    'name' => 'BUDGETBEE_SESSION',
    'lifetime' => 120,              // 2 hours
    'secure' => true,              // HTTPS only
    'http_only' => true,           // No JavaScript access
    'same_site' => 'lax',          // CSRF protection
],
```

### Token Expiration
- Access Token: 60 minutes
- Refresh Token: 7 days

---

## 8. Database Security

### Configuration
- **User**: Separate DB user (not root)
- **Password**: Strong, unique password
- **Network**: Only accessible from app container
- **Encryption**: Supports transparent data encryption (TDE)

### Best Practices
- Use environment variables for credentials
- Never commit `.env` file
- Use prepared statements (Laravel ORM)
- Enable SSL for DB connections in production

---

## 9. Audit & Logging

### Implementation
- Log all authentication attempts
- Log all data modifications
- Monitor failed login attempts
- Track API usage per user

### Tool Integration
- **Sentry**: Error tracking and monitoring
- **Laravel Telescope**: Local debugging
- **Audit logs**: Custom logging for compliance

---

## 10. Checklist for Deployment

- [ ] Generate SSL certificates with Let's Encrypt
- [ ] Enable HTTPS redirect in nginx.conf
- [ ] Update `.env` with strong secrets
- [ ] Run `composer audit` and `npm audit`
- [ ] Review CORS configuration
- [ ] Enable rate limiting
- [ ] Configure backup strategy
- [ ] Set up monitoring and alerts
- [ ] Test authentication and authorization
- [ ] Review database backups

---

## 11. Security Best Practices

### Development
```bash
# Always keep dependencies updated
npm update && composer update

# Check for vulnerabilities regularly
npm audit && composer audit

# Use strong environment variables
# Generate: openssl rand -base64 32
APP_KEY=base64:...
```

### Deployment
```bash
# Use environment variables for all secrets
# Never commit sensitive data
# Enable HTTPS only
# Use strong database passwords
# Implement rate limiting
# Set up monitoring and alerts
```

### Code Review
- Validate all user input
- Use prepared statements for queries
- Avoid code injection vulnerabilities
- Implement proper error handling
- Log security events

---

## 12. Incident Response

### If Compromised
1. Revoke all active sessions
2. Force password reset for all users
3. Audit logs for unauthorized access
4. Update all secrets and API keys
5. Deploy security patches
6. Notify users of incident

### Monitoring
- Set up alerts for suspicious activities
- Monitor failed login attempts
- Track API rate limit violations
- Monitor database access patterns
- Review logs regularly

---

## 13. Compliance

- **GDPR**: Implement data privacy controls
- **PCI-DSS**: If handling payment data
- **OWASP**: Follow OWASP Top 10 guidelines
- **SOC 2**: Implement security controls

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Laravel Security Documentation](https://laravel.com/docs/security)
- [HTTP Security Headers](https://securityheaders.com/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Support

For security issues or concerns, please contact the security team immediately.
Do not disclose security vulnerabilities publicly.

---

**Last Updated**: April 2026
**Version**: 1.0
