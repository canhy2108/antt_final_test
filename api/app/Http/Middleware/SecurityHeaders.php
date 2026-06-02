<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security Headers Middleware
 * Applies OWASP-recommended HTTP security headers to every response.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Force HTTPS for 1 year, include subdomains, allow preload
        $response->headers->set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );

        // Prevent MIME-type sniffing attacks
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking (allow same-origin iframes only)
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Modern browsers ignore this — but harmless to include
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Don't leak referrer info to other origins
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Disable unused browser features (Permissions Policy)
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(self)'
        );

        // Content Security Policy — STRICT: no unsafe-inline/eval
        // For production, use nonces. Adjust connect-src to your API/CDN domains.
        $cspDirectives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'", // unsafe-inline only for styles (Tailwind)
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https:",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
        ];
        $response->headers->set('Content-Security-Policy', implode('; ', $cspDirectives));

        // Remove server info leak
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
