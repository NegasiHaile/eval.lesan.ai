/**
 * HTML and plain-text email templates for verification and password reset.
 * Security: no sensitive data in body; only the single-use link. Expiry stated for reset.
 */

const APP_NAME = "Horn Eval";
const BUTTON_COLOR = "#2563eb";
const FOOTER_COLOR = "#6b7280";

function baseLayout(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${preheader ? `<meta name="description" content="${escapeHtml(preheader)}">` : ""}
  <title>${escapeHtml(APP_NAME)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f3f4f6;color:#111827;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
      <tr>
        <td style="padding:32px 24px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:18px;font-weight:600;color:#111827;">${escapeHtml(APP_NAME)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          ${content}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;text-align:center;font-size:12px;color:${FOOTER_COLOR};border-top:1px solid #e5e7eb;">
          This email was sent by ${escapeHtml(APP_NAME)}. If you didn't request it, you can ignore it.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getVerificationEmailHtml(url: string, userName?: string | null): string {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#374151;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#374151;">Please verify your email address by clicking the button below. This helps us keep your account secure.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background-color:${BUTTON_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">Verify email</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:8px 0 0;word-break:break-all;font-size:12px;color:#6b7280;">${escapeHtml(url)}</p>
  `;
  return baseLayout(content, "Verify your email address");
}

export function getVerificationEmailText(url: string): string {
  return `Verify your email address by visiting this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`;
}

export function getResetPasswordEmailHtml(url: string, userName?: string | null): string {
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#374151;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#374151;">We received a request to reset your password. Click the button below to choose a new password.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background-color:${BUTTON_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">Reset password</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">This link expires in 1 hour and can only be used once.</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">If you didn't request a password reset, ignore this email. Your password will stay the same.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:8px 0 0;word-break:break-all;font-size:12px;color:#6b7280;">${escapeHtml(url)}</p>
  `;
  return baseLayout(content, "Reset your password");
}

export function getResetPasswordEmailText(url: string): string {
  return `Reset your password by visiting this link (valid for 1 hour, one-time use):\n\n${url}\n\nIf you didn't request this, ignore this email. Your password will stay the same.`;
}
