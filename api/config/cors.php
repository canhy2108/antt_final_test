<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // SECURITY: Whitelist specific origins ONLY — never '*'
    // Read from env so production vs dev can differ
    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://localhost:5173,http://localhost:80'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'X-CSRF-Token', 'Accept', 'Origin'],

    'exposed_headers' => ['X-CSRF-Token'],

    'max_age' => 3600,

    // Required for HttpOnly cookies to work with credentials
    'supports_credentials' => true,

];
