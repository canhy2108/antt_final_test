<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use App\Events\UserCreated;
use App\Models\Types\Currency;
use App\Models\RefreshToken;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Validation rules for password — modern NIST 800-63B compliant
     * - Min 12 chars (passphrase friendly)
     * - Max 128 chars (allow long passphrases)
     * - Must NOT be in compromised password list (haveibeenpwned)
     * - Allow ALL chars including unicode + spaces (no arbitrary char restrictions)
     */
    private function passwordRules(): array
    {
        return [
            'required',
            'string',
            Password::min(12)
                ->max(128)
                ->uncompromised(),  // Checks against HaveIBeenPwned via k-anonymity
        ];
    }

    /**
     * Admin-create-user (legacy). Behind auth:sanctum + /user/register.
     * For self-signup with OTP verification, use selfRegister() at /register.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|string|max:255|email|unique:users',
            'password' => $this->passwordRules(),
            'confirm_password' => 'required|string|same:password',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);
        // Admin-created users are implicitly trusted; mark verified so they
        // can log in without bouncing through the OTP loop (the public
        // selfRegister flow handles unverified users via verifyOtp).
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->auditLog('user_registered', $request->input('email'));
        return response()->json(['message' => 'User created successfully']);
    }

    /**
     * PUBLIC self-registration. Creates an UNVERIFIED user and sends an
     * OTP to the email. The account cannot login until verifyOtp() succeeds.
     * In dev (APP_ENV=local + OTP_DEV_RETURN_CODE=true), the code is also
     * returned in the response body for easy testing without real email.
     */
    public function selfRegister(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|string|max:255|email|unique:users',
            'password' => $this->passwordRules(),
            'confirm_password' => 'required|string|same:password',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);

        $otp = OtpService::generate($user, OtpService::PURPOSE_REGISTER, $request->ip());
        OtpService::send($user, $otp);

        $this->auditLog('self_register', $user->email, ['user_id' => $user->id]);

        $payload = [
            'message' => 'Đăng ký thành công. Mã xác thực đã gửi tới email của bạn.',
            'email' => $user->email,
            'expires_in_minutes' => (int) config('otp.expire_minutes', 10),
            'requires_verification' => true,
        ];

        if (config('otp.dev_return_code')) {
            $payload['dev_otp_code'] = $otp->code;
        }

        return response()->json($payload, 201);
    }

    /**
     * Verify a registration OTP. On success: marks email_verified_at and
     * issues a Sanctum token so the client can proceed to logged-in state.
     */
    public function verifyOtp(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|min:4|max:10',
        ]);

        $user = User::where('email', strtolower($validated['email']))->first();
        if ($user === null) {
            return response()->json(['message' => 'Email không tồn tại'], 404);
        }

        if (!OtpService::verify($user, $validated['code'], OtpService::PURPOSE_REGISTER)) {
            $this->auditLog('otp_verify_failed', $user->email, ['ip' => $request->ip()]);
            return response()->json([
                'message' => 'Mã xác thực không đúng hoặc đã hết hạn',
            ], 422);
        }

        // Bypass fillable for the verified-at marker
        $user->forceFill(['email_verified_at' => now()])->save();

        $tokenName = $request->header('X-Device-Id') ?? 'auth_token';
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        // Create a refresh token (rotation-ready)
        $refreshPlain = bin2hex(random_bytes(32));
        RefreshToken::create([
            'jti' => (string) Str::uuid(),
            'user_id' => $user->id,
            'device_id' => $request->header('X-Device-Id') ?? null,
            'token_hash' => hash('sha256', $refreshPlain),
            'is_revoked' => false,
            'expires_at' => now()->addDays(30),
        ]);

        $this->auditLog('otp_verify_success', $user->email, ['user_id' => $user->id]);

        return response()->json([
            'access_token' => $token,
            'refresh_token' => $refreshPlain,
            'token_type' => 'Bearer',
            'expires_in' => 2592000, // 30 days, matches addDays(30) above
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Resend a registration OTP. Rate-limited via OtpService::hasHitResendLimit.
     * Does NOT leak account existence — responds 200 even when the email is
     * not registered.
     */
    public function resendOtp(Request $request)
    {
        $validated = $request->validate(['email' => 'required|email']);

        $user = User::where('email', strtolower($validated['email']))->first();
        if ($user === null) {
            return response()->json(['message' => 'Mã đã được gửi nếu email tồn tại.']);
        }

        if (OtpService::hasHitResendLimit($user, OtpService::PURPOSE_REGISTER)) {
            return response()->json([
                'message' => 'Bạn đã yêu cầu mã quá nhiều lần. Vui lòng đợi.',
            ], 429);
        }

        $otp = OtpService::generate($user, OtpService::PURPOSE_REGISTER, $request->ip());
        OtpService::send($user, $otp);

        $this->auditLog('otp_resent', $user->email);

        $payload = ['message' => 'Mã mới đã được gửi.'];
        if (config('otp.dev_return_code')) {
            $payload['dev_otp_code'] = $otp->code;
        }

        return response()->json($payload);
    }

    /**
     * Auth-required: request an OTP for a sensitive action (change password,
     * change email, delete account, large transaction). Frontend should
     * include the OTP code in the body of the sensitive endpoint, which
     * server-side verifies via OtpService::verify(..., PURPOSE_SENSITIVE).
     */
    public function requestSensitiveOtp(Request $request)
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if (OtpService::hasHitResendLimit($user, OtpService::PURPOSE_SENSITIVE)) {
            return response()->json([
                'message' => 'Bạn đã yêu cầu mã quá nhiều lần. Vui lòng đợi.',
            ], 429);
        }

        $otp = OtpService::generate($user, OtpService::PURPOSE_SENSITIVE, $request->ip());
        OtpService::send($user, $otp);

        $this->auditLog('sensitive_otp_requested', $user->email);

        $payload = [
            'message' => 'Mã xác nhận đã được gửi tới email của bạn.',
            'expires_in_minutes' => (int) config('otp.expire_minutes', 10),
        ];

        if (config('otp.dev_return_code')) {
            $payload['dev_otp_code'] = $otp->code;
        }

        return response()->json($payload);
    }

    public function setupCheck()
    {
        return response()->json(['setup_completed' => User::count() > 0]);
    }

    public function setupRegister(Request $request)
    {
        if (User::count() > 0) {
            return response()->json(['message' => 'Setup already completed'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|string|max:255|email|unique:users',
            'password' => $this->passwordRules(),
            'confirm_password' => 'required|string|same:password',
        ]);

        // First-account / admin bootstrap is auto-verified (no OTP loop here).
        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->auditLog('admin_setup', $request->input('email'));
        return response()->json(['message' => 'User created successfully']);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Rate limiter — 5 attempts per 15 minutes per (email + IP) pair
        $key = 'login_' . strtolower($request->input('email')) . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            $this->auditLog('login_rate_limited', $request->input('email'), [
                'ip' => $request->ip(),
                'retry_after' => $seconds,
            ]);
            return response()->json([
                'message' => "Quá nhiều lần thử. Vui lòng đợi {$seconds} giây.",
                'retry_after' => $seconds,
            ], 429);
        }

        if (!Auth::attempt($request->only('email', 'password'))) {
            RateLimiter::hit($key, 60 * 15); // 15 min lockout window
            $this->auditLog('login_failed', $request->input('email'), [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            return response()->json(['message' => 'Email hoặc mật khẩu không đúng'], 401);
        }

        RateLimiter::clear($key);

        $user = User::where('email', strtolower($request->input('email')))->firstOrFail();

        // Gate: account must be email-verified before login is allowed.
        if ($user->email_verified_at === null) {
            // Auto-trigger a fresh OTP so the user has a code waiting in their inbox.
            $otp = OtpService::generate($user, OtpService::PURPOSE_REGISTER, $request->ip());
            OtpService::send($user, $otp);

            $this->auditLog('login_blocked_unverified', $user->email);

            $payload = [
                'message' => 'Email chưa được xác thực. Mã OTP đã gửi tới email của bạn.',
                'requires_verification' => true,
                'email' => $user->email,
            ];
            if (config('otp.dev_return_code')) {
                $payload['dev_otp_code'] = $otp->code;
            }
            return response()->json($payload, 403);
        }

        $tokenName = $request->header('X-Device-Id') ?? 'auth_token';
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        // Issue a refresh token so the client can call POST /auth/refresh
        // before the access token expires. Stored hashed; only the plaintext
        // is returned here, exactly once. Previously this code referenced an
        // undefined `$refreshPlain` and crashed with PHP 8 "Undefined variable".
        $refreshPlain = bin2hex(random_bytes(32));
        RefreshToken::create([
            'jti' => (string) Str::uuid(),
            'user_id' => $user->id,
            'device_id' => $request->header('X-Device-Id') ?? null,
            'token_hash' => hash('sha256', $refreshPlain),
            'is_revoked' => false,
            'expires_at' => now()->addDays(30),
        ]);

        $this->auditLog('login_success', $user->email, [
            'ip' => $request->ip(),
            'user_id' => $user->id,
        ]);

        return response()->json([
            'access_token' => $token,
            'refresh_token' => $refreshPlain,
            'token_type' => 'Bearer',
            'expires_in' => 2592000, // 30 days, matches addDays(30) above
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ])->cookie(
            'access_token',
            $token,
            30,
            '/',
            null,
            request()->secure(),
            true,
            false,
            'lax'
        );
    }

    /**
     * Request an OTP to confirm a PIN change. The actual PIN never leaves the
     * device — server only gates the change with email-OTP.
     *
     * Rules:
     *   - Code expires in 5 minutes (config/otp.pin_change_expire_minutes)
     *   - User can request at most 3 codes per 24 hours
     *   - Each code allows up to 5 wrong attempts (OtpService::verify)
     */
    public function requestPinChangeOtp(Request $request)
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $count = OtpService::countLastDay($user, OtpService::PURPOSE_CHANGE_PIN);
        $dailyLimit = OtpService::dailyLimitFor(OtpService::PURPOSE_CHANGE_PIN);
        if ($count >= $dailyLimit) {
            $this->auditLog('pin_change_daily_limit', $user->email, ['count' => $count]);
            return response()->json([
                'message' => "Bạn đã yêu cầu đổi PIN {$dailyLimit} lần hôm nay. Vui lòng thử lại vào ngày mai.",
                'daily_limit_reached' => true,
            ], 429);
        }

        $otp = OtpService::generate($user, OtpService::PURPOSE_CHANGE_PIN, $request->ip());
        OtpService::send($user, $otp);

        $this->auditLog('pin_change_otp_requested', $user->email, [
            'attempts_today' => $count + 1,
            'daily_limit' => $dailyLimit,
        ]);

        $payload = [
            'message' => 'Mã OTP đã được gửi tới email của bạn.',
            'expires_in_minutes' => (int) config('otp.pin_change_expire_minutes', 5),
            'attempts_remaining' => $dailyLimit - ($count + 1),
        ];

        if (config('otp.dev_return_code')) {
            $payload['dev_otp_code'] = $otp->code;
        }

        return response()->json($payload);
    }

    /**
     * Verify the PIN-change OTP. Returns 200 if correct — the FE then writes
     * the new PIN hash into secure-store locally. No new PIN is sent here.
     */
    public function verifyPinChangeOtp(Request $request)
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'code' => 'required|string|min:4|max:10',
        ]);

        if (!OtpService::verify($user, $validated['code'], OtpService::PURPOSE_CHANGE_PIN)) {
            $this->auditLog('pin_change_otp_failed', $user->email, ['ip' => $request->ip()]);
            return response()->json([
                'message' => 'Mã OTP không đúng hoặc đã hết hạn',
            ], 422);
        }

        $this->auditLog('pin_change_otp_verified', $user->email);

        return response()->json([
            'message' => 'Xác thực thành công. Vui lòng đặt mã PIN mới.',
            'valid_until' => now()->addMinutes(5)->toIso8601String(), // hint for FE
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            // Revoke ONLY the current device's token. Previously this nuked
            // every Sanctum token for the user, silently logging them out of
            // every other device on a simple "log out" tap.
            $current = $user->currentAccessToken();
            if ($current) {
                $current->delete();
            }
            $this->auditLog('logout', $user->email, [
                'token_id' => $current?->id,
            ]);
        }
        return response()->json(['message' => 'Successfully logged out'])
            ->withCookie(cookie()->forget('access_token'));
    }

    /**
     * Audit logging — never include sensitive data (password, full token)
     */
    private function auditLog(string $event, string $email, array $context = []): void
    {
        Log::channel('audit')->info($event, array_merge([
            'event' => $event,
            'email_hash' => hash('sha256', strtolower($email)),
            'timestamp' => now()->toIso8601String(),
        ], $context));
    }
}
