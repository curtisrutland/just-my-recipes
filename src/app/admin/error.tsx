"use client";

import Link from "next/link";

/**
 * Error boundary for the admin segment — a failed server action (DB hiccup,
 * unexpected throw) shows this instead of a raw crash. `reset()` re-renders the
 * segment to retry.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 py-6">
      <div>
        <h1 className="font-display text-display-sm text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-snug text-muted">
          The last action didn&apos;t complete. This is usually transient — try
          again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-caption text-muted">
            Ref <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-accent-line bg-accent-soft px-4 py-2 text-[15px] font-medium text-accent hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="text-caption text-muted no-underline hover:text-ink"
        >
          Back to recipes
        </Link>
      </div>
    </div>
  );
}
