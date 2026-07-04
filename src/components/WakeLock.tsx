"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MonitorIcon } from "./icons";

/**
 * Screen Wake Lock, per the design's honesty rules:
 *  - `intent` (user wants it on) is tracked separately from `active` (a lock is
 *    actually held). The UI is driven by `active`, never optimism.
 *  - Strictly opt-in: a lock is acquired only on an explicit toggle, never on
 *    load, and nothing is persisted across navigations or reloads.
 *  - The UA releases the lock when the tab is hidden; on returning to visible we
 *    re-acquire iff intent is still on. That is the only automatic behavior.
 *  - We subscribe to the sentinel's `release` event so a system release (battery
 *    saver, tab blur) flips the control back to off.
 *  - Absent-safe: with no Wake Lock API, the whole control renders nothing.
 */

type WakeState = { supported: boolean; active: boolean; toggle: () => void };

const WakeContext = createContext<WakeState | null>(null);

function useWake(): WakeState {
  const ctx = useContext(WakeContext);
  if (!ctx) throw new Error("Wake controls must be inside <WakeLockProvider>");
  return ctx;
}

export function WakeLockProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe feature detection (false on the server, real value after mount).
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "wakeLock" in navigator,
    () => false,
  );
  const [active, setActive] = useState(false);
  const intentRef = useRef(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => {
        // Fired on our own release AND on a system release (tab hidden, etc.).
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        setActive(false);
      });
    } catch {
      // Permission denied / not allowed — reflect reality: no lock.
      sentinelRef.current = null;
      setActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        /* already released */
      }
    }
  }, []);

  const toggle = useCallback(() => {
    if (intentRef.current) {
      intentRef.current = false;
      void release();
    } else {
      intentRef.current = true;
      void acquire();
    }
  }, [acquire, release]);

  // Re-acquire when the tab becomes visible again — only if intent is still on.
  useEffect(() => {
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        intentRef.current &&
        !sentinelRef.current
      ) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [acquire]);

  // Release on unmount (navigating away from the recipe).
  useEffect(() => {
    return () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      intentRef.current = false;
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, []);

  return (
    <WakeContext.Provider value={{ supported, active, toggle }}>
      {children}
    </WakeContext.Provider>
  );
}

/** Mobile: full-width card under the meta strip. */
export function WakeCard() {
  const { supported, active, toggle } = useWake();
  if (!supported) return null;
  return (
    <div className="mt-3 md:hidden print:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label="Keep screen awake while cooking"
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border-[1.5px] px-[18px] py-[11px] text-left transition ${
          active
            ? "border-accent bg-accent text-white shadow-wake"
            : "border-line bg-surface text-ink"
        }`}
      >
        <MonitorIcon active={active} size={21} />
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[15.5px] font-semibold tracking-[0.005em]">
            {active ? "Screen staying on" : "Keep screen on"}
          </span>
          <span
            className={`mt-0.5 text-[11.5px] tracking-[0.01em] ${
              active ? "opacity-90" : "opacity-60"
            }`}
          >
            {active
              ? "Display won’t sleep while you cook"
              : "Tap to stop the display sleeping"}
          </span>
        </span>
        {active && (
          <span className="wake-pulse ml-auto h-[11px] w-[11px] flex-none rounded-full bg-white" />
        )}
      </button>
    </div>
  );
}

/** Desktop: compact button in the app bar. */
export function WakeBarButton() {
  const { supported, active, toggle } = useWake();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label="Keep screen awake while cooking"
      className={`hidden h-[38px] items-center gap-2 whitespace-nowrap rounded-[9px] border-[1.5px] px-[13px] transition md:inline-flex print:hidden ${
        active
          ? "border-accent bg-accent text-white shadow-[0_0_0_3px_var(--accent-glow)]"
          : "border-line bg-surface text-ink"
      }`}
    >
      <MonitorIcon active={active} size={18} />
      <span className="font-display text-[13.5px] font-semibold tracking-[0.005em]">
        {active ? "Screen on" : "Keep screen on"}
      </span>
      {active && (
        <span className="wake-pulse h-[9px] w-[9px] flex-none rounded-full bg-white" />
      )}
    </button>
  );
}
