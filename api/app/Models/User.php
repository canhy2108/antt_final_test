<?php

namespace App\Models;

use App\Events\UserCreated;
use App\Models\Types\Currency;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'currency_id',
        // Chỉ giữ MỐC THỜI GIAN đăng ký sinh trắc (để UI hiển thị "đã bật").
        // KHÔNG còn lưu ảnh khuôn mặt thô / chữ ký thời gian — xem migration
        // 2026_06_11_120000_drop_face_image_from_users. Sinh trắc thật do OS
        // (Secure Enclave / Keystore) quản lý, server không chạm dữ liệu thô.
        'face_enrolled_at',
        'fingerprint_enrolled_at',
        'last_login_at',
        'login_count',
    ];

    protected $appends = ['currency_symbol'];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'currency',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public static function boot()
    {
        parent::boot();

        static::created(function ($user) {
            Log::info("Created {$user->getTable()} with ID {$user->id}");
            static::withoutEvents(function () use ($user) {
                event(new UserCreated($user));
                // BudgetBee là app VN — ưu tiên VND, fallback USD nếu seed thiếu.
                $defaultCurrency = Currency::where('code', 'VND')->first()
                    ?? Currency::where('code', 'USD')->first();
                if (!$defaultCurrency) {
                    Log::warning("No default currency (VND/USD) found — skipping UserCurrency seed for user {$user->id}");
                    return;
                }
                $currency = UserCurrency::create([
                    'user_id' => $user->id,
                    'currency_id' => $defaultCurrency->id,
                    'exchange_rate_to_default_currency' => 1
                ]);
                $user->fill(['currency_id' => $currency->id])
                    ->save();
            });
        });

        static::creating(function ($model) {
            Cache::flush();
            Log::info("Creating a new {$model->getTable()}");
        });

        static::updating(function ($model) {
            Cache::flush();
            Log::info("Updating {$model->getTable()} with ID {$model->id}");
        });

        static::deleting(function ($model) {
            Cache::flush();
            Log::info("Deleting {$model->getTable()} with ID {$model->id}");
        });
    }

    public function currency()
    {
        return $this->belongsTo(UserCurrency::class, 'currency_id', 'id');
    }

    public function getCurrencySymbolAttribute()
    {
        return $this->currency ? $this->currency->symbol : '';
    }

    public function getSettings()
    {
        if (!$this->currency) {
            return [
                'currency' => [
                    'id' => '',
                    'name' => '',
                    'code' => '',
                    'symbol' => ''
                ]
            ];
        }

        return [
            'currency' => [
                'id' => $this->currency->id,
                'name' => $this->currency->name,
                'code' => $this->currency->code,
                'symbol' => $this->currency->symbol
            ]
        ];
    }
}
