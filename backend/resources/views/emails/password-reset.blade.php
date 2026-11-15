<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:Arial,Helvetica,sans-serif;color:#1E293B;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
                    <tr>
                        <td style="background:#1E3A5F;padding:24px 32px;">
                            <span style="color:#FFFFFF;font-size:18px;font-weight:bold;letter-spacing:0.5px;">URIOS CLINIC</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h2 style="margin:0 0 12px;font-size:20px;color:#0F172A;">Reset Your Password</h2>
                            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">
                                Hi {{ $user->first_name ?? $user->name ?? 'there' }},<br><br>
                                We received a request to reset the password for your clinic account
                                ({{ $user->email }}). This link expires in <strong>60 minutes</strong>.
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                                <tr>
                                    <td style="background:#2563EB;border-radius:8px;">
                                        <a href="{{ $resetUrl }}" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#94A3B8;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="{{ $resetUrl }}" style="color:#2563EB;word-break:break-all;">{{ $resetUrl }}</a>
                            </p>
                            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94A3B8;">
                                If you didn't request a password reset, you can safely ignore this email —
                                your password will not be changed.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
                            <span style="font-size:11px;color:#94A3B8;">&copy; {{ date('Y') }} Urios University Clinic. All rights reserved.</span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
