"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import { getClientAuth, signInWithGoogle } from "@/lib/firebaseClient";
import { getIdToken } from "@/lib/auth";

type StationPublic = {
  id: string;
  title: string;
  connectorType: string;
  powerKw: number;
  city: string;
  region?: string;
  notes?: string;
  hoursStart?: string;
  hoursEnd?: string;
  availability?: Array<{ dayKey: string; enabled: boolean; start: string; end: string }>;
  priceNote?: string;
  pricingType?: string;
  priceIls?: number;
  isActive?: boolean;
};

type CarPreset = {
  key: "byd_atto_3" | "tesla_model_3" | "ioniq_5";
  label: string;
  batteryKwh: number;
  kmFullRange: number;
};

const CARS: CarPreset[] = [
  { key: "byd_atto_3", label: "BYD Atto 3", batteryKwh: 60, kmFullRange: 420 },
  { key: "tesla_model_3", label: "Tesla Model 3", batteryKwh: 60, kmFullRange: 430 },
  { key: "ioniq_5", label: "Hyundai Ioniq 5", batteryKwh: 72, kmFullRange: 480 },
];

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "-";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h <= 0) return `${m} דק׳`;
  if (m === 0) return `${h} שעות`;
  return `${h} שעות ו-${m} דק׳`;
}

export default function StationPage() {
  const params = useParams<{ id: string }>();
  const stationId = params?.id;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<StationPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [requestSentOpen, setRequestSentOpen] = useState(false);

  const [revealOpen, setRevealOpen] = useState(false);
  const [revealSaving, setRevealSaving] = useState(false);
  const [revealDate, setRevealDate] = useState<string>("");
  const [revealTimeFrom, setRevealTimeFrom] = useState<string>("");
  const [revealTimeTo, setRevealTimeTo] = useState<string>("");
  const [revealCoupon, setRevealCoupon] = useState<string>("");
  const [showCouponField, setShowCouponField] = useState(false);

  function timeToMinutes(v: string) {
    const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(v);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  const [carKey, setCarKey] = useState<CarPreset["key"]>("byd_atto_3");
  const [batteryPercent, setBatteryPercent] = useState<number>(20);

  const selectedCar = useMemo(() => CARS.find((c) => c.key === carKey) ?? CARS[0], [carKey]);

  const pricePerKwh = 1.2;

  const calc = useMemo(() => {
    const power = Number(station?.powerKw ?? 0);
    const currentPct = Math.min(100, Math.max(0, batteryPercent));
    const missingKwh = ((100 - currentPct) / 100) * selectedCar.batteryKwh;
    const hours = power > 0 ? (missingKwh / power) * 1.1 : NaN;
    const cost = missingKwh * pricePerKwh;
    const addedKm = ((100 - currentPct) / 100) * selectedCar.kmFullRange;

    return {
      missingKwh,
      hours,
      cost,
      addedKm,
    };
  }, [batteryPercent, selectedCar, station?.powerKw]);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoginModalOpen(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (!stationId) {
          throw new Error("Missing station id");
        }

        const res = await fetch(`/api/stations/${encodeURIComponent(stationId)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as {
          station?: StationPublic;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load station");

        if (!cancelled) setStation(json.station ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [stationId]);

  const openRequest = useCallback(() => {
    setError(null);
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    setRevealCoupon("");
    setShowCouponField(false);
    setRevealOpen(true);
  }, [user]);

  const submitRequest = useCallback(async () => {
    try {
      setError(null);
      if (!station) return;
      if (!user) {
        setError("נדרשת התחברות כדי לשלוח בקשה");
        return;
      }
      if (!revealDate.trim()) {
        setError("בחר תאריך");
        return;
      }
      if (!revealTimeFrom.trim()) {
        setError("בחר שעה התחלה");
        return;
      }
      if (!revealTimeTo.trim()) {
        setError("בחר שעה סיום");
        return;
      }

      const fromMin = timeToMinutes(revealTimeFrom.trim());
      const toMin = timeToMinutes(revealTimeTo.trim());
      if (fromMin == null || toMin == null || toMin <= fromMin) {
        setError("שעת סיום חייבת להיות אחרי שעת ההתחלה");
        return;
      }

      setRevealSaving(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/interest-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stationId: station.id,
          date: revealDate,
          timeFrom: revealTimeFrom,
          timeTo: revealTimeTo,
          coupon: revealCoupon,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        if (res.status === 429) {
          setShowCouponField(true);
          throw new Error(
            json.error ??
              "הגעת למגבלת הבקשות היומית. נסה שוב מחר. אם יש לך קופון, ניתן להזין אותו ולנסות שוב."
          );
        }
        throw new Error(json.error ?? "שגיאה בשליחת בקשה");
      }

      setRevealOpen(false);
      setRequestSentOpen(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setRevealSaving(false);
    }
  }, [revealCoupon, revealDate, revealTimeFrom, revealTimeTo, station, user]);

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div />
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        {loading ? <div className="mt-6 text-sm text-zinc-600">טוען...</div> : null}
        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {station ? (
          <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="text-xl font-semibold">{station.title}</div>
            <div className="mt-1 text-sm text-zinc-600">
              {station.city} · {station.connectorType}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">הספק</div>
                <div className="mt-1 text-sm font-semibold">{station.powerKw} kW</div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">תמחור</div>
                <div className="mt-1 text-sm font-semibold">
                  {typeof station.priceIls === "number" ? `${station.priceIls} ₪` : "-"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-sm font-semibold">מחשבון טעינה חכם</div>
              <div className="mt-1 text-xs text-zinc-500">
                חישוב משוער לפי הספק העמדה, סוג הרכב ואחוז סוללה נוכחי.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600">בחירת רכב</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                    value={carKey}
                    onChange={(e) => setCarKey(e.target.value as CarPreset["key"])}
                  >
                    {CARS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-600">מצב סוללה נוכחי: {batteryPercent}%</label>
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={100}
                    value={batteryPercent}
                    onChange={(e) => setBatteryPercent(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-100 bg-white p-3">
                  <div className="text-xs text-zinc-500">זמן משוער</div>
                  <div className="mt-1 text-sm font-semibold">
                    ייקח לך כ-{formatHours(calc.hours)} להגיע ל-100%
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-white p-3">
                  <div className="text-xs text-zinc-500">תוספת ק"מ</div>
                  <div className="mt-1 text-sm font-semibold">תוסיף כ-{Math.round(calc.addedKm)} ק"מ</div>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-white p-3">
                  <div className="text-xs text-zinc-500">עלות משוערת</div>
                  <div className="mt-1 text-sm font-semibold">₪{Math.round(calc.cost)}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                המחיר מחושב לפי {pricePerKwh} ₪ לקוט"ש ובאפר של 10% לעקומת טעינה.
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                className="w-full rounded-full bg-black px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                onClick={() => openRequest()}
              >
                שלח בקשה
              </button>
              <div className="mt-2 text-xs text-zinc-500">
                כדי לשלוח בקשה לבעל העמדה תתבקש להתחבר.
              </div>
            </div>
          </div>
        ) : null}

        {revealOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-right shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">שליחת בקשה לבעל העמדה</div>
                  <div className="mt-1 text-sm text-zinc-600">בחר תאריך וטווח שעות להטענה.</div>
                </div>
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                  onClick={() => setRevealOpen(false)}
                >
                  סגור
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600">תאריך</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                    value={revealDate}
                    onChange={(e) => setRevealDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">משעה</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                    value={revealTimeFrom}
                    onChange={(e) => {
                      const next = e.target.value;
                      setRevealTimeFrom(next);
                      const fromMin = timeToMinutes(next);
                      const toMin = timeToMinutes(revealTimeTo);
                      if (fromMin != null && toMin != null && toMin <= fromMin) {
                        setRevealTimeTo("");
                      }
                    }}
                    step={300}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">עד שעה</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                    value={revealTimeTo}
                    onChange={(e) => setRevealTimeTo(e.target.value)}
                    step={300}
                    min={revealTimeFrom || undefined}
                  />
                </div>
              </div>

              {showCouponField ? (
                <div className="mt-3">
                  <label className="text-xs font-medium text-zinc-600">קופון (אופציונלי)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                    value={revealCoupon}
                    onChange={(e) => setRevealCoupon(e.target.value)}
                    placeholder="הזן קופון"
                  />
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                  onClick={() => setRevealOpen(false)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={revealSaving}
                  onClick={() => void submitRequest()}
                >
                  {revealSaving ? "שולח..." : "שלח בקשה"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {loginModalOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          dir="rtl"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLoginModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-right shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">נדרשת התחברות</div>
                <div className="mt-1 text-sm text-zinc-600">כדי לשלוח בקשת טעינה צריך להתחבר.</div>
              </div>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                onClick={() => setLoginModalOpen(false)}
              >
                סגור
              </button>
            </div>

            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              onClick={() => void signInWithGoogle()}
            >
              התחבר עם Google
            </button>
          </div>
        </div>
      ) : null}

      {requestSentOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-right shadow-xl">
            <div className="text-base font-semibold">ההודעה נשלחה לבעל העמדה</div>
            <div className="mt-1 text-sm text-zinc-600">מעבירים אותך לדף הבית...</div>
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              onClick={() => {
                setRequestSentOpen(false);
                window.location.href = "/";
              }}
            >
              חזרה לדף הבית
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
