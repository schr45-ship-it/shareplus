"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { getClientAuth, signInWithGoogle } from "@/lib/firebaseClient";
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
  priceNote?: string;
  pricingType?: string;
  priceIls?: number;
  isActive?: boolean;
};

type MyStation = StationPublic & {
  exactAddress?: string;
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
  const [filterConnector, setFilterConnector] = useState("");
  const [filterMinPower, setFilterMinPower] = useState<number | "">("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | "">("");

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

      return true;
    });
  }, [stations, filterCity, filterConnector, filterMinPower, filterMaxPrice]);

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
      const url = `${window.location.origin}/reveal?stationId=${encodeURIComponent(stationId)}`;
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
        if (!res.ok) throw new Error("Failed to load favorites");
        const data = (await res.json()) as { stations: StationPublic[] };
        if (cancelled) return;
        setFavorites(data.stations);
        setFavoriteIds(new Set(data.stations.map((s) => s.id)));
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

  const headerRight = useMemo(() => {
    if (!user) {
      return (
        <button
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => void signInWithGoogle()}
        >
          התחבר עם Google
        </button>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">{user.email ?? user.displayName}</span>
        <button
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          onClick={() => void signOut(getClientAuth())}
        >
          התנתק
        </button>
      </div>
    );
  }, [user]);

  const startCheckout = useCallback(
    async (stationId: string) => {
      setError(null);

      let currentUser = user;
      if (!currentUser) {
        await signInWithGoogle();
        currentUser = getClientAuth().currentUser;
      }

      if (!currentUser) {
        setError("ההתחברות נכשלה. נסה שוב.");
        return;
      }

      const token = await getIdToken(currentUser);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stationId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Checkout failed");
      }

      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    },
    [user]
  );

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
                    className={`rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
                      activeSection === "myStations"
                        ? "bg-black text-white"
                        : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    }`}
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
                    className={`rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
                      activeSection === "favorites"
                        ? "bg-black text-white"
                        : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    ♡ המועדפים שלי
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
                                {s.exactAddress ? (
                                  <div className="mt-1 text-xs text-zinc-500">כתובת: {s.exactAddress}</div>
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
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                        onClick={() => void startCheckout(s.id).catch((e) => setError(String(e)))}
                      >
                        חשוף פרטי קשר (1₪)
                      </button>

                      <button
                        type="button"
                        className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                        onClick={() => void shareStation(s.id, s.title)}
                      >
                        ↗ שתף
                      </button>

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
    </div>
  );
}
