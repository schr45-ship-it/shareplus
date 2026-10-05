"use client";

import { useMemo, useState } from "react";

const labels: Record<
  string,
  {
    name: string;
    email: string;
    message: string;
    verify: string;
    send: string;
    sending: string;
    success: string;
    error: string;
    captchaError: string;
  }
> = {
  he: {
    name: "שם",
    email: "אימייל",
    message: "הודעה",
    verify: "אימות: כמה זה",
    send: "שלח הודעה",
    sending: "שולח…",
    success: "ההודעה נשלחה בהצלחה. נחזור אליך בהקדם!",
    error: "משהו השתבש. נסה שוב.",
    captchaError: "תשובת האימות שגויה — נסה שוב.",
  },
  en: {
    name: "Name",
    email: "Email",
    message: "Message",
    verify: "Verify: what is",
    send: "Send Message",
    sending: "Sending…",
    success: "Message sent successfully. We'll get back to you soon!",
    error: "Something went wrong. Please try again.",
    captchaError: "Wrong verification answer — try again.",
  },
  es: {
    name: "Nombre",
    email: "Correo electrónico",
    message: "Mensaje",
    verify: "Verificación: cuánto es",
    send: "Enviar mensaje",
    sending: "Enviando…",
    success: "Mensaje enviado correctamente. ¡Te responderemos pronto!",
    error: "Algo salió mal. Inténtalo de nuevo.",
    captchaError: "Respuesta de verificación incorrecta — inténtalo de nuevo.",
  },
  ar: {
    name: "الاسم",
    email: "البريد الإلكتروني",
    message: "الرسالة",
    verify: "تحقق: كم يساوي",
    send: "إرسال الرسالة",
    sending: "جارٍ الإرسال…",
    success: "تم إرسال الرسالة بنجاح. سنرد عليك قريبًا!",
    error: "حدث خطأ. حاول مرة أخرى.",
    captchaError: "إجابة التحقق خاطئة — حاول مجددًا.",
  },
};

function randomPair() {
  return [2 + Math.floor(Math.random() * 7), 2 + Math.floor(Math.random() * 7)];
}

export default function ContactForm({ locale }: { locale: string }) {
  const t = labels[locale] ?? labels.en;
  const [[a, b], setPair] = useState<number[]>([3, 5]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err" | "captcha">("idle");

  useMemo(() => setPair(randomPair()), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const get = (n: string) => (f.elements.namedItem(n) as HTMLInputElement)?.value;
    setSending(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          message: get("message"),
          captcha: get("captcha"),
          captchaExpected: a + b,
          website: get("website"), // honeypot
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("ok");
        f.reset();
        setPair(randomPair());
      } else {
        setStatus(data.error === "captcha" ? "captcha" : "err");
        if (data.error === "captcha") setPair(randomPair());
      }
    } catch {
      setStatus("err");
    }
    setSending(false);
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700">
          {t.name}
        </label>
        <input id="name" name="name" required maxLength={120} className={inputCls} />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
          {t.email}
        </label>
        <input id="email" name="email" type="email" required maxLength={200} className={inputCls} />
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-zinc-700">
          {t.message}
        </label>
        <textarea id="message" name="message" required minLength={5} rows={5} className={inputCls} />
      </div>

      {/* Honeypot — invisible to humans, bots fill it */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div>
        <label htmlFor="captcha" className="mb-1 block text-sm font-medium text-zinc-700">
          {t.verify} {a} + {b}?
        </label>
        <input
          id="captcha"
          name="captcha"
          inputMode="numeric"
          required
          className={`${inputCls} w-32`}
        />
      </div>

      {status === "ok" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t.success}</p>
      )}
      {status === "err" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.error}</p>
      )}
      {status === "captcha" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{t.captchaError}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {sending ? t.sending : t.send}
      </button>
    </form>
  );
}
