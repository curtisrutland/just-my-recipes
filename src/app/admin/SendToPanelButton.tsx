"use client";

import { useState, useTransition } from "react";
import { sendToPanel } from "./actions";

/**
 * "Send to panel" for one recipe row. Pushes the recipe to the justmy.website
 * kitchen panel as its active recipe — passive: nothing navigates, the panel
 * picks it up when tapped over there. Quiet success: the label flips to
 * "Sent ✓" briefly. Failures surface the panel's own error(s) inline so a
 * malformed recipe can be fixed on the spot.
 */
export function SendToPanelButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function onClick() {
    setErrors([]);
    startTransition(async () => {
      const result = await sendToPanel(slug);
      if (result.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={`Send ${slug} to the kitchen panel`}
        className={
          sent
            ? "rounded-md border border-accent-line bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent transition-colors disabled:opacity-50"
            : "rounded-md border border-line px-2.5 py-1 text-caption text-muted transition-colors hover:border-accent-line hover:text-accent disabled:opacity-50"
        }
      >
        {pending ? "Sending…" : sent ? "Sent ✓" : "Send to panel"}
      </button>
      {errors.length > 0 && (
        <ul className="max-w-[16rem] list-none text-right text-caption text-red-500">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
