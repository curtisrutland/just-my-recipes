const DURATION_RE =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/** Total minutes for an ISO 8601 duration, or null if unparseable/absent. */
export function durationToMinutes(iso?: string | null): number | null {
  if (!iso) return null;
  const m = DURATION_RE.exec(iso.trim());
  if (!m || m[0] === "P") return null;
  const [, y, mo, w, d, h, min, s] = m;
  return Math.round(
    (Number(y ?? 0) * 525600 +
      Number(mo ?? 0) * 43200 +
      Number(w ?? 0) * 10080 +
      Number(d ?? 0) * 1440 +
      Number(h ?? 0) * 60 +
      Number(min ?? 0) +
      Number(s ?? 0) / 60) *
      1,
  );
}

/** Human-friendly duration: "35 min", "6 hr", "1 hr 30 min". */
export function formatDuration(iso?: string | null): string | undefined {
  const mins = durationToMinutes(iso);
  if (mins == null) return undefined;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
