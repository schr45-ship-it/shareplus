"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ApproveStationPage() {
  const params = useParams<{ stationId: string }>();
  const router = useRouter();

  const stationId = useMemo(() => String(params?.stationId ?? "").trim(), [params]);

  const [step, setStep] = useState<"initial" | "payment">("initial");
  const [error, setError] = useState<string | null>(null);

  function showPaymentOption() {
    setError(null);
    setStep("payment");
  }

  function rejectRequest() {
    setError(null);
    alert("הודעה נשלחה ללקוח שהעמדה לא פנויה.");
  }

  function redirectToCoupon() {
    setError(null);
    alert("מעבירים אותך לתשלום עם קופון: עם ישראל חי");
    router.push(`/payment?coupon=am_israel_chai&stationId=${encodeURIComponent(stationId)}`);
  }

  function finishProcess() {
    setError(null);
    alert("האישור נשלח ללקוח. הלקוח ישלם את העמלה.");
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div />
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border-2 border-blue-500 bg-white p-5 text-center shadow-sm">
          <div className="text-lg font-semibold text-zinc-800">בקשת טעינה חדשה</div>
          <div className="mt-2 text-sm text-zinc-700">האם העמדה פנויה כרגע?</div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-around gap-3">
            <button
              type="button"
              className="rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700"
              onClick={showPaymentOption}
              disabled={!stationId}
            >
              אישור (פנוי)
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700"
              onClick={rejectRequest}
              disabled={!stationId}
            >
              לא פנוי
            </button>
          </div>

          {step === "payment" ? (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="text-sm text-zinc-700">
                באפשרותך לשלם את העמלה במקום הלקוח (1 ש"ח). תרצה לעשות זאת?
              </div>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={redirectToCoupon}
                >
                  כן
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-zinc-500 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600"
                  onClick={finishProcess}
                >
                  לא
                </button>
              </div>
            </div>
          ) : null}

          {!stationId ? (
            <div className="mt-4 text-sm text-red-700">חסר מזהה עמדה בקישור</div>
          ) : (
            <div className="mt-4 text-xs text-zinc-500">מזהה עמדה: {stationId}</div>
          )}
        </div>
      </main>
    </div>
  );
}
