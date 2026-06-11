<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Mã xác thực BudgetBee</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1C1E;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F2F4;padding:32px 0;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
                    <tr>
                        <td style="background:#BDE83E;padding:24px;text-align:center;">
                            <div style="font-size:40px;">🐝</div>
                            <div style="font-size:22px;font-weight:700;color:#1C1C1E;margin-top:8px;">BudgetBee</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 16px;font-size:16px;">Xin chào <strong>{{ $name }}</strong>,</p>

                            @if ($purpose === 'register')
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                    Cảm ơn bạn đã đăng ký BudgetBee. Vui lòng nhập mã dưới đây để hoàn tất xác minh tài khoản:
                                </p>
                            @elseif ($purpose === 'reset_password')
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                    Bạn đã yêu cầu đặt lại mật khẩu. Nhập mã sau để xác nhận:
                                </p>
                            @elseif ($purpose === 'sensitive')
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                    BudgetBee phát hiện thao tác bảo mật quan trọng. Nhập mã để xác nhận:
                                </p>
                            @elseif ($purpose === 'change_email')
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                    Bạn đang đổi email tài khoản. Nhập mã sau để xác nhận:
                                </p>
                            @else
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                    Mã xác thực BudgetBee của bạn:
                                </p>
                            @endif

                            <div style="background:#1C1C1E;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                                <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#BDE83E;font-family:Menlo,Consolas,monospace;">
                                    {{ $code }}
                                </div>
                            </div>

                            <p style="margin:16px 0;font-size:14px;color:rgba(28,28,30,0.7);line-height:1.6;">
                                Mã có hiệu lực trong <strong>{{ $minutes }} phút</strong>. Không chia sẻ mã này với bất kỳ ai —
                                BudgetBee sẽ không bao giờ chủ động hỏi mã của bạn qua tin nhắn hay điện thoại.
                            </p>

                            <p style="margin:24px 0 0;font-size:13px;color:rgba(28,28,30,0.5);line-height:1.6;">
                                Nếu bạn không phải người yêu cầu mã này, hãy bỏ qua email — tài khoản của bạn vẫn an toàn.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#FAFAF7;padding:16px 24px;text-align:center;font-size:12px;color:rgba(28,28,30,0.5);">
                            BudgetBee — Quản lý tài chính thông minh
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
