<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SendOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $code,
        public string $purpose = 'register',
    ) {}

    public function envelope(): Envelope
    {
        $subject = match ($this->purpose) {
            'register' => '[BudgetBee] Mã xác thực đăng ký',
            'reset_password' => '[BudgetBee] Mã đặt lại mật khẩu',
            'sensitive' => '[BudgetBee] Xác nhận thao tác bảo mật',
            'change_email' => '[BudgetBee] Xác nhận đổi email',
            default => '[BudgetBee] Mã xác thực',
        };
        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp',
            with: [
                'name' => $this->user->name,
                'code' => $this->code,
                'purpose' => $this->purpose,
                'minutes' => (int) config('otp.expire_minutes', 10),
            ],
        );
    }
}
