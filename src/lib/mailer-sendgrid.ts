// lib/mailer.ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendResetEmail(to: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;

  const msg = {
    to,
    from: process.env.SENDGRID_SENDER_EMAIL!,
    subject: "Reset Your HornEval Password",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
              /* Basic responsive styles for clients that support them */
              @media screen and (max-width: 600px) {
                  .container {
                      width: 100% !important;
                      padding: 10px !important;
                  }
              }
          </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                  <td style="padding: 20px 0;">
                      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                          <!-- Header with Logo -->
                          <tr>
                              <td align="center" style="border-bottom: 1px solid #eeeeee;">
                                  
                                  <p style="font-size: 32px; text-align: center; font-weight: 600; color: #1a202c; margin: 12px 0px;">HornEval</p>
                              </td>
                          </tr>
                          
                          <!-- Main Content -->
                          <tr>
                              <td style="padding: 40px 30px;">
                                  <h1 style="font-size: 24px; font-weight: 600; color: #1a202c; margin: 0 0 20px 0;">Reset Your Password</h1>
                                  <p style="font-size: 16px; line-height: 1.6; color: #4a5568; margin: 0 0 24px 0;">
                                      You have requested to reset the password for your <strong>HornEval</strong> account. Please click the button below to proceed. This link is valid for 60 minutes.
                                  </p>
                                  
                                  <!-- Call-to-Action Button -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                                      <tr>
                                          <td align="center" bgcolor="#2563eb" style="border-radius: 6px;">
                                              <a href="${resetUrl}" target="_blank" style="font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block;">
                                                  Reset My Password
                                              </a>
                                          </td>
                                      </tr>
                                  </table>

                                  <p style="font-size: 14px; line-height: 1.5; color: #718096; margin: 30px 0 10px 0;">
                                      If the button above doesn't work, you can copy and paste this link into your browser:
                                  </p>
                                  <p style="font-size: 12px; color: #a0aec0; word-break: break-all; margin: 0;">
                                      <a href="${resetUrl}" style="color: #4299e1; text-decoration: underline;">${resetUrl}</a>
                                  </p>
                              </td>
                          </tr>
                          
                          <!-- Footer -->
                          <tr>
                              <td align="center" style="padding: 20px 30px; background-color: #f7fafc; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
                                  <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                      You are receiving this email because a password reset was requested for your account. If you did not request this, you can safely ignore this email.
                                  </p>
                                  <p style="font-size: 14px; font-weight: bold; color: #718096; margin: 15px 0 0 0;">
                                      HornEval - Machine Translation Leaderboard/Evaluation
                                  </p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `,
  };

  await sgMail.send(msg);
}
