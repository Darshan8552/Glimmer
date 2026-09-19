import { BrevoClient } from "@getbrevo/brevo";
import { requiredEnv } from "./env";

let emailConfig: { client: BrevoClient; senderEmail: string; senderName: string } | null = null;

function getEmailConfig() {
  if (!emailConfig) {
    emailConfig = {
      client: new BrevoClient({ apiKey: requiredEnv("BREVO_API_KEY") }),
      senderEmail: requiredEnv("BREVO_SENDER_EMAIL"),
      senderName: requiredEnv("BREVO_SENDER_NAME"),
    };
  }
  return emailConfig;
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: EmailParams): Promise<void> {
  const { client, senderEmail, senderName } = getEmailConfig();
  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Email delivery failed");
  }
}

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

export async function sendOtpEmail(
  email: string,
  otp: string,
  type: OtpType
): Promise<void> {
  const subjects: Record<OtpType, string> = {
    "sign-in": "Your Glimmer sign-in code",
    "email-verification": "Verify your Glimmer account",
    "forget-password": "Reset your Glimmer password",
    "change-email": "Confirm your new email address",
  };

  const subject = subjects[type];

  const messages: Record<OtpType, { title: string; body: string }> = {
  "sign-in": {
    title: "Sign in to Glimmer",
    body: "Use the 6-digit code below to sign in to your Glimmer account.",
  },
  "email-verification": {
    title: "Verify your email",
    body: "Enter the 6-digit code below to verify your email address and complete your registration.",
  },
  "forget-password": {
    title: "Reset your password",
    body: "Enter the 6-digit code below to reset your Glimmer password.",
  },
  "change-email": {
    title: "Confirm your new email",
    body: "Enter the 6-digit code below to confirm your new email address.",
  },
};

const { title, body } = messages[type];

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <tr>
      <td style="padding: 40px 32px; text-align: center;">
        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #111827;">
          ${title}
        </h1>
        <p style="margin: 0 0 24px; font-size: 16px; color: #6b7280; line-height: 1.5;">
          ${body}
        </p>

        <div style="display: inline-block; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 32px; margin: 16px 0;">
          <span style="font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">
            ${otp}
          </span>
        </div>

        <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">
          This code expires in 5 minutes. If you didn't request this, please ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
          &copy; ${new Date().getFullYear()} Glimmer. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({ to: email, subject, html });
}
