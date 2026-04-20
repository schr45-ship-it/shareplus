"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { getClientAuth, getWebPushToken } from "@/lib/firebaseClient";
import { getClientDb } from "@/lib/firestoreClient";
import { getIdToken } from "@/lib/auth";
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone";

type ProfileDoc = {
  displayName?: string;
  phone?: string;
  notificationPreferences?: {
    pushEnabled?: boolean;
    emailEnabled?: boolean;
  };
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<NotificationPermission | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [prefPush, setPrefPush] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPushStatus(null);
      return;
    }
    setPushStatus(Notification.permission);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (!user) return;

        const db = getClientDb();
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as ProfileDoc) : null;

        if (!cancelled) {
          setDisplayName(data?.displayName ?? user.displayName ?? "");
          setPhone(data?.phone ?? "");
          setPrefPush(data?.notificationPreferences?.pushEnabled ?? true);
          setPrefEmail(data?.notificationPreferences?.emailEnabled ?? true);
        }
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
  }, [user]);

  const disablePushOnThisDevice = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }
      if (typeof window === "undefined") return;

      const ok = window.confirm(
        "לבטל התראות במכשיר הזה?\n\nהפעולה תסיר את המכשיר מרשימת ההתראות. כדי לחסום לחלוטין, יש לשנות הרשאות התראות בהגדרות הדפדפן (סמל המנעול בשורת הכתובת)."
      );
      if (!ok) return;

      setPushSaving(true);

      let reg: ServiceWorkerRegistration | undefined;
      if ("serviceWorker" in navigator) {
        reg = await navigator.serviceWorker.getRegistration("/");
      }

      const pushToken = await getWebPushToken(reg).catch(() => null);
      if (!pushToken) {
        setError(
          "לא ניתן להסיר אוטומטית את הטוקן. כדי לבטל התראות: לחץ על סמל המנעול ליד הכתובת → Notifications → Block"
        );
        return;
      }

      const idToken = await getIdToken(user);
      const res = await fetch(`/api/push/register?token=${encodeURIComponent(pushToken)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה בביטול התראות");

      setError("התראות בוטלו במכשיר הזה");
      setTimeout(() => setError(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setPushSaving(false);
    }
  }, [user]);

  const testPushNotification = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }
      setPushTesting(true);
      const idToken = await getIdToken(user);
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tokenCount?: number;
        successCount?: number;
        failureCount?: number;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "שגיאה בבדיקת התראה");
      }

      setError(
        `נשלחה התראת בדיקה. טוקנים: ${json.tokenCount ?? 0}, הצלחות: ${json.successCount ?? 0}, כשלונות: ${json.failureCount ?? 0}`
      );
      setTimeout(() => setError(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setPushTesting(false);
    }
  }, [user]);

  const canSave = useMemo(() => {
    return Boolean(user) && displayName.trim().length > 0 && isValidPhone(phone);
  }, [displayName, phone, user]);

  const save = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }
      if (!canSave) {
        if (!displayName.trim()) {
          setError("אנא מלא שם");
          return;
        }
        if (!isValidPhone(phone)) {
          setError("אנא הזן מספר טלפון תקין");
          return;
        }
        setError("אנא מלא את כל השדות");
        return;
      }

      setSaving(true);
      const db = getClientDb();
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          displayName: displayName.trim(),
          phone: normalizePhoneE164(phone),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setError("נשמר");
      setTimeout(() => setError(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setSaving(false);
    }
  }, [canSave, displayName, phone, user]);

  const deleteAccount = useCallback(async () => {
    try {
      setError(null);
      if (!user) {
        setError("נדרשת התחברות");
        return;
      }

      const ok = window.confirm(
        "שים לב: המחיקה היא סופית.\nהאם אתה בטוח שברצונך למחוק?"
      );
      if (!ok) return;

      setDeleting(true);
      const token = await getIdToken(user);
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה במחיקת משתמש");

      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setDeleting(false);
    }
  }, [user]);

  const registerPushToken = useCallback(async () => {
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

      setPushSaving(true);

      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission !== "granted") {
        if (permission === "denied") {
          setError("ההתראות חסומות בהגדרות הדפדפן שלך");
        } else {
          setError("לא אישרת קבלת התראות");
        }
        return;
      }

      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      }

      let reg: ServiceWorkerRegistration | undefined;
      if ("serviceWorker" in navigator) {
        reg = (await navigator.serviceWorker.getRegistration("/")) ?? undefined;
      }

      const pushToken = await getWebPushToken(reg);
      if (!pushToken) {
        setError(
          "לא ניתן לקבל טוקן להתראות. בדוק שקיים NEXT_PUBLIC_FIREBASE_VAPID_KEY בפרודקשן וש-Service Worker נטען בהצלחה."
        );
        return;
      }

      const idToken = await getIdToken(user);
      const res = await fetch("/api/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          token: pushToken,
          deviceLabel: typeof navigator !== "undefined" ? navigator.platform : "",
          deviceType:
            typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
              ? "android"
              : typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
                ? "ios"
                : "desktop",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: typeof navigator !== "undefined" ? navigator.language : "",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "שגיאה ברישום התראות");

      setError("התראות הופעלו בהצלחה");
      setTimeout(() => setError(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
    } finally {
      setPushSaving(false);
    }
  }, [user]);

  const saveNotificationPreferences = useCallback(
    async (next: { pushEnabled: boolean; emailEnabled: boolean }) => {
      try {
        setError(null);
        if (!user) {
          setError("נדרשת התחברות");
          return;
        }

        setPrefSaving(true);
        const idToken = await getIdToken(user);
        const res = await fetch("/api/notification-preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(next),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? "שגיאה בשמירת העדפות");

        setPrefPush(next.pushEnabled);
        setPrefEmail(next.emailEnabled);

        setError("נשמר");
        setTimeout(() => setError(null), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה לא צפויה");
      } finally {
        setPrefSaving(false);
      }
    },
    [user]
  );

  if (!user) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
        <main className="mx-auto w-full max-w-xl px-6 py-10 text-right">
          <h1 className="text-2xl font-semibold">הפרופיל שלי</h1>
          <div className="mt-4 rounded-xl border border-zinc-100 p-4 text-sm text-zinc-700">
            נדרשת התחברות כדי לצפות בפרופיל.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-xl px-6 py-10 text-right">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">הפרופיל שלי</h1>
          <a className="text-sm font-medium text-zinc-900 hover:underline" href="/">
            חזרה
          </a>
        </div>

        {loading ? <div className="mt-4 text-sm text-zinc-600">טוען...</div> : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="text-xs text-zinc-500">אימייל</div>
            <div className="mt-1 text-sm font-medium">{user.email ?? ""}</div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-600">שם להצגה</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">טלפון</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="+972..."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSave || saving}
                onClick={() => void save()}
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">ניהול התראות</div>

            <div className="mt-1 text-xs text-zinc-500">
              ההתראות קופצות במכשיר ובדפדפן שבו הפעלת אותן (למשל: המחשב בבית ב-Chrome, או הטלפון ב-Chrome).
            </div>

            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-600">אופן קבלת בקשות</div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>התראות קופצות בטלפון/מחשב</span>
                  <input
                    type="checkbox"
                    checked={prefPush}
                    disabled={prefSaving}
                    onChange={(e) =>
                      void saveNotificationPreferences({
                        pushEnabled: e.target.checked,
                        emailEnabled: prefEmail,
                      })
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>קבלת דוא"ל</span>
                  <input
                    type="checkbox"
                    checked={prefEmail}
                    disabled={prefSaving}
                    onChange={(e) =>
                      void saveNotificationPreferences({
                        pushEnabled: prefPush,
                        emailEnabled: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={prefSaving}
                  onClick={() =>
                    void saveNotificationPreferences({
                      pushEnabled: true,
                      emailEnabled: true,
                    })
                  }
                >
                  הכל
                </button>
                <button
                  type="button"
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={prefSaving}
                  onClick={() =>
                    void saveNotificationPreferences({
                      pushEnabled: false,
                      emailEnabled: false,
                    })
                  }
                >
                  כלום
                </button>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                בקרוב: וואטסאפ/מסרון.
              </div>
            </div>

            {typeof window !== "undefined" && !("Notification" in window) ? (
              <div className="mt-2 text-sm text-zinc-700">הדפדפן לא תומך בהתראות.</div>
            ) : pushStatus === "denied" ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">ההתראות חסומות בהגדרות הדפדפן שלך</div>
                <div className="mt-2 text-xs text-amber-900">
                  כדי לבטל חסימה:
                  <div className="mt-1">
                    1) לחץ על סמל המנעול ליד כתובת האתר
                  </div>
                  <div className="mt-1">2) בחר Notifications → Allow</div>
                  <div className="mt-1">3) רענן את הדף וחזור לכאן</div>
                </div>
              </div>
            ) : pushStatus === "granted" ? (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="font-semibold">הכל תקין — התראות פעילות</div>
                <div className="mt-1 text-xs">
                  מכשיר נוכחי: {typeof navigator !== "undefined" ? navigator.platform : ""}
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pushSaving}
                    onClick={() => void disablePushOnThisDevice()}
                  >
                    בטל התראות
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pushSaving || pushTesting}
                    onClick={() => void testPushNotification()}
                  >
                    {pushTesting ? "שולח..." : "בדיקת התראה"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pushSaving}
                    onClick={() => void registerPushToken()}
                  >
                    {pushSaving ? "בודק..." : "רענן רישום התראות"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <div className="text-sm text-zinc-700">התראות עדיין לא הופעלו.</div>
                <button
                  type="button"
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pushSaving}
                  onClick={() => void registerPushToken()}
                >
                  {pushSaving ? "מפעיל..." : "הפעל התראות"}
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={deleting}
              onClick={() => void deleteAccount()}
            >
              {deleting ? "מוחק..." : "מחק משתמש"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
