<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\AppVersionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BalanceController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AiController;
use App\Http\Controllers\ApiKeyController;
use App\Http\Controllers\ExternalApiController;
use App\Http\Controllers\UpcomingExpenseController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\BiometricController;
use App\Http\Controllers\BiometricChallengeController;
use App\Http\Controllers\BiometricCryptoController;
use App\Http\Controllers\RefreshTokenController;
use App\Http\Controllers\AttestationController;
use App\Http\Controllers\DebtLoanController;
use App\Http\Controllers\RecurringTransactionController;
use App\Http\Controllers\SavingsGoalController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\TotpController;


/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);
Route::get('/setup/check', [AuthController::class, 'setupCheck']);
Route::post('/setup/register', [AuthController::class, 'setupRegister']);

// Public self-registration + OTP flow (mobile app uses these)
Route::post('/register', [AuthController::class, 'selfRegister']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/resend-otp', [AuthController::class, 'resendOtp']);

// Auth-required: request an OTP to confirm a sensitive action
Route::post('/sensitive-otp', [AuthController::class, 'requestSensitiveOtp'])->middleware('auth:sanctum');

// Phase A — device-bound credentials (opaque bio_token gated by OS biometric)
Route::post('/biometric/login-face', [BiometricController::class, 'loginByFace']);
Route::post('/biometric/login-fingerprint', [BiometricController::class, 'loginByFingerprint']);

// Phase B — hardware-backed challenge-response (FIDO style). The client
// generates a P-256 keypair inside Secure Enclave / StrongBox; only the
// public key is uploaded. Login: server issues a nonce → client signs
// in-enclave → server verifies. Replay-proof and exfil-proof even on root.
Route::post('/biometric/keys/challenge', [BiometricChallengeController::class, 'challenge']);
Route::post('/biometric/keys/verify', [BiometricChallengeController::class, 'verify']);

// Legacy crypto endpoints (kept until the client fully migrates to Phase B).
Route::post('/biometric/challenge', [BiometricCryptoController::class, 'challenge']);
Route::post('/biometric/verify', [BiometricCryptoController::class, 'verify']);

// Refresh token rotation
Route::post('/auth/refresh', [RefreshTokenController::class, 'refresh']);

// Attestation verification (Play Integrity / App Attest)
Route::post('/attest/verify', [AttestationController::class, 'verify']);

// Auth-required: biometric credential + Phase B key management
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/biometric/enroll-face', [BiometricController::class, 'enrollFace']);
    Route::post('/biometric/enroll-fingerprint', [BiometricController::class, 'enrollFingerprint']);
    Route::get('/biometric/credentials', [BiometricController::class, 'index']);
    Route::delete('/biometric/credentials/{id}', [BiometricController::class, 'revoke']);

    Route::post('/biometric/keys/register', [BiometricChallengeController::class, 'register']);
    Route::get('/biometric/keys', [BiometricChallengeController::class, 'index']);
    Route::delete('/biometric/keys/{id}', [BiometricChallengeController::class, 'revoke']);
});

// Auth-required: recurring transactions (lương / hoá đơn định kỳ)
Route::middleware('auth:sanctum')->prefix('recurring')->group(function () {
    Route::get('', [RecurringTransactionController::class, 'index']);
    Route::post('', [RecurringTransactionController::class, 'store']);
    Route::get('{id}', [RecurringTransactionController::class, 'show']);
    Route::post('{id}', [RecurringTransactionController::class, 'update']);
    Route::delete('{id}', [RecurringTransactionController::class, 'destroy']);
    Route::post('{id}/run-now', [RecurringTransactionController::class, 'runNow']);
});

// Auth-required: savings goals (mục tiêu tiết kiệm)
Route::middleware('auth:sanctum')->prefix('savings-goals')->group(function () {
    Route::get('', [SavingsGoalController::class, 'index']);
    Route::post('', [SavingsGoalController::class, 'store']);
    Route::get('{id}', [SavingsGoalController::class, 'show']);
    Route::post('{id}', [SavingsGoalController::class, 'update']);
    Route::delete('{id}', [SavingsGoalController::class, 'destroy']);
    Route::post('{id}/contribute', [SavingsGoalController::class, 'contribute']);
});

// Auth-required: device & session management
Route::middleware('auth:sanctum')->prefix('devices')->group(function () {
    Route::get('', [DeviceController::class, 'index']);
    Route::post('register', [DeviceController::class, 'register']);
    Route::post('{id}/trust', [DeviceController::class, 'trust']);
    Route::delete('{id}', [DeviceController::class, 'revoke']);
    Route::post('revoke-others', [DeviceController::class, 'revokeOtherSessions']);
});

// Auth-required: TOTP 2FA (Google Authenticator)
Route::middleware('auth:sanctum')->prefix('totp')->group(function () {
    Route::get('status', [TotpController::class, 'status']);
    Route::post('setup', [TotpController::class, 'setup']);
    Route::post('verify', [TotpController::class, 'verify']);
    Route::post('disable', [TotpController::class, 'disable']);
});

// Auth-required: debts & loans tracking (lent / borrowed money ledger)
Route::middleware('auth:sanctum')->prefix('debts-loans')->group(function () {
    Route::get('', [DebtLoanController::class, 'index']);
    Route::post('', [DebtLoanController::class, 'store']);
    Route::get('{id}', [DebtLoanController::class, 'show']);
    Route::post('{id}', [DebtLoanController::class, 'update']);
    Route::delete('{id}', [DebtLoanController::class, 'destroy']);
    Route::post('{id}/settle', [DebtLoanController::class, 'settle']);
});

// Auth-required: PIN change with email-OTP gate (5min code, 3/day limit)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/pin-change/request-otp', [AuthController::class, 'requestPinChangeOtp']);
    Route::post('/pin-change/verify', [AuthController::class, 'verifyPinChangeOtp']);
});

Route::get('version', [AppVersionController::class, 'get'])->middleware('auth:sanctum');

Route::prefix('user')->middleware('auth:sanctum')->group(function () {
    Route::get('all', [UserController::class, 'getAll']);
    Route::get('isAdmin', [UserController::class, 'checkIfAdmin']);
    Route::get('settings', [UserController::class, 'getSettings']);
    Route::get('currencies', [UserController::class, 'getCurrencies']);
    Route::get('currencies/all', [UserController::class, 'getAllCurrencies']);
    Route::get('{id?}', [UserController::class, 'get']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('settings', [UserController::class, 'updateSettings']);
    Route::post('currencies', [UserController::class, 'createCurrency']);
    Route::post('currencies/{id}', [UserController::class, 'updateCurrency']);
    Route::post('{id}', [UserController::class, 'update']);
});

Route::prefix('account')->middleware('auth:sanctum')->group(function () {
    Route::get('', [AccountController::class, 'get']);
    Route::get('type', [AccountController::class, 'getTypes']);
    // Removed: Route::get('{id}/stocks', ...) — AccountController::getStocks
    // was never implemented. Calls would throw BadMethodCallException at runtime.
    Route::get('{id}/record', [AccountController::class, 'getRecords']);
    Route::get('{id}/record/last{number}', [AccountController::class, 'getLastRecords']);
    Route::get('currencies', [AccountController::class, 'getCurrencies']);
    Route::get('{id}', [AccountController::class, 'getById']);
    Route::post('', [AccountController::class, 'create']);
    Route::post('reorder', [AccountController::class, 'reorder']);
    Route::post('{id}/adjust', [AccountController::class, 'adjustBalance']);
    Route::post('{id}', [AccountController::class, 'update']);
    Route::delete('{id}', [AccountController::class, 'delete']);
});

Route::prefix('record')->middleware('auth:sanctum')->group(function () {
    Route::get('', [RecordController::class, 'get']);
    Route::get('last', [RecordController::class, 'getLastRecords']);
    Route::get('category/{id}', [RecordController::class, 'getRecordsByCategory']);
    Route::get('{id}', [RecordController::class, 'getById']);
    Route::post('', [RecordController::class, 'create']);
    Route::post('{id}', [RecordController::class, 'update']);
    Route::delete('{id}', [RecordController::class, 'delete']);
});

Route::prefix('category')->middleware('auth:sanctum')->group(function () {
    Route::get('', [CategoryController::class, 'get']);
    Route::get('parent', [CategoryController::class, 'getParent']);
    Route::get('{id}', [CategoryController::class, 'getById']);
    Route::get('by-parent/{id}', [CategoryController::class, 'getByParentId']);
    Route::get('parent/{id}', [CategoryController::class, 'getParentById']);
    Route::post('', [CategoryController::class, 'create']);
    Route::post('{id}', [CategoryController::class, 'update']);
});

Route::prefix('balance')->middleware('auth:sanctum')->group(function () {
    Route::get('', [BalanceController::class, 'getBalance']);
    Route::get('all', [BalanceController::class, 'getAll']);
    Route::get('expenses', [BalanceController::class, 'getExpensesBalance']);
    Route::get('timeline', [BalanceController::class, 'getTimeline']);
    Route::get('category', [BalanceController::class, 'getBalanceByCategory']);
    Route::get('categories/income', [BalanceController::class, 'getByIncomeCategories']);
    Route::get('categories/expense', [BalanceController::class, 'getByExpenseCategories']);
    Route::get('categories/top', [BalanceController::class, 'getTopExpenses']);
    Route::get('subcategories/{id}', [BalanceController::class, 'getBySubcategories']);
    Route::get('subcategories/{id}/account/{accountId}', [BalanceController::class, 'getBySubcategoriesAndAccount']);
});

Route::prefix('import')->middleware('auth:sanctum')->group(function () {
    Route::post('', [ImportController::class, 'import']);
});

Route::prefix('budget')->middleware('auth:sanctum')->group(function () {
    Route::get('', [BudgetController::class, 'getAll']);
    Route::get('{id}', [BudgetController::class, 'getById']);
    Route::post('', [BudgetController::class, 'create']);
    Route::post('{id}', [BudgetController::class, 'update']);
    Route::delete('{id}', [BudgetController::class, 'delete']);
});


Route::prefix('ai')->middleware('auth:sanctum')->group(function () {
    Route::post('/predict-category', [AiController::class, 'predictCategoryRequest']);
});

Route::prefix('api-keys')->middleware('auth:sanctum')->group(function () {
    Route::get('', [ApiKeyController::class, 'index']);
    Route::post('', [ApiKeyController::class, 'store']);
    Route::delete('{id}', [ApiKeyController::class, 'destroy']);
});

Route::prefix('notification')->middleware('auth:sanctum')->group(function () {
    Route::get('', [NotificationController::class, 'index']);
    Route::get('unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('read-all', [NotificationController::class, 'markAllRead']);
    Route::post('{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('{id}', [NotificationController::class, 'delete']);
});

Route::prefix('upcoming-expenses')->middleware('auth:sanctum')->group(function () {
    Route::get('', [UpcomingExpenseController::class, 'getAll']);
    Route::get('{id}', [UpcomingExpenseController::class, 'getById']);
    Route::post('', [UpcomingExpenseController::class, 'create']);
    Route::post('{id}', [UpcomingExpenseController::class, 'update']);
    Route::delete('{id}', [UpcomingExpenseController::class, 'delete']);
});

Route::prefix('v1/external')->middleware('auth.apikey')->group(function () {
    // Records CRUD
    Route::get('records', [ExternalApiController::class, 'getRecords']);
    Route::get('records/{id}', [ExternalApiController::class, 'getRecord']);
    Route::post('records', [ExternalApiController::class, 'createRecord']);
    Route::put('records/{id}', [ExternalApiController::class, 'updateRecord']);
    Route::delete('records/{id}', [ExternalApiController::class, 'deleteRecord']);

    // Accounts (read-only)
    Route::get('accounts', [ExternalApiController::class, 'getAccounts']);
    Route::get('accounts/{id}', [ExternalApiController::class, 'getAccount']);
    Route::get('account-types', [ExternalApiController::class, 'getAccountTypes']);

    // Categories (read-only)
    Route::get('categories', [ExternalApiController::class, 'getCategories']);
    Route::get('categories/{id}', [ExternalApiController::class, 'getCategory']);
    Route::get('parent-categories', [ExternalApiController::class, 'getParentCategories']);
    Route::get('parent-categories/{id}', [ExternalApiController::class, 'getParentCategory']);
    Route::get('parent-categories/{id}/categories', [ExternalApiController::class, 'getCategoriesByParent']);
});

