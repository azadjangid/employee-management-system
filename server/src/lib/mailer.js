import { config } from "../config.js";

/**
 * Placeholder mailer. No email provider is configured yet, so messages are
 * printed to the server console. Swap the body for nodemailer / an email API
 * when you're ready to send real email.
 */
export async function sendMail({ to, subject, text }) {
  if (!config.isTest) {
    console.log(`\n--- Email to ${to} ---\nSubject: ${subject}\n\n${text}\n---------------\n`);
  }
}
