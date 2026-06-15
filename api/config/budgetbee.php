<?php

return [
    // Fallback category for AI prediction misses and account balance adjustments.
    // Was hardcoded as 44 across controllers — extract here so deployments can
    // override via BUDGETBEE_DEFAULT_CATEGORY_ID.
    'default_category_id' => env('BUDGETBEE_DEFAULT_CATEGORY_ID', 44),

    // Dự đoán danh mục bằng AI (python). TẮT mặc định: khi bật `php artisan serve`
    // (đơn luồng) trên máy không có python / sai đường dẫn, lời gọi python ĐỒNG BỘ
    // làm treo request tạo giao dịch → cả server kẹt → app báo "network error".
    // Chỉ bật khi đã cài python và chạy nền/queue.
    'ai_enabled' => env('AI_ENABLED', false),
    'python_bin' => env('PYTHON_BIN', 'python3'),
];
