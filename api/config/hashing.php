<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Hash Driver
    |--------------------------------------------------------------------------
    |
    | This option controls the default hash driver that will be used to hash
    | passwords for your application. By default, the bcrypt algorithm is
    | used; however, you remain free to modify this option if you wish.
    |
    | Supported: "bcrypt", "argon", "argon2id"
    |
    */

    // SECURITY: Argon2id is the modern PHC winner — memory-hard, resistant to GPU/ASIC attacks.
    // Falls back to bcrypt only if PHP doesn't support Argon2id.
    'driver' => env('HASH_DRIVER', 'argon2id'),

    /*
    |--------------------------------------------------------------------------
    | Bcrypt Options
    |--------------------------------------------------------------------------
    |
    | Here you may specify the configuration options that should be used when
    | passwords are hashed using the Bcrypt algorithm. This will allow you
    | to control the amount of time it takes to hash the given password.
    |
    */

    'bcrypt' => [
        // SECURITY: rounds 12 = ~250ms on modern CPU; tune up if you have fast hardware
        'rounds' => env('BCRYPT_ROUNDS', 12),
    ],

    /*
    |--------------------------------------------------------------------------
    | Argon Options
    |--------------------------------------------------------------------------
    |
    | Here you may specify the configuration options that should be used when
    | passwords are hashed using the Argon algorithm. These will allow you
    | to control the amount of time it takes to hash the given password.
    |
    */

    // SECURITY: Argon2id parameters (OWASP recommended)
    // memory: 64MB, threads: 4, time: 4 iterations → ~500ms on modern server
    'argon' => [
        'memory' => env('ARGON_MEMORY', 65536),  // KB
        'threads' => env('ARGON_THREADS', 4),
        'time' => env('ARGON_TIME', 4),
    ],

    // Rehash on next login if work factor outdated
    'rehash_on_login' => true,

];
