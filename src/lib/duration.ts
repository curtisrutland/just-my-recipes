/**
 * Conversions between the authoring form's friendly hours/minutes inputs and the
 * ISO 8601 durations the schema stores (`PT35M`, `PT1H30M`). The public site
 * renders these via `formatDuration` (ISO → "1 hr 30 min"); this is the inverse
 * pair used only by the admin form.
 */

export type HoursMinutes = { h: number; m: number };

/**
 * hours+minutes → ISO 8601 duration, or `undefined` when both are zero (so the
 * field is simply omitted from the recipe). Totals are normalized, so 0h/90m
 * becomes `PT1H30M`.
 */
export function hmToIso(h: number, m: number): string | undefined {
  const hh = Math.max(0, Math.floor(h || 0));
  const mm = Math.max(0, Math.floor(m || 0));
  const total = hh * 60 + mm;
  if (total === 0) return undefined;
  const outH = Math.floor(total / 60);
  const outM = total % 60;
  return `PT${outH ? `${outH}H` : ""}${outM ? `${outM}M` : ""}`;
}

/**
 * ISO 8601 duration → hours+minutes for prefilling the form. Days/weeks fold into
 * hours; seconds and month components are ignored (recipes don't use them).
 * Returns `{ h: 0, m: 0 }` for empty/invalid input.
 */
export function isoToHM(iso?: string): HoursMinutes {
  if (!iso) return { h: 0, m: 0 };
  const body = iso.replace(/^P/, "");
  const [datePart, timePart = ""] = body.split("T");
  let minutes = 0;
  const w = /(\d+)W/.exec(datePart);
  if (w) minutes += Number(w[1]) * 7 * 24 * 60;
  const d = /(\d+)D/.exec(datePart);
  if (d) minutes += Number(d[1]) * 24 * 60;
  const h = /(\d+)H/.exec(timePart);
  if (h) minutes += Number(h[1]) * 60;
  // `M` only means minutes in the time part; in the date part it'd be months.
  const m = /(\d+)M/.exec(timePart);
  if (m) minutes += Number(m[1]);
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}
