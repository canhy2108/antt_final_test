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

    /*
    |--------------------------------------------------------------------------
    | Magic link đặt lại mật khẩu (Tầng 2 — bỏ gõ OTP tay)
    |--------------------------------------------------------------------------
    |  - expire_minutes: token sống ngắn (mặc định 30 phút), dùng-một-lần.
    |  - limit / window: chống spam xin link (mặc định 3 link / 15 phút / user).
    |  - base: scheme deep link mở thẳng app vào route 'reset-link' (màn đặt mật
    |    khẩu qua link). Server ghép '?token=<token thô>'. KHÁC route 'reset-password'
    |    (màn OTP gõ tay) để hai luồng không đụng nhau. Đổi qua RESET_LINK_BASE nếu
    |    dùng Universal/App Links thay custom scheme.
    */
    'reset_link_expire_minutes' => (int) env('RESET_LINK_EXPIRE_MINUTES', 30),
    'reset_link_limit' => (int) env('RESET_LINK_LIMIT', 3),
    'reset_link_window_minutes' => (int) env('RESET_LINK_WINDOW_MINUTES', 15),
    'reset_link_base' => env('RESET_LINK_BASE', 'budgetbee://reset-link'),
];
