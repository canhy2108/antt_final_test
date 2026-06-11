<?php

return [
    /*
    |--------------------------------------------------------------------------
    | OTP length (số chữ số)
    |--------------------------------------------------------------------------
    */
    'length' => (int) env('OTP_LENGTH', 6),

    /*
    |--------------------------------------------------------------------------
    | OTP hạn dùng (phút)
    |--------------------------------------------------------------------------
    */
    'expire_minutes' => (int) env('OTP_EXPIRE_MINUTES', 10),

    /*
    |--------------------------------------------------------------------------
    | Số lần verify sai tối đa trước khi OTP bị khoá
    |--------------------------------------------------------------------------
    */
    'max_attempts' => (int) env('OTP_MAX_ATTEMPTS', 5),

    /*
    |--------------------------------------------------------------------------
    | DEV ONLY — trả code OTP trong response body để dễ test mà
    | không cần đọc email/log. CHỈ true khi APP_ENV=local.
    |--------------------------------------------------------------------------
    */
    'dev_return_code' => filter_var(env('OTP_DEV_RETURN_CODE', false), FILTER_VALIDATE_BOOLEAN)
        && env('APP_ENV') === 'local',

    /*
    |--------------------------------------------------------------------------
    | Rate limit: số lần request OTP mới trong cửa sổ thời gian
    |--------------------------------------------------------------------------
    */
    'resend_limit' => (int) env('OTP_RESEND_LIMIT', 3),
    'resend_window_minutes' => (int) env('OTP_RESEND_WINDOW_MINUTES', 15),

    /*
    |--------------------------------------------------------------------------
    | PIN change — tighter than the default OTP
    |--------------------------------------------------------------------------
    |  - 5-minute code expiry (vs. 10 default)
    |  - 3 requests per 24h, after which the user is blocked until tomorrow
    */
    'pin_change_expire_minutes' => (int) env('OTP_PIN_CHANGE_EXPIRE_MINUTES', 5),
    'pin_change_daily_limit' => (int) env('OTP_PIN_CHANGE_DAILY_LIMIT', 3),
];
