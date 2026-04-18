"use client";

import { useEffect, useMemo, useState } from "react";

type A11yState = {
  open: boolean;
  fontScale: 1 | 1.1 | 1.2;
  highContrast: boolean;
  underlineLinks: boolean;
};

export default function AccessibilityWidget() {
  const [state, setState] = useState<A11yState>({
    open: false,
    fontScale: 1,
    highContrast: false,
    underlineLinks: false,
  });

  const htmlClassName = useMemo(() => {
    const cls: string[] = [];
    if (state.highContrast) cls.push("sp-a11y-contrast");
    if (state.underlineLinks) cls.push("sp-a11y-links");
    return cls.join(" ");
  }, [state.highContrast, state.underlineLinks]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = `${Math.round(16 * state.fontScale)}px`;
    document.documentElement.classList.remove("sp-a11y-contrast", "sp-a11y-links");
    if (htmlClassName) {
      for (const c of htmlClassName.split(" ")) {
        if (c) document.documentElement.classList.add(c);
      }
    }
  }, [htmlClassName, state.fontScale]);

  return (
    <div className="fixed bottom-4 left-4 z-50" dir="rtl">
      {state.open ? (
        <div className="mb-3 w-72 rounded-2xl border border-zinc-200 bg-white p-4 text-right shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-semibold">נגישות</div>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              onClick={() => setState((s) => ({ ...s, open: false }))}
            >
              סגור
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-zinc-600">גודל טקסט</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    state.fontScale === 1 ? "border-black bg-black text-white" : "border-zinc-200 bg-white"
                  }`}
                  onClick={() => setState((s) => ({ ...s, fontScale: 1 }))}
                >
                  רגיל
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    state.fontScale === 1.1
                      ? "border-black bg-black text-white"
                      : "border-zinc-200 bg-white"
                  }`}
                  onClick={() => setState((s) => ({ ...s, fontScale: 1.1 }))}
                >
                  +
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    state.fontScale === 1.2
                      ? "border-black bg-black text-white"
                      : "border-zinc-200 bg-white"
                  }`}
                  onClick={() => setState((s) => ({ ...s, fontScale: 1.2 }))}
                >
                  ++
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-sm text-zinc-800">ניגודיות גבוהה</span>
              <input
                type="checkbox"
                checked={state.highContrast}
                onChange={(e) => setState((s) => ({ ...s, highContrast: e.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-sm text-zinc-800">הדגשת קישורים</span>
              <input
                type="checkbox"
                checked={state.underlineLinks}
                onChange={(e) => setState((s) => ({ ...s, underlineLinks: e.target.checked }))}
              />
            </label>

            <button
              type="button"
              className="w-full rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50"
              onClick={() =>
                setState({ open: true, fontScale: 1, highContrast: false, underlineLinks: false })
              }
            >
              איפוס
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="כלי נגישות"
        className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold shadow-lg hover:bg-zinc-50"
        onClick={() => setState((s) => ({ ...s, open: !s.open }))}
      >
        נגישות
      </button>
    </div>
  );
}
