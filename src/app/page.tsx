"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { getClientAuth, getWebPushToken, signInWithGoogle } from "@/lib/firebaseClient";
import { isAdminEmail } from "@/lib/admin";
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

type MyStation = StationPublic & {
  street?: string;
  hostPhone?: string;
  hostName?: string;
  isActive?: boolean;
};

export default function Home() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  const buildStamp = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [stations, setStations] = useState<StationPublic[]>([]);
  const [myStations, setMyStations] = useState<MyStation[]>([]);
  const [favorites, setFavorites] = useState<StationPublic[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);
  const [loadingMyStations, setLoadingMyStations] = useState(false);
  const [loadingStations, setLoadingStations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showMyStations, setShowMyStations] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeSection, setActiveSection] = useState<"stations" | "myStations" | "favorites">(
    "stations"
  );
  const stationsAnchorId = "stations";
  const myStationsAnchorId = "my-stations";
  const favoritesAnchorId = "favorites";

  const [filterCity, setFilterCity] = useState("");
  const [filterConnector, setFilterConnector] = useState<string>("");
  const [filterMinPower, setFilterMinPower] = useState<number | "">("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | "">("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterTimeFrom, setFilterTimeFrom] = useState<string>("");
  const [filterTimeTo, setFilterTimeTo] = useState<string>("");
  const [highlightStationId, setHighlightStationId] = useState<string | null>(null);

  const [revealOpen, setRevealOpen] = useState(false);
  const [revealStation, setRevealStation] = useState<StationPublic | null>(null);
  const [revealSaving, setRevealSaving] = useState(false);
  const [revealDate, setRevealDate] = useState<string>("");
  const [revealTimeFrom, setRevealTimeFrom] = useState<string>("");
  const [revealTimeTo, setRevealTimeTo] = useState<string>("");

  const isAdmin = useMemo(() => isAdminEmail(user?.email), [user?.email]);

  const citySuggestions = useMemo(() => {
    const set = new Set(
      stations
        .map((s) => (s.city ?? "").trim())
        .filter(Boolean)
        .map((c) => c)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [stations]);

  const connectorSuggestions = useMemo(() => {
    const set = new Set(
      stations
        .map((s) => (s.connectorType ?? "").trim())
        .filter(Boolean)
        .map((c) => c)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [stations]);

  const filteredStations = useMemo(() => {
    const cityNeedle = filterCity.trim();
    const connectorNeedle = filterConnector.trim();
    const minPower = filterMinPower === "" ? null : Number(filterMinPower);
    const maxPrice = filterMaxPrice === "" ? null : Number(filterMaxPrice);
    const dateStr = filterDate.trim();
    const tFrom = filterTimeFrom.trim();
    const tTo = filterTimeTo.trim();

    function parseHHMM(v: string) {
      const m = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(v);
      if (!m) return null;
      const h = Number(m[1]);
      const min = Number(m[2]);
      return h * 60 + min;
    }

    function dayKeyFromDate(dateIso: string): "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | null {
      const d = new Date(`${dateIso}T00:00:00`);
      if (!Number.isFinite(d.getTime())) return null;
      const idx = d.getDay();
      return (['sun','mon','tue','wed','thu','fri','sat'] as const)[idx] ?? null;
    }

    const needTimeFilter = Boolean(dateStr && tFrom && tTo);
    const reqFromMin = needTimeFilter ? parseHHMM(tFrom) : null;
    const reqToMin = needTimeFilter ? parseHHMM(tTo) : null;
    const reqDay = needTimeFilter ? dayKeyFromDate(dateStr) : null;

    return stations.filter((s) => {
      if ((s as { isActive?: boolean }).isActive === false) return false;
      if (cityNeedle && !s.city?.includes(cityNeedle)) return false;
      if (connectorNeedle && s.connectorType !== connectorNeedle) return false;
      if (minPower != null && Number.isFinite(minPower) && (s.powerKw ?? 0) < minPower)
        return false;

      if (maxPrice != null && Number.isFinite(maxPrice)) {
        if (typeof s.priceIls !== "number") return false;
        if (s.priceIls > maxPrice) return false;
      }

      if (needTimeFilter) {
        if (reqFromMin == null || reqToMin == null || reqDay == null) return false;
        if (reqFromMin >= reqToMin) return false;

        const avail = s.availability;
        if (!Array.isArray(avail) || !avail.length) return false;

        const slot = avail.find((a) => a?.enabled && a.dayKey === reqDay);
        if (!slot) return false;
        const slotFrom = parseHHMM(String(slot.start ?? ""));
        const slotTo = parseHHMM(String(slot.end ?? ""));
        if (slotFrom == null || slotTo == null) return false;

        const overlaps = reqFromMin < slotTo && reqToMin > slotFrom;
        if (!overlaps) return false;
      }

      return true;
    });
  }, [
    stations,
    filterCity,
    filterConnector,
    filterMinPower,
    filterMaxPrice,
    filterDate,
    filterTimeFrom,
    filterTimeTo,
  ]);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const deleteStationAsAdmin = useCallback(
    async (stationId: string) => {
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }
      if (!isAdmin) {
        setError("אין הרשאה");
        return;
      }

      const ok = window.confirm("למחוק את העמדה? פעולה זו בלתי הפיכה.");
      if (!ok) return;

      try {
        setDeletingId(stationId);
        setError(null);
        const token = await getIdToken(user);
        const res = await fetch("/api/admin/delete-station", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ stationId }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Delete failed");

        setStations((prev) => prev.filter((s) => s.id !== stationId));
        setMyStations((prev) => prev.filter((s) => s.id !== stationId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        setDeletingId(null);
      }
    },
    [user, isAdmin]
  );

  const setMyStationActive = useCallback(
    async (stationId: string, isActive: boolean) => {
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }

      try {
        setError(null);
        const token = await getIdToken(user);
        const res = await fetch(`/api/stations/${stationId}/active`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "שגיאה בעדכון סטטוס");
        }

        setMyStations((prev) =>
          prev.map((s) => (s.id === stationId ? { ...s, isActive } : s))
        );
        setStations((prev) =>
          prev.map((s) => (s.id === stationId ? ({ ...s, isActive } as StationPublic) : s))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      }
    },
    [user]
  );

  const shareStation = useCallback(async (stationId: string, title: string) => {
    try {
      const url = `${window.location.origin}/?stationId=${encodeURIComponent(stationId)}`;
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setError("קישור הועתק ללוח");
      setTimeout(() => setError(null), 1500);
    } catch {
      setError("לא ניתן לשתף כרגע");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stationId = new URLSearchParams(window.location.search).get("stationId");
    if (!stationId) return;

    setActiveSection("stations");
    setHighlightStationId(stationId);
    setTimeout(() => {
      document.getElementById(stationsAnchorId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
    const t = setTimeout(() => setHighlightStationId(null), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMine() {
      if (!user) {
        setMyStations([]);
        return;
      }

      try {
        setLoadingMyStations(true);
        const token = await getIdToken(user);
        const res = await fetch("/api/my-stations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load my stations");
        const data = (await res.json()) as { stations: MyStation[] };
        if (!cancelled) setMyStations(data.stations);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoadingMyStations(false);
      }
    }

    void loadMine();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavs() {
      if (!user) {
        setFavorites([]);
        setFavoriteIds(new Set());
        return;
      }
      try {
        setLoadingFavorites(true);
        const token = await getIdToken(user);
        const res = await fetch("/api/favorites", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as
          | { stations: StationPublic[] }
          | { error?: string };

        if (!res.ok) {
          if (res.status === 401) {
            setFavorites([]);
            setFavoriteIds(new Set());
            return;
          }
          throw new Error("error" in data && data.error ? data.error : `Failed to load favorites (HTTP ${res.status})`);
        }
        if (cancelled) return;
        const stationsData = (data as { stations: StationPublic[] }).stations;
        setFavorites(stationsData);
        setFavoriteIds(new Set(stationsData.map((s) => s.id)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoadingFavorites(false);
      }
    }

    void loadFavs();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleFavorite = useCallback(
    async (stationId: string) => {
      if (!user) {
        setError("נדרשת התחברות כדי להוסיף למועדפים");
        return;
      }
      try {
        setTogglingFavId(stationId);
        setError(null);
        const token = await getIdToken(user);
        const already = favoriteIds.has(stationId);

        const res = await fetch(
          already ? `/api/favorites?stationId=${encodeURIComponent(stationId)}` : "/api/favorites",
          {
            method: already ? "DELETE" : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: already ? undefined : JSON.stringify({ stationId }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Favorite failed");

        if (already) {
          setFavoriteIds((prev) => {
            const n = new Set(prev);
            n.delete(stationId);
            return n;
          });
          setFavorites((prev) => prev.filter((s) => s.id !== stationId));
        } else {
          setFavoriteIds((prev) => new Set(prev).add(stationId));
          const st = stations.find((s) => s.id === stationId);
          if (st) setFavorites((prev) => [st, ...prev.filter((x) => x.id !== stationId)]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        setTogglingFavId(null);
      }
    },
    [user, favoriteIds, stations]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingStations(true);
        const res = await fetch("/api/stations", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load stations");
        const data = (await res.json()) as { stations: StationPublic[] };
        if (!cancelled) setStations(data.stations);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setLoadingStations(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const enablePush = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }

      if (typeof window === "undefined") return;
      if (!("Notification" in window)) {
        setError("הדפדפן לא תומך בהתראות");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("לא אישרת קבלת התראות");
        return;
      }

      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      }

      const pushToken = await getWebPushToken();
      if (!pushToken) {
        setError("לא ניתן לקבל טוקן להתראות");
        return;
      }

      const idToken = await getIdToken(user);
      const res = await fetch("/api/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: pushToken }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה ברישום התראות");

      setError("התראות הופעלו בהצלחה");
      setTimeout(() => setError(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    }
  }, [user]);

  const startSignIn = useCallback(async () => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>)["__shareplusTermsPrompt"] = true;
      window.dispatchEvent(new Event("shareplus:terms-prompt"));
    }
    await signInWithGoogle();
  }, []);

  const headerRight = useMemo(() => {
    if (!user) {
      return (
        <button
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => void startSignIn()}
        >
          התחבר עם Google
        </button>
      );
    }

    return (
      <div className="flex flex-row-reverse items-center gap-3">
        <button
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          onClick={() => void signOut(getClientAuth())}
        >
          התנתק
        </button>
        <span className="text-sm text-zinc-600">{user.email ?? user.displayName}</span>
        <a className="text-sm font-medium text-zinc-900 hover:underline" href="/profile">
          הפרופיל שלי
        </a>
      </div>
    );
  }, [startSignIn, user]);

  const openReveal = useCallback((station: StationPublic) => {
    setError(null);
    if (!user) {
      setError("נדרשת התחברות כדי לשלוח בקשה");
      return;
    }
    setRevealStation(station);
    setRevealDate(filterDate);
    setRevealTimeFrom(filterTimeFrom);
    setRevealTimeTo(filterTimeTo);
    setRevealOpen(true);
  }, [filterDate, filterTimeFrom, filterTimeTo, user]);

  const submitReveal = useCallback(async () => {
    try {
      setError(null);
      if (!revealStation) return;

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

      setRevealSaving(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/interest-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stationId: revealStation.id,
          date: revealDate,
          timeFrom: revealTimeFrom,
          timeTo: revealTimeTo,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בשליחת בקשה");

      setError("הבקשה נשלחה לבעל העמדה");
      setTimeout(() => setError(null), 2500);
      setRevealOpen(false);
      setRevealStation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setRevealSaving(false);
    }
  }, [revealDate, revealStation, revealTimeFrom, revealTimeTo, user]);

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="SharePlus" width={32} height={32} />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">SharePlus</span>
            <span className="text-sm text-zinc-600">רשת טעינה שיתופית לקהילת ה-EV</span>
          </div>
        </div>
        {headerRight}
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-12 text-center">
        {user ? (
          <div className="mx-auto mb-4 flex w-full max-w-5xl justify-start" dir="rtl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveSection("myStations");
                  setShowMyStations(true);
                  setShowFavorites(false);
                  setTimeout(() => {
                    document.getElementById(myStationsAnchorId)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                📍 העמדות שלי
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSection("favorites");
                  setShowFavorites(true);
                  setShowMyStations(false);
                  setTimeout(() => {
                    document.getElementById(favoritesAnchorId)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                ♡ המועדפים שלי
              </button>
            </div>
          </div>
        ) : null}

        <div className="mx-auto mb-6 w-full max-w-xl rounded-2xl border border-zinc-100 bg-white p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-zinc-100">
              <Image
                src="/hero.jpg"
                alt="SharePlus"
                width={900}
                height={506}
                className="h-auto w-full max-w-sm"
                priority
              />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
          {user ? (
            <div>
              <h1 className="text-xl font-semibold">ברוך הבא ל-SharePlus</h1>
              <p className="mt-1 text-sm text-zinc-600">
                בחר פעולה:
              </p>
              <div className="sticky top-0 z-10 mt-4 rounded-2xl bg-zinc-50/80 pb-2 pt-2 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("stations");
                      setShowMyStations(false);
                      setShowFavorites(false);
                      setTimeout(() => {
                        document.getElementById(stationsAnchorId)?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 0);
                    }}
                    className={`rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
                      activeSection === "stations"
                        ? "bg-black text-white"
                        : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    🔎 חפש עמדה
                  </button>

                  <a
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    href="/add-station"
                  >
                    + הוסף עמדה
                  </a>
                </div>
              </div>

              <div id={myStationsAnchorId} className="mt-6 text-right">
                {showMyStations ? (
                  <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold">העמדות שלי</h2>
                      <button
                        type="button"
                        className="text-sm font-medium text-zinc-700 hover:underline"
                        onClick={() => setShowMyStations(false)}
                      >
                        הסתר
                      </button>
                    </div>

                    {loadingMyStations ? (
                      <div className="mt-4 text-sm text-zinc-600">טוען...</div>
                    ) : myStations.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-zinc-100 p-4 text-sm text-zinc-600">
                        אין לך עמדות עדיין.
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        {myStations.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold">{s.title}</div>
                                <div className="mt-1 text-sm text-zinc-600">
                                  {s.city} · {s.connectorType} · {s.powerKw}kW
                                </div>
                                {s.region ? (
                                  <div className="mt-1 text-xs text-zinc-500">אזור: {s.region}</div>
                                ) : null}
                                {s.hoursStart && s.hoursEnd ? (
                                  <div className="mt-1 text-xs text-zinc-500">
                                    שעות פעילות: {s.hoursStart}-{s.hoursEnd}
                                  </div>
                                ) : null}
                                {s.notes ? (
                                  <div className="mt-1 text-xs text-zinc-500">הערות: {s.notes}</div>
                                ) : null}
                                {s.priceNote ? (
                                  <div className="mt-1 text-xs text-zinc-500">{s.priceNote}</div>
                                ) : null}
                                {s.street ? (
                                  <div className="mt-1 text-xs text-zinc-500">רחוב: {s.street}</div>
                                ) : null}
                                {s.hostPhone ? (
                                  <div className="mt-1 text-xs text-zinc-500">טלפון: {s.hostPhone}</div>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 flex-col gap-2">
                                <a
                                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                                  href={`/edit-station/${s.id}`}
                                >
                                  ערוך
                                </a>

                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void setMyStationActive(s.id, s.isActive === false)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors focus:outline-none ${
                                      s.isActive === false
                                        ? "border-zinc-300 bg-zinc-300"
                                        : "border-green-600 bg-green-500"
                                    }`}
                                    aria-label="סטטוס עמדה"
                                  >
                                    <span
                                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-zinc-400 transition-[left,right] ${
                                        s.isActive === false ? "left-0.5" : "right-0.5"
                                      }`}
                                    />
                                  </button>
                                  <span
                                    className={`text-[11px] font-semibold leading-none ${
                                      s.isActive === false ? "text-zinc-500" : "text-green-700"
                                    }`}
                                  >
                                    {s.isActive === false ? "לא פעילה" : "פעילה"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600">לחץ על "העמדות שלי" כדי לראות את העמדות שלך.</div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-semibold">חיפוש עמדות בסביבה</h1>
              <p className="mt-1 text-sm text-zinc-600">
                ניתן לצפות בעמדות ללא התחברות. כדי לחשוף פרטי קשר תתבקש להתחבר.
              </p>
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {user ? (
          <section className="mt-8" id={favoritesAnchorId}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">המועדפים שלי</h2>
              <button
                type="button"
                className="text-sm font-medium text-zinc-700 hover:underline"
                onClick={() => setShowFavorites((v) => !v)}
              >
                {showFavorites ? "הסתר" : "הצג"}
              </button>
            </div>

            {showFavorites ? (
              loadingFavorites ? (
                <div className="mt-4 text-sm text-zinc-600">טוען...</div>
              ) : favorites.length === 0 ? (
                <div className="mt-4 rounded-xl border border-zinc-100 p-4 text-sm text-zinc-600">
                  אין לך מועדפים עדיין.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  {favorites.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold">{s.title}</div>
                          <div className="mt-1 text-sm text-zinc-600">
                            {s.city} · {s.connectorType} · {s.powerKw}kW
                          </div>
                        </div>
                        <button
                          className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={togglingFavId === s.id}
                          onClick={() => void toggleFavorite(s.id)}
                        >
                          {togglingFavId === s.id ? "מעדכן..." : "הסר מהמועדפים"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="mt-3 text-sm text-zinc-600">לחץ על "הצג" כדי לראות את המועדפים שלך.</div>
            )}
          </section>
        ) : null}

        <section className="mt-8" id={stationsAnchorId}>
          <h2 className="text-base font-semibold">עמדות</h2>

          <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">יישוב</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900 placeholder:text-zinc-400"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  list="cities"
                  placeholder="הקלד יישוב..."
                />
                <datalist id="cities">
                  {citySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600">חיבור</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterConnector}
                  onChange={(e) => setFilterConnector(e.target.value)}
                >
                  <option value="">הכל</option>
                  {connectorSuggestions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-zinc-600">תאריך</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">משעה</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterTimeFrom}
                  onChange={(e) => setFilterTimeFrom(e.target.value)}
                  step={300}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">עד שעה</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterTimeTo}
                  onChange={(e) => setFilterTimeTo(e.target.value)}
                  step={300}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">הספק מינימלי (kW)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterMinPower === "" ? "" : String(filterMinPower)}
                  onChange={(e) =>
                    setFilterMinPower(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  inputMode="decimal"
                  placeholder="למשל 11"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600">מחיר מקסימלי (₪)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm text-zinc-900"
                  value={filterMaxPrice === "" ? "" : String(filterMaxPrice)}
                  onChange={(e) =>
                    setFilterMaxPrice(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  inputMode="decimal"
                  placeholder="למשל 30"
                />
                <div className="mt-1 text-xs text-zinc-500">
                  סינון מחיר עובד רק על עמדות שמילאו "מחיר מבוקש".
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-between gap-3">
              <div className="text-xs text-zinc-500">תוצאות: {filteredStations.length}</div>
              <button
                type="button"
                className="text-xs font-medium text-zinc-700 hover:underline"
                onClick={() => {
                  setFilterCity("");
                  setFilterConnector("");
                  setFilterMinPower("");
                  setFilterMaxPrice("");
                  setFilterDate("");
                  setFilterTimeFrom("");
                  setFilterTimeTo("");
                }}
              >
                נקה סינון
              </button>
            </div>
          </div>

          {loadingStations ? (
            <div className="mt-4 text-sm text-zinc-600">טוען...</div>
          ) : filteredStations.length === 0 ? (
            <div className="mt-4 rounded-xl border border-zinc-100 p-4 text-sm text-zinc-600">
              אין תוצאות לפי הסינון.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4">
              {filteredStations.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${
                    highlightStationId === s.id ? "border-emerald-400 bg-emerald-50/30" : "border-zinc-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <a
                        className="text-sm font-semibold text-zinc-900 hover:underline"
                        href={`/stations/${encodeURIComponent(s.id)}`}
                      >
                        {s.title}
                      </a>
                      <div className="mt-1 text-sm text-zinc-600">
                        {s.city} · {s.connectorType} · {s.powerKw}kW
                      </div>
                      {s.region ? (
                        <div className="mt-1 text-xs text-zinc-500">אזור: {s.region}</div>
                      ) : null}
                      {s.hoursStart && s.hoursEnd ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          שעות פעילות: {s.hoursStart}-{s.hoursEnd}
                        </div>
                      ) : null}
                      {s.notes ? (
                        <div className="mt-1 text-xs text-zinc-500">הערות: {s.notes}</div>
                      ) : null}
                      {s.priceNote ? (
                        <div className="mt-1 text-xs text-zinc-500">{s.priceNote}</div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={togglingFavId === s.id}
                        onClick={() => void toggleFavorite(s.id)}
                      >
                        {togglingFavId === s.id
                          ? "מעדכן..."
                          : favoriteIds.has(s.id)
                            ? "הסר מהמועדפים שלי"
                            : "תוסיף למועדפים שלי"}
                      </button>

                      <button
                        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                        onClick={() => {
                          window.location.href = `/stations/${encodeURIComponent(s.id)}`;
                        }}
                      >
                        פרטים ושליחת בקשה
                      </button>

                      {isAdmin ? (
                        <button
                          className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={deletingId === s.id}
                          onClick={() => void deleteStationAsAdmin(s.id)}
                        >
                          {deletingId === s.id ? "מוחק..." : "מחק"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 pb-6 text-center text-xs text-zinc-400">
          v{version}{buildStamp ? ` · ${buildStamp}` : ""}
        </div>
      </main>

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
                onClick={() => {
                  setRevealOpen(false);
                  setRevealStation(null);
                }}
              >
                סגור
              </button>
            </div>

            {revealStation ? (
              <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-700">
                עמדה: <span className="font-semibold">{revealStation.title}</span>
              </div>
            ) : null}

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
                  onChange={(e) => setRevealTimeFrom(e.target.value)}
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
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                onClick={() => {
                  setRevealOpen(false);
                  setRevealStation(null);
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={revealSaving}
                onClick={() => void submitReveal()}
              >
                {revealSaving ? "שולח..." : "שלח בקשה"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
