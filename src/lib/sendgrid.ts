export async function sendEmailSendGrid(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;

  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");
  if (!from) throw new Error("Missing SENDGRID_FROM");

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: from },
      subject: params.subject,
      content: [
        { type: "text/plain", value: params.text },
        ...(params.html ? [{ type: "text/html", value: params.html }] : []),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SendGrid error: ${res.status} ${res.statusText} ${body}`);
  }
}
