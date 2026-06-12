<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email chứa "magic link" đặt lại mật khẩu (Tầng 2).
 *
 * $resetUrl đã bao gồm token thô trong query string — đây là DUY NHẤT nơi token
 * tồn tại bên ngoài URL. Mailable này không log, không lưu lại; token đi thẳng
 * từ PasswordResetLinkService::issue() vào view rồi ra inbox người dùng.
 */
class SendResetLinkMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $resetUrl,
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '[BudgetBee] Đặt lại mật khẩu');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reset-link',
            with: [
                'name' => $this->user->name,
                'resetUrl' => $this->resetUrl,
                'minutes' => $this->minutes,
            ],
        );
    }
}
