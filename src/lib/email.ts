/**
 * Send emails via Nodemailer. Configure with env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
 * Do not await in auth callbacks to avoid timing attacks; fire-and-forget is intentional.
 */
import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "noreply@example.com";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[email] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will not be sent."
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number.isNaN(port) ? 587 : port,
    secure: port === 465,
    auth: { user, pass },
  });
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined = undefined;

function transport() {
  if (transporter === undefined) transporter = getTransporter();
  return transporter;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const t = transport();
  if (!t) return;

  try {
    await t.sendMail({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  } catch (err) {
    console.error("[email] Send failed:", err);
    throw err;
  }
}

/** Call from auth callbacks without awaiting to avoid timing attacks. */
export function sendEmailInBackground(options: SendEmailOptions): void {
  void sendEmail(options).catch((err) => {
    console.error("[email] Background send failed:", err);
  });
}
