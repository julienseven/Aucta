import "server-only";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { logger } from "@/lib/logger";
import nodemailer from "nodemailer";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/* Transactional email transport.
   - With SMTP configured (SMTP_HOST etc.) and `nodemailer` installed, mail is sent.
   - Otherwise every message is persisted to the email_outbox table, which also
     serves as the preview "dev inbox" surfaced at /dev-mail. Nothing is lost. */
export async function sendEmail(email: Email): Promise<{ queued: boolean; sent: boolean }> {
  const html =
    email.html ??
    `<!doctype html><div style="font-family:Georgia,serif;max-width:34rem;margin:2rem auto;color:#23201c;line-height:1.6">
<div style="letter-spacing:.18em;font-size:.72rem;color:#6e5230;text-transform:uppercase">AUCTA</div>
<p style="white-space:pre-wrap">${escapeHtml(email.text)}</p>
<hr style="border:0;border-top:1px solid #ddd6ca;margin:1.5rem 0"/>
<p style="color:#8a877e;font-size:.72rem">AUCTA — Rare things. Real prices. Indonesian collectibles.</p>
</div>`;

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      if (nodemailer) {
        const transport = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? "AUCTA <no-reply@aucta.local>",
          to: email.to,
          subject: email.subject,
          text: email.text,
          html,
        });
        await db.insert(emailOutbox).values({
          to: email.to,
          subject: email.subject,
          text: email.text,
          html,
          sentAt: new Date(),
        });
        return { queued: true, sent: true };
      }
    } catch (err) {
      logger.error("email_send_failed", { name: err instanceof Error ? err.name : "Error" });
    }
  }

  await db.insert(emailOutbox).values({
    to: email.to,
    subject: email.subject,
    text: email.text,
    html,
  });
  return { queued: true, sent: false };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
