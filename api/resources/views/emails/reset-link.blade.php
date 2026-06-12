<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Đặt lại mật khẩu BudgetBee</title>
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

                            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                                Bạn vừa yêu cầu đặt lại mật khẩu BudgetBee. Nhấn nút bên dưới để chọn mật khẩu mới —
                                liên kết sẽ mở thẳng ứng dụng BudgetBee trên thiết bị của bạn.
                            </p>

                            <div style="text-align:center;margin:32px 0;">
                                <a href="{{ $resetUrl }}"
                                   style="display:inline-block;background:#1C1C1E;color:#BDE83E;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;">
                                    Đặt lại mật khẩu
                                </a>
                            </div>

                            <p style="margin:16px 0;font-size:13px;color:rgba(28,28,30,0.6);line-height:1.6;">
                                Nếu nút không hoạt động, sao chép và dán liên kết sau vào trình duyệt trên điện thoại:
                            </p>
                            <p style="margin:0 0 24px;font-size:12px;color:rgba(28,28,30,0.55);line-height:1.5;word-break:break-all;">
                                {{ $resetUrl }}
                            </p>

                            <p style="margin:16px 0;font-size:14px;color:rgba(28,28,30,0.7);line-height:1.6;">
                                Liên kết có hiệu lực trong <strong>{{ $minutes }} phút</strong> và chỉ dùng được
                                <strong>một lần</strong>. Đừng chia sẻ liên kết này với bất kỳ ai — bất kỳ ai có liên kết
                                đều có thể đổi mật khẩu tài khoản của bạn.
                            </p>

                            <p style="margin:24px 0 0;font-size:13px;color:rgba(28,28,30,0.5);line-height:1.6;">
                                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại của bạn
                                vẫn an toàn và không có gì thay đổi.
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
