"use client";

import { useEffect, useState } from "react";

/**
 * Checkable ingredient list. State persists per-recipe in localStorage (keyed
 * by slug) — no server, no account. A purely optional nice-to-have.
 */
export function Ingredients({
  slug,
  items,
  yieldLabel,
}: {
  slug: string;
  items: string[];
  yieldLabel?: string;
}) {
  const storageKey = `jmr-checked-${slug}`;
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Read persisted state after mount (server renders everything unchecked, so
  // this deliberate post-hydration update avoids a mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
  }, [storageKey]);

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = { ...prev, [i]: !prev[i] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage unavailable — checkbox still works for the session */
      }
      return next;
    });

  return (
    <section className="min-w-0">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-heading text-ink">Ingredients</h2>
        {yieldLabel && (
          <span className="text-caption text-muted">{yieldLabel}</span>
        )}
      </div>
      <ul className="flex list-none flex-col p-0">
        {items.map((text, i) => {
          const on = !!checked[i];
          return (
            <li
              key={i}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(i);
                }
              }}
              className="flex cursor-pointer select-none items-start gap-[11px] border-b border-line py-2 text-body-lg leading-[1.35]"
            >
              <span
                className={`mt-px flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-[12px] text-white ${
                  on ? "border-accent bg-accent" : "border-line bg-transparent"
                }`}
              >
                {on ? "✓" : ""}
              </span>
              <span
                className={
                  on ? "text-ink opacity-45 line-through" : "text-ink"
                }
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
