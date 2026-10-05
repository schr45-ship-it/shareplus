"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const labels: Record<string, { report: string; reporting: string; thanks: string }> = {
  en: { report: "Report inappropriate content", reporting: "Sending...", thanks: "Thanks, we'll review it" },
  he: { report: "דווח על תוכן לא ראוי", reporting: "שולח...", thanks: "תודה, נבדוק את הדיווח" },
  es: { report: "Reportar contenido inapropiado", reporting: "Enviando...", thanks: "Gracias, lo revisaremos" },
  ar: { report: "الإبلاغ عن محتوى غير لائق", reporting: "جارٍ الإرسال...", thanks: "شكرًا، سنراجع البلاغ" },
};

export function ReportButton({ articleId, locale }: { articleId: string; locale: string }) {
  const l = labels[locale] ?? labels.en;
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const supabase = createClient();

  async function report() {
    setState("sending");
    await (supabase.from as any)("reports").insert({
      article_id: articleId,
      reason: "inappropriate",
    });
    setState("done");
  }

  if (state === "done") {
    return <span className="text-xs text-zinc-400">{l.thanks}</span>;
  }

  return (
    <button
      onClick={report}
      disabled={state === "sending"}
      className="text-xs text-zinc-400 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50"
    >
      {state === "sending" ? l.reporting : l.report}
    </button>
  );
}
