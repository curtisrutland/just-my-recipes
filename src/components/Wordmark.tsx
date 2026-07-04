import Link from "next/link";

/** The wordmark, rendered as the domain. The `.` is the accent color. */
export function Wordmark() {
  return (
    <Link
      href="/"
      className="font-display text-[19px] font-bold tracking-[-0.01em] text-ink no-underline"
    >
      justmy<span className="text-accent">.</span>recipes
    </Link>
  );
}
