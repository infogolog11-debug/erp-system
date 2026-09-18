// ════════════════════════════════════════════════════════════
import { errMsg } from "@/types/db";
// خدمة إرسال الإيميلات — تدعم Resend (الأفضل) أو SMTP
// إعداد: أضف RESEND_API_KEY أو SMTP_* في .env.local
// ════════════════════════════════════════════════════════════

export type EmailPayload = {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
};

type SendResult = { success:true } | { success:false; error:string };

// ── مرسل موحد — يختار الموفر تلقائياً من البيئة ──────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  // Resend (الأفضل للإنتاج)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(payload);
  }
  // SMTP (nodemailer)
  if (process.env.SMTP_HOST) {
    return sendViaSMTP(payload);
  }
  // تطوير: طباعة في console بدل إرسال
  if (process.env.NODE_ENV === "development") {
    console.log("\n📧 [DEV EMAIL MOCK]");
    console.log("To:", Array.isArray(payload.to) ? payload.to.join(", ") : payload.to);
    console.log("Subject:", payload.subject);
    console.log("─".repeat(40));
    return { success:true };
  }
  return { success:false, error:"لم يُعيَّن موفر البريد الإلكتروني في البيئة" };
}

async function sendViaResend(payload: EmailPayload): Promise<SendResult> {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from:    process.env.EMAIL_FROM ?? "ERP System <noreply@myorg.com>",
      to:      Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    });
    if (error) return { success:false, error: errMsg(error) };
    return { success:true };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

async function sendViaSMTP(payload: EmailPayload): Promise<SendResult> {
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM ?? "ERP System <noreply@myorg.com>",
      to:      Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    });
    return { success:true };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
