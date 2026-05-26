<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\Factory;
use Database\Factories\AccountFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Services\CurrencyConverter;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class Account extends Model
{
    use SoftDeletes;
    use HasFactory;
    /**
     * The attributes that are mass assignable.
     *
     * @var string[]
     */
    protected $fillable = [
        'user_id', 'name', 'type_id', 'color', 'initial_balance', 'current_balance', 'currency_id', 'position'
    ];

    protected $appends = ['type_name', 'balance', 'balance_base_currency', 'total_incomes', 'total_incomes_base_currency', 'total_expenses', 'total_expenses_base_currency', 'currency_symbol', 'currency_name', 'currency_code', 'initial_balance_base_currency'];

    protected $hidden = ['type', 'currency'];

    public static function boot()
    {
        parent::boot();

        static::creating(function () {
            Cache::flush();
        });

        static::updating(function () {
            Cache::flush();
        });

        static::deleting(function () {
            Cache::flush();
        });
    }

    protected static function newFactory(): Factory
    {
        return AccountFactory::new();
    }

    public function type()
    {
        return $this->belongsTo(AccountTypes::class);
    }

    public function currency()
    {
        return $this->belongsTo(UserCurrency::class, 'currency_id', 'id');
    }

    public function getTypeNameAttribute()
    {
        return $this->type ? $this->type->name : '';
    }

    public function getCurrencySymbolAttribute()
    {
        return $this->currency ? $this->currency->symbol : '';
    }

    public function getCurrencyNameAttribute()
    {
        return $this->currency ? $this->currency->name : '';
    }

    public function getCurrencyCodeAttribute()
    {
        return $this->currency ? $this->currency->code : '';
    }

    public function getBalanceAttribute()
    {
        // SUM in SQL — was previously pulling every record into PHP and
        // reducing in-memory (N records * N accounts on dashboard load).
        $sum = (float) Record::where('from_account_id', $this->id)->sum('amount');
        return round((float) $this->initial_balance + $sum, 2);
    }

    public function getTotalIncomesAttribute()
    {
        $sum = (float) Record::where('from_account_id', $this->id)
            ->where('type', 'income')
            ->sum('amount');
        return round((float) $this->initial_balance + $sum, 2);
    }

    public function getTotalExpensesAttribute()
    {
        $sum = (float) Record::where('from_account_id', $this->id)
            ->where('type', 'expense')
            ->sum('amount');
        return round((float) $this->initial_balance + $sum, 2);
    }

    public function getBalanceBaseCurrencyAttribute()
    {
        return CurrencyConverter::convert($this->balance, $this->currency);
    }

    public function getTotalIncomesBaseCurrencyAttribute()
    {
        return CurrencyConverter::convert($this->total_incomes, $this->currency);
    }

    public function getTotalExpensesBaseCurrencyAttribute()
    {
        return CurrencyConverter::convert($this->total_expenses, $this->currency);
    }

    public function getInitialBalanceBaseCurrencyAttribute()
    {
        return CurrencyConverter::convert($this->initial_balance, $this->currency);
    }
}
