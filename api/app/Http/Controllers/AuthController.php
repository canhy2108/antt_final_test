<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use App\Events\UserCreated;
use App\Models\Types\Currency;

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

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|string|max:255|email|unique:users',
            'password' => $this->passwordRules(),
            'confirm_password' => 'required|string|same:password',
        ]);

        // Hash::make() uses bcrypt by default with cost from config('hashing')
        // Recommended config: 'driver' => 'argon2id', work factor depending on hardware
        User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);

        $this->auditLog('user_registered', $request->input('email'));
        return response()->json(['message' => 'User created successfully']);
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

        User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);

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

        // Revoke any existing tokens for this device fingerprint (optional)
        $tokenName = $request->header('X-Device-Id') ?? 'auth_token';
        $token = $user->createToken($tokenName, ['*'], now()->addMinutes(30))->plainTextToken;

        $this->auditLog('login_success', $user->email, [
            'ip' => $request->ip(),
            'user_id' => $user->id,
        ]);

        // Set HttpOnly cookie alongside JSON response for SPA + mobile compatibility
        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 1800,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ])->cookie(
            'access_token',                       // name
            $token,                               // value
            30,                                   // minutes
            '/',                                  // path
            null,                                 // domain (null = current)
            request()->secure(),                  // secure: HTTPS only in prod
            true,                                 // HttpOnly — no JS access
            false,                                // raw
            'lax'                                 // SameSite: lax (CSRF protection)
        );
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $user->tokens()->delete(); // Revoke ALL tokens for this user
            $this->auditLog('logout', $user->email);
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
