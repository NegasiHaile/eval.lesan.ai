// lib/mailer.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  //   host: "smtp.gmail.com", //process.env.SMTP_HOST!,
  service: process.env.SMTP_SERVICE,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
  secure: Boolean(process.env.SMTP_SECURE || "false"), // Use TLS on port 587
});

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function sendResetEmail(route: string, to: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${route}?token=${token}`;
  const expirationInMns = process.env.FORGET_PASSWORD_TOKEN_EXPIRATION
    ? parseInt(process.env.FORGET_PASSWORD_TOKEN_EXPIRATION, 10) / 60000
    : 30; // Default to 30 minutes if not set

  const title = capitalizeFirst(route.replace("-", " "));

  const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${process.env.APP_NAME}-${title}</title>
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
                                  
                                  <p style="font-size: 32px; text-align: center; font-weight: 600; color: #1a202c; margin: 12px 0px;">${
                                    process.env.APP_NAME
                                  }</p>
                              </td>
                          </tr>
                          
                          <!-- Main Content -->
                          <tr>
                              <td style="padding: 40px 30px;">
                                  <h1 style="font-size: 24px; font-weight: 600; color: #1a202c; margin: 0 0 20px 0; text-transform: capitalize;">${title}</h1>
                                  <p style="font-size: 16px; line-height: 1.6; color: #4a5568; margin: 0 0 24px 0;">
                                      You have requested to ${title.toLowerCase()} for your <strong>${
    process.env.APP_NAME
  }</strong> account. Please click the button below to proceed. This link is valid for <strong>${expirationInMns}</strong> minutes.
                                  </p>
                                  
                                  <!-- Call-to-Action Button -->
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
                                      <tr>
                                          <td align="center" bgcolor="#2563eb" style="border-radius: 6px;">
                                              <a href="${resetUrl}" target="_blank" style="font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; text-transform: capitalize;">
                                                  ${route.replace("-", " My ")}
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
                                      You are receiving this email because a ${title.toLowerCase()} was requested for your account. If you did not request this, you can safely ignore this email.
                                  </p>
                                  <p style="font-size: 14px; font-weight: bold; color: #718096; margin: 15px 0 0 0;">
                                      ${process.env.APP_NAME} - ${
    process.env.APP_DESCRIPTION
  }
                                  </p>
                                  <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                      ${
                                        process.env.APP_VERSION
                                      } | ${new Date().getFullYear()} &copy; All rights reserved.
                                  </p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `;

  const subject = capitalizeFirst(
    route.replace("-", ` Your ${process.env.APP_NAME ?? ""} `)
  );

  const mailOptions = {
    from: `${process.env.FROM_NAME} ${process.env.FROM_EMAIL!}`,
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendTaskAssignmentEmail({
  to,
  batchName,
  taskName,
  assigneeName,
}: {
  to: string;
  batchName: string;
  taskName: string;
  assigneeName: string;
}) {
  const signInUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/auth`;
  const appName = process.env.APP_NAME || "Evaluation APP";
  const currentYear = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName} - Task Assignment</title>
    <style>
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
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="border-bottom: 1px solid #eeeeee;">
                            <p style="font-size: 32px; text-align: center; font-weight: 600; color: #1a202c; margin: 12px 0;">
                                ${appName}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h1 style="font-size: 22px; font-weight: 600; color: #1a202c; margin-bottom: 20px;">
                                You’ve Been Assigned a New Task
                            </h1>
                            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">
                                Hello <strong>${assigneeName}</strong>,
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">
                                You have been assigned a new task titled <strong>"${taskName}"</strong> in the project <strong>"${batchName}"</strong> on <strong>${appName}</strong>.
                            </p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">
                                This task was assigned to you by <strong>${assigneeName}</strong>. Please sign in to <strong>"${appName}"</strong> to view the task details and begin work.
                            </p>

                            <!-- Call to Action -->
                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 30px auto;">
                                <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius: 6px;">
                                        <a href="${signInUrl}" target="_blank" style="font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block;">
                                            Sign In & View Task
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="font-size: 14px; line-height: 1.5; color: #718096;">
                                If you do not recognize this assignment or believe this message was sent to you in error, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 30px; background-color: #f7fafc; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                ${appName} — ${
    process.env.APP_DESCRIPTION || "A productivity platform"
  }
                            </p>
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                ${
                                  process.env.APP_VERSION || "v1.0"
                                } | ${currentYear} &copy; All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  const mailOptions = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to,
    subject: `Task Assigned on ${appName}`,
    html,
  };

  await transporter.sendMail(mailOptions);
}
