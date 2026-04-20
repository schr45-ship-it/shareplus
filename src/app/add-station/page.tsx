"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import Image from "next/image";

import { getClientAuth } from "@/lib/firebaseClient";
import { createStation } from "@/lib/firestoreClient";
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone";

declare global {
  interface Window {
    L?: unknown;
  }
}

export default function AddStationPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const buildStamp = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [connectorType, setConnectorType] = useState("Type 2 (עם כבל מובנה)");
  const [powerKw, setPowerKw] = useState<number>(11);
  const [street, setStreet] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [pricingType, setPricingType] = useState("לפי שעה");
  const [priceIls, setPriceIls] = useState<number>(20);
  const [notes, setNotes] = useState("");
  const [showConnectorHelp, setShowConnectorHelp] = useState(false);
  const [showPricingHelp, setShowPricingHelp] = useState(false);
  const [availability, setAvailability] = useState<
    Array<{ dayKey: string; label: string; enabled: boolean; start: string; end: string }>
  >([
    { dayKey: "sun", label: "א׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "mon", label: "ב׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "tue", label: "ג׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "wed", label: "ד׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "thu", label: "ה׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "fri", label: "ו׳", enabled: true, start: "08:00", end: "20:00" },
    { dayKey: "sat", label: "ש׳", enabled: true, start: "08:00", end: "20:00" },
  ]);

  function quantize1km(lat: number, lng: number) {
    const latStep = 0.009;
    const lngStep = 0.011;
    const qLat = Math.round(lat / latStep) * latStep;
    const qLng = Math.round(lng / lngStep) * lngStep;
    return { lat: Number(qLat.toFixed(6)), lng: Number(qLng.toFixed(6)) };
  }

  function computeMissingFields() {
    const misses: string[] = [];
    if (!user) misses.push("התחברות");
    if (!city.trim()) misses.push("יישוב");
    if (!region.trim()) misses.push("אזור בארץ");
    if (!connectorType.trim()) misses.push("חיבור");
    if (!Number.isFinite(powerKw) || powerKw <= 0) misses.push("הספק (kW)");
    if (!street.trim()) misses.push("רחוב");
    if (!hostName.trim()) misses.push("שם מארח");
    if (!hostPhone.trim()) misses.push("טלפון מארח");
    else if (!isValidPhone(hostPhone)) misses.push("טלפון מארח (לא תקין)");
    if (!pricingType.trim()) misses.push("סוג תמחור");
    if (!Number.isFinite(priceIls) || priceIls <= 0) misses.push("מחיר מבוקש (₪)");

    const hasAvailability = availability.some((d) => d.enabled && d.start.trim() && d.end.trim());
    if (!hasAvailability) misses.push("זמינות (יום ושעות)");

    return misses;
  }

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as { L?: unknown }).L) {
      setMapReady(true);
      return;
    }

    const existing = document.querySelector('link[data-leaflet="1"]');
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setMapReady(true);
    script.onerror = () => setError("שגיאה בטעינת מפה");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    if (typeof window === "undefined") return;
    const L = (window as { L?: any }).L;
    if (!L) return;

    const el = document.getElementById("station-map");
    if (!el) return;
    if ((el as any)._leaflet_id) return;

    const map = L.map(el).setView([32.0853, 34.7818], 9);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    map.on("click", (e: any) => {
      const q = quantize1km(e.latlng.lat, e.latlng.lng);
      setLocation(q);
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([q.lat, q.lng]).addTo(map);
    });

    return () => {
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const L = (window as { L?: any }).L;
    if (!L) return;
    const map = mapRef.current;
    if (!map) return;

    if (!location) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      markerRef.current = L.marker([location.lat, location.lng]).addTo(map);
    }
    map.setView([location.lat, location.lng], 14);
  }, [location, mapReady]);

  useEffect(() => {
    if (!user) return;
    if (!hostName && user.displayName) setHostName(user.displayName);
    if (!hostPhone && user.phoneNumber) setHostPhone(user.phoneNumber);
  }, [user, hostName, hostPhone]);

  const canSubmit = useMemo(() => {
    return (
      !!user &&
      city.trim().length > 0 &&
      region.trim().length > 0 &&
      connectorType.trim().length > 0 &&
      Number.isFinite(powerKw) &&
      powerKw > 0 &&
      street.trim().length > 0 &&
      hostName.trim().length > 0 &&
      hostPhone.trim().length > 0 &&
      availability.some((d) => d.enabled && d.start.trim() && d.end.trim()) &&
      pricingType.trim().length > 0 &&
      Number.isFinite(priceIls) &&
      priceIls > 0
    );
  }, [
    user,
    city,
    region,
    connectorType,
    powerKw,
    street,
    hostName,
    hostPhone,
    availability,
    pricingType,
    priceIls,
  ]);

  async function setLocationFromStreet() {
    setError(null);
    if (!street.trim() || !city.trim()) {
      setError("כדי לאתר מיקום אוטומטי, מלא רחוב ויישוב");
      return;
    }

    try {
      setGeocoding(true);
      const query = `${street.trim()}, ${city.trim()}, Israel`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error("לא ניתן לאתר מיקום כרגע");
      const data = (await res.json().catch(() => null)) as null | Array<{ lat?: string; lon?: string }>;
      const first = Array.isArray(data) ? data[0] : null;
      const lat = first?.lat ? Number(first.lat) : NaN;
      const lng = first?.lon ? Number(first.lon) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("לא זוהה רחוב. נסה לבחור על המפה.");
      }
      const q = quantize1km(lat, lng);
      setLocation(q);
      const map = mapRef.current;
      if (map) map.setView([q.lat, q.lng], 14);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setGeocoding(false);
    }
  }

  async function useMyLocation() {
    setError(null);
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setError("הדפדפן לא תומך במיקום");
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      const q = quantize1km(pos.coords.latitude, pos.coords.longitude);
      setLocation(q);
      const map = mapRef.current;
      if (map) map.setView([q.lat, q.lng], 14);
    } catch {
      setError("לא ניתן לקבל מיקום. בדוק הרשאות דפדפן.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMissingFields([]);
    setCreatedId(null);

    if (!user) {
      setError("נדרשת התחברות כדי להוסיף עמדה");
      return;
    }

    if (!canSubmit) {
      const misses = computeMissingFields();
      setMissingFields(misses);
      setError("חסרים שדות חובה");
      return;
    }

    if (!isValidPhone(hostPhone)) {
      setError("אנא הזן מספר טלפון מארח תקין");
      return;
    }

    try {
      setSaving(true);
      const firstEnabled = availability.find((d) => d.enabled);
      if (!firstEnabled) throw new Error("בחר לפחות יום אחד בזמינות");

      const generatedTitle = `עמדה ב${city.trim()}`;
      const id = await createStation({
        title: generatedTitle,
        city: city.trim(),
        region: region.trim(),
        connectorType: connectorType.trim(),
        powerKw,
        street: street.trim(),
        location: location ?? undefined,
        hostName: hostName.trim(),
        hostPhone: normalizePhoneE164(hostPhone),
        notes: notes.trim(),
        hoursStart: firstEnabled.start,
        hoursEnd: firstEnabled.end,
        availability: availability.map((d) => ({
          dayKey: d.dayKey,
          enabled: d.enabled,
          start: d.start,
          end: d.end,
        })),
        ownerUid: user.uid,
        pricingType,
        priceIls,
      });
      setCreatedId(id);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <div />
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        {!user ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            נדרשת התחברות כדי להוסיף עמדה.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {missingFields.length ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">חסרים:</div>
            <div className="mt-2 space-y-1">
              {missingFields.map((f) => (
                <div key={f}>- {f}</div>
              ))}
            </div>
          </div>
        ) : null}

        {createdId ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            העמדה נשמרה בהצלחה. מזהה: {createdId}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium">יישוב</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="לדוגמה: רעננה"
            />
          </div>

          <div>
            <label className="text-sm font-medium">אזור בארץ</label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">בחר אזור</option>
              <option value="גולן">גולן</option>
              <option value="גליל עליון">גליל עליון</option>
              <option value="גליל תחתון">גליל תחתון</option>
              <option value="חיפה והקריות">חיפה והקריות</option>
              <option value="עמקים">עמקים</option>
              <option value="השומרון">השומרון</option>
              <option value="מערב בנימין">מערב בנימין</option>
              <option value="ירושלים וסביבתה">ירושלים וסביבתה</option>
              <option value="מרכז">מרכז</option>
              <option value="שרון">שרון</option>
              <option value="שפלה">שפלה</option>
              <option value="יהודה (גוש עציון וחברון)">יהודה (גוש עציון וחברון)</option>
              <option value="דרום">דרום</option>
              <option value="אילת והערבה">אילת והערבה</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">חיבור</label>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-base font-bold text-zinc-700 hover:bg-zinc-50"
                  onClick={() => setShowConnectorHelp(true)}
                >
                  ?
                </button>
              </div>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value)}
              >
                <option value="Type 2 (עם כבל מובנה)">Type 2 (עם כבל מובנה)</option>
                <option value="Type 2 (שקע בלבד - דורש כבל מהנהג)">
                  Type 2 (שקע בלבד - דורש כבל מהנהג)
                </option>
                <option value="אחר (Type 1 וכו')">אחר (Type 1 וכו')</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">הספק (kW)</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
                value={String(powerKw)}
                onChange={(e) => setPowerKw(Number(e.target.value))}
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">רחוב</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="נא לא לרשום מספר בית מדויק"
            />
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-sm font-medium">מיקום על המפה (בקירוב של כ-1 ק"מ)</div>
            <div className="mt-1 text-xs text-zinc-500">
              לחץ על המפה כדי לבחור מיקום מקורב. אנו שומרים מיקום בקירוב כדי לשמור על פרטיות.
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!mapReady || geocoding}
                onClick={() => void setLocationFromStreet()}
              >
                {geocoding ? "מאתר..." : "אתר לפי רחוב"}
              </button>
              <button
                type="button"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!mapReady}
                onClick={() => void useMyLocation()}
              >
                לפי המיקום שלי
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div id="station-map" className="h-56 w-full" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-600">
              <div>
                {location ? `נבחר: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "לא נבחר מיקום"}
              </div>
              {location ? (
                <button
                  type="button"
                  className="text-xs font-medium text-zinc-700 hover:underline"
                  onClick={() => setLocation(null)}
                >
                  נקה מיקום
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">שם מארח</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">טלפון מארח</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
                value={hostPhone}
                onChange={(e) => setHostPhone(e.target.value)}
                placeholder="+972..."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">תמחור</label>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-base font-bold text-zinc-700 hover:bg-zinc-50"
                onClick={() => setShowPricingHelp((s) => !s)}
              >
                ?
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">סוג תמחור</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value)}
                >
                  <option value="לפי שעה">לפי שעה</option>
                  <option value="מחיר קבוע לטעינה">מחיר קבוע לטעינה</option>
                  <option value='לפי קוט"ש'>לפי קוט"ש</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">מחיר מבוקש (₪)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={String(priceIls)}
                  onChange={(e) => setPriceIls(Number(e.target.value))}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              מומלץ לבקש כ-20₪ לשעת טעינה כדי לכסות את עלות החשמל וליהנות מרווח קטן על השירות.
            </div>

            {showPricingHelp ? (
              <div className="mt-2 text-xs text-zinc-500">
                אפשר לבחור תמחור לפי שעה (הכי פשוט), מחיר קבוע לטעינה, או לפי קוט"ש (למתקדמים עם מדידה באפליקציה).
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <div className="text-sm font-medium">זמינות (יום ושעות)</div>
            <div className="mt-1 text-xs text-zinc-500">
              בחר באילו ימים ניתן להטעין ובאילו שעות.
            </div>

            <div className="mt-3 space-y-2">
              {availability.map((d, idx) => (
                <div
                  key={d.dayKey}
                  className="grid grid-cols-[60px_1fr_1fr] items-center gap-2"
                >
                  <label className="flex items-center justify-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, enabled: e.target.checked } : x
                          )
                        )
                      }
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>

                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 disabled:opacity-50"
                    type="time"
                    value={typeof d.start === "string" ? d.start : ""}
                    disabled={!d.enabled}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, start: e.target.value } : x))
                      )
                    }
                  />

                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 disabled:opacity-50"
                    type="time"
                    value={typeof d.end === "string" ? d.end : ""}
                    disabled={!d.enabled}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, end: e.target.value } : x))
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">הערות (אופציונלי)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="לדוגמה: נא לתאם מראש, חניה בכניסה לבית, יש כלב בחצר"
            />
          </div>

          <button
            className="w-full rounded-full bg-black px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || saving}
            type="submit"
          >
            {saving ? "שומר..." : "שמור עמדה"}
          </button>
        </form>

        <div className="mt-10 text-center text-xs text-zinc-400">
          v{version}{buildStamp ? ` · ${buildStamp}` : ""}
        </div>
      </main>

      {showConnectorHelp ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          dir="rtl"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConnectorHelp(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-right shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">לא בטוח איזה חיבור יש לך?</div>
              </div>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                onClick={() => setShowConnectorHelp(false)}
              >
                סגור
              </button>
            </div>

            <div className="mt-3 border-t border-zinc-100" />

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">חיבור Type 2 (הנפוץ בישראל)</div>
                  <div className="mt-1 text-sm text-zinc-700">
                    מתאים לרוב הרכבים החדשים: BYD, Tesla, Geely, Ioniq, MG, Kia, Kona ועוד.
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">* רוב העמדות הביתיות בישראל הן Type 2.</div>
                </div>
                <Image
                  src="/type2-common.jpg"
                  alt="Type 2 Charger"
                  width={100}
                  height={80}
                  unoptimized
                  className="h-auto w-[100px] rounded-md"
                />
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">חיבור Type 1</div>
                  <div className="mt-1 text-sm text-zinc-700">
                    נפוץ ברכבים ישנים יותר (כמו ניסאן ליף דור 1) או רכבים בייבוא אישי מארה"ב.
                  </div>
                </div>
                <Image
                  src="/type1-common.jpg"
                  alt="Type 1 Charger"
                  width={100}
                  height={80}
                  unoptimized
                  className="h-auto w-[100px] rounded-md"
                />
              </div>
            </div>

            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              onClick={() => setShowConnectorHelp(false)}
            >
              הבנתי, תודה
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
