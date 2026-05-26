<?php

return [
    // Fallback category for AI prediction misses and account balance adjustments.
    // Was hardcoded as 44 across controllers — extract here so deployments can
    // override via BUDGETBEE_DEFAULT_CATEGORY_ID.
    'default_category_id' => env('BUDGETBEE_DEFAULT_CATEGORY_ID', 44),
];
