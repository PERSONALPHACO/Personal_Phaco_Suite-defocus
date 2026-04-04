/**
 * Email helper using Resend API for transactional emails.
 * Requires RESEND_API_KEY environment variable.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured. Email not sent.");
    return false;
  }

  const from = options.from ?? "DefocusApp <noreply@defocusapp.com>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[Email] Failed to send: ${response.status} ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Email] Error sending email:", err);
    return false;
  }
}

/**
 * Sends a password reset email with a secure link.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinir senha — DefocusApp</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#3b82f6;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:20px;font-weight:bold;">D</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#f8fafc;font-size:18px;font-weight:700;">DefocusApp</span>
                    <br/>
                    <span style="color:#94a3b8;font-size:12px;">Análise de Curvas de Defoque</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 8px;color:#f8fafc;font-size:22px;font-weight:700;">Redefinir sua senha</h1>
              <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Olá, <strong style="color:#e2e8f0;">${name}</strong>.<br/>
                Recebemos uma solicitação para redefinir a senha da sua conta no DefocusApp.
                Clique no botão abaixo para criar uma nova senha.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#3b82f6;border-radius:8px;">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                Este link expira em <strong style="color:#94a3b8;">1 hora</strong>.
                Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha permanece a mesma.
              </p>
              <p style="margin:0;color:#475569;font-size:12px;">
                Ou copie e cole este link no navegador:<br/>
                <span style="color:#60a5fa;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px;border-top:1px solid #334155;">
              <p style="margin:0;color:#475569;font-size:12px;text-align:center;">
                © 2026 DefocusApp · Uso exclusivo para profissionais de saúde
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject: "Redefinir senha — DefocusApp", html });
}
